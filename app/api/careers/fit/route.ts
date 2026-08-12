import { getCareerById } from "@/lib/careers/catalog";
import { generateText } from "@/lib/llm/client";
import { LlmError } from "@/lib/llm/errors";
import { buildCareerFitMessages, selectReportThemeResults } from "@/lib/report/prompts";
import { getSession, getCareerFit, upsertCareerFit, listThemeResults } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

interface FitRequestBody {
  sessionId?: unknown;
  careerId?: unknown;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as FitRequestBody | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const careerId = typeof body?.careerId === "string" ? body.careerId : "";

  if (!sessionId || !careerId) {
    return Response.json({ error: "sessionId と careerId が必要です" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return Response.json({ error: "セッションが見つかりません" }, { status: 404 });
  }

  const career = getCareerById(careerId);
  if (!career) {
    return Response.json({ error: "不正な careerId です" }, { status: 400 });
  }

  // 既に生成済みなら再生成せずキャッシュを返す（再クリックへの安全弁）
  const cached = getCareerFit(sessionId, careerId);
  if (cached) {
    return Response.json({ text: cached, cached: true });
  }

  const themeResults = selectReportThemeResults(listThemeResults(sessionId));
  if (themeResults.length === 0) {
    return Response.json({ error: "対話の記録が足りません" }, { status: 400 });
  }

  try {
    const text = await generateText({
      messages: buildCareerFitMessages(career, themeResults, session.readingLevel),
      maxTokens: 200,
      temperature: 0.7,
      // 学生が画面の前で待っているので、レポートのバッチ生成より優先度を上げる
      priority: "interactive",
      signal: request.signal,
      timeoutMs: 30_000,
    });
    upsertCareerFit(sessionId, careerId, text);
    return Response.json({ text, cached: false });
  } catch (e) {
    const message = e instanceof LlmError ? e.message : "生成に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }
}
