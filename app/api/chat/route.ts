import { getTheme, isLastTheme, nextThemeId } from "@/lib/dialogue/themes";
import {
  buildPriorThemesContext,
  buildTurnSystemPrompt,
  mustForceNext,
} from "@/lib/dialogue/prompts";
import { streamChat } from "@/lib/llm/chat";
import type { LlmMessage } from "@/lib/llm/client";
import { LlmError, llmErrorMessage } from "@/lib/llm/errors";
import { encodeSseEvent } from "@/lib/llm/sse";
import {
  addMessage,
  getSession,
  listMessagesForTheme,
  listThemeResults,
  updateSessionProgress,
  updateSessionStatus,
  upsertThemeResult,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

interface ChatRequestBody {
  sessionId?: unknown;
  userText?: unknown;
  skip?: unknown;
  /** true の場合、新しい発言を追加せず直前のユーザー発言に対して再生成する（再送信ボタン用） */
  regenerate?: unknown;
}

/** 現テーマ完了に伴うセッション進行（次テーマへ or 完了扱い）を行い、遷移先情報を返す。 */
function advanceSession(sessionId: string, themeId: string) {
  if (isLastTheme(themeId)) {
    updateSessionStatus(sessionId, "completed");
    return { nextThemeId: null as string | null, completed: true };
  }
  const next = nextThemeId(themeId);
  updateSessionProgress(sessionId, { currentTheme: next!, probeCount: 0 });
  return { nextThemeId: next, completed: false };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ChatRequestBody | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";

  if (!sessionId) {
    return Response.json({ error: "sessionId が必要です" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return Response.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  if (session.status !== "active") {
    return Response.json({ error: "このセッションはすでに終了しています" }, { status: 400 });
  }

  const theme = getTheme(session.currentTheme);
  if (!theme) {
    return Response.json({ error: "不正なテーマ状態です" }, { status: 500 });
  }

  // --- スキップ: LLM を呼ばず即座に次テーマへ ---
  if (body?.skip === true) {
    upsertThemeResult({ sessionId, themeId: theme.id, skipped: true });
    const result = advanceSession(sessionId, theme.id);
    return Response.json({ action: "next", ...result });
  }

  const isRegenerate = body?.regenerate === true;

  if (isRegenerate) {
    // 再送信: 直前のユーザー発言に対して再生成するだけで、新しい行は追加しない。
    // (ユーザー発言を毎回無条件で追加すると、再送信のたびに同じ発言が DB に重複してしまうため)
    const existing = listMessagesForTheme(sessionId, theme.id);
    const last = existing[existing.length - 1];
    if (!last || last.role !== "user") {
      return Response.json({ error: "再送信できる発言がありません" }, { status: 400 });
    }
  } else {
    const userText = typeof body?.userText === "string" ? body.userText.trim() : "";
    if (!userText) {
      return Response.json({ error: "userText が必要です" }, { status: 400 });
    }
    if (userText.length > 500) {
      return Response.json({ error: "発言が長すぎます（500字以内）" }, { status: 400 });
    }
    // ユーザー発言はストリーム開始前に保存する。落ちても入力は消えない。
    addMessage({ sessionId, themeId: theme.id, role: "user", content: userText });
  }

  const priorContext = buildPriorThemesContext(listThemeResults(sessionId));
  const systemPrompt = buildTurnSystemPrompt(theme, session.probeCount, priorContext);
  const history = listMessagesForTheme(sessionId, theme.id);

  const messages: LlmMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m): LlmMessage => ({ role: m.role, content: m.content })),
  ];

  const probeCountAtCall = session.probeCount;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      let modelAction: "probe" | "next" = "probe";

      try {
        for await (const chunk of streamChat(messages, { signal: request.signal })) {
          if (chunk.type === "text" && chunk.text) {
            fullText += chunk.text;
            controller.enqueue(encodeSseEvent({ type: "text", text: chunk.text }));
          } else if (chunk.type === "control" && chunk.action) {
            modelAction = chunk.action;
          }
        }
      } catch (e) {
        const code = e instanceof LlmError ? e.code : "UNKNOWN";
        const message = e instanceof LlmError ? e.message : llmErrorMessage("UNKNOWN");
        controller.enqueue(
          encodeSseEvent({
            type: "error",
            code,
            message,
            retryable: code === "UNAVAILABLE" || code === "TIMEOUT",
          }),
        );
        controller.close();
        return;
      }

      if (fullText.trim()) {
        addMessage({ sessionId, themeId: theme.id, role: "assistant", content: fullText.trim() });
      }

      const finalAction = mustForceNext(theme, probeCountAtCall) ? "next" : modelAction;

      if (finalAction === "next") {
        const result = advanceSession(sessionId, theme.id);
        controller.enqueue(encodeSseEvent({ type: "control", action: "next", ...result }));
      } else {
        updateSessionProgress(sessionId, {
          currentTheme: theme.id,
          probeCount: probeCountAtCall + 1,
        });
        controller.enqueue(
          encodeSseEvent({ type: "control", action: "probe", nextThemeId: null, completed: false }),
        );
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
