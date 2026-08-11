import { getTheme } from "@/lib/dialogue/themes";
import { buildInsightMessages } from "@/lib/dialogue/prompts";
import { INSIGHT_SCHEMA, type InsightCardResult } from "@/lib/dialogue/schemas";
import { generateStructured } from "@/lib/llm/structured";
import { LlmError } from "@/lib/llm/errors";
import {
  getSession,
  listMessagesForTheme,
  listThemeResults,
  upsertThemeResult,
  type ThemeResult,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

interface CompleteRequestBody {
  sessionId?: unknown;
  themeId?: unknown;
}

interface InsightResponse {
  quote: string;
  label: string;
  reframe: string;
  tags: string[];
}

function toInsightResponse(result: ThemeResult): InsightResponse | null {
  if (result.skipped || !result.quote || !result.label || !result.reframe) return null;
  return {
    quote: result.quote,
    label: result.label,
    reframe: result.reframe,
    tags: result.tags,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CompleteRequestBody | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const themeId = typeof body?.themeId === "string" ? body.themeId : "";

  if (!sessionId || !themeId) {
    return Response.json({ error: "sessionId と themeId が必要です" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return Response.json({ error: "セッションが見つかりません" }, { status: 404 });
  }

  const theme = getTheme(themeId);
  if (!theme) {
    return Response.json({ error: "不正な themeId です" }, { status: 400 });
  }

  // 既に生成済みなら再生成せずキャッシュを返す(再呼び出しへの安全弁)
  const existing = listThemeResults(sessionId).find((r) => r.themeId === themeId);
  if (existing) {
    return Response.json({ insight: toInsightResponse(existing) });
  }

  const history = listMessagesForTheme(sessionId, themeId);
  if (history.length === 0) {
    upsertThemeResult({ sessionId, themeId, skipped: true });
    return Response.json({ insight: null });
  }

  try {
    const messages = buildInsightMessages(
      theme,
      history.map((m) => ({ role: m.role, content: m.content })),
    );
    const card = await generateStructured<InsightCardResult>({
      messages,
      schema: INSIGHT_SCHEMA,
      maxTokens: 220,
      // 学生が次テーマのオープナーを読んでいる間に走る対話体験の一部なので優先度は対話と同格
      priority: "interactive",
      timeoutMs: 30_000,
    });

    const result = upsertThemeResult({
      sessionId,
      themeId,
      quote: card.quote,
      label: card.label,
      reframe: card.reframe,
      tags: card.tags,
      summary: card.summary,
    });

    return Response.json({ insight: toInsightResponse(result) });
  } catch (e) {
    const message = e instanceof LlmError ? e.message : "気づきカードの生成に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }
}
