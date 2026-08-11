import type { Theme } from "./themes";
import type { ThemeResult } from "@/lib/db/queries";
import type { LlmMessage } from "@/lib/llm/client";

/**
 * このテーマで LLM にあと何回まで深掘りさせてよいかの上限判定。
 * `probeCount`（このテーマで既に行われた深掘り回数）がこの上限に達した時点の
 * 呼び出しでは、モデルに強制的に [NEXT] を出させる。
 * lib/llm/chat.ts の制御タグ運用、app/api/chat/route.ts のサーバ側ハードキャップと
 * 同じ式を使うことで、プロンプト側の指示とサーバ側の強制が食い違わないようにする。
 */
export function mustForceNext(theme: Theme, probeCount: number): boolean {
  return probeCount >= theme.maxProbes - 1;
}

export function buildTurnSystemPrompt(
  theme: Theme,
  probeCount: number,
  priorContext = "",
): string {
  return `あなたは新卒キャリア面談のメンター「みらい」です。相手はインターン中の学生です。
${priorContext}
【いまのテーマ】${theme.title}
【このテーマで集めたい観点】
${theme.aspects.map((a, i) => `(${i + 1}) ${a}`).join("\n")}

【話し方のルール】
- 学生の言葉から印象的なフレーズを1つだけ「」で引用し、受け止めてから問いを返す。
- 質問は必ず1つだけ。3文以内。敬体。評価や説教をしない。
- 「なぜ？」を繰り返さない。「そのとき何をした？」「どの瞬間？」など場面を聞く。
- 職業名を出してアドバイスしない。ここは自己理解の時間。

【制御タグ】
本文のあとに空行を1つ入れ、最終行に制御タグを単独行で出力すること。
- 観点がまだ埋まっていない → [PROBE]
- 観点が十分に埋まった、または学生が話しにくそう → [NEXT]
${mustForceNext(theme, probeCount) ? "- 今回は必ず [NEXT] を出すこと。" : ""}`;
}

/** 前テーマまでの要約を短い文脈として渡す。1行80字程度×最大4テーマ分。 */
export function buildPriorThemesContext(results: ThemeResult[]): string {
  const completed = results.filter((r) => !r.skipped && r.summary);
  if (completed.length === 0) return "";
  const lines = completed.map((r) => `- ${r.summary}`).join("\n");
  return `\n【これまでの対話の要約】\n${lines}\n`;
}

/** テーマ完了時、対話ログから気づきカード(INSIGHT_SCHEMA)を抽出するためのメッセージ */
export function buildInsightMessages(
  theme: Theme,
  conversation: { role: "user" | "assistant"; content: string }[],
): LlmMessage[] {
  const transcript = conversation
    .map((m) => `${m.role === "user" ? "学生" : "メンター"}: ${m.content}`)
    .join("\n");

  return [
    {
      role: "system",
      content:
        `あなたは学生との対話ログから「気づきカード」を作るアシスタントです。` +
        `以下は「${theme.title}」というテーマでの対話です。\n\n` +
        `次の項目を作ってください。\n` +
        `- quote: 学生の発言の中から最も印象的なフレーズを1つ選び、そのままの言葉で引用する` +
        `（要約したり言い回しを変えたりしない）。\n` +
        `- label: その学生の人となりを言い切る8〜16字の見出し。` +
        `例「粘り強く試行錯誤する人」「人の反応を力に変える人」のように、学生自身の特性を名指しする。` +
        `「〜への言い換え」のような説明文にはしない。\n` +
        `- reframe: quote の内容を、職業的な強みとして前向きに言い換えた50〜70字の一文。\n` +
        `- summary: このテーマでの回答全体を80字程度で要約する。\n` +
        `- tags: 該当する特性タグを2〜5個選ぶ。`,
    },
    { role: "user", content: transcript },
  ];
}
