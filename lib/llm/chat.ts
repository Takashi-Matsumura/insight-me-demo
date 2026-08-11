import { rawCall, type LlmMessage } from "./client";
import { iterateContentDeltas } from "./sse";
import type { LlmPriority } from "./queue";

export interface ChatChunk {
  type: "text" | "control" | "done";
  text?: string;
  action?: "probe" | "next";
}

// 対話プロンプト（lib/dialogue/prompts.ts）は本文の最後に空行＋制御タグを
// 単独行で出力するよう指示する。ここではタグが画面に一瞬も漏れないよう、
// 「最後の改行より前」だけを確定安全とみなしてストリームする。
const SENTINEL = /\[(PROBE|NEXT)\]\s*$/;

export async function* streamChat(
  messages: LlmMessage[],
  opts: { maxTokens?: number; temperature?: number; signal?: AbortSignal } = {},
): AsyncGenerator<ChatChunk> {
  const res = await rawCall({
    messages,
    maxTokens: opts.maxTokens ?? 220,
    temperature: opts.temperature ?? 0.85,
    stream: true,
    signal: opts.signal,
    priority: "interactive",
    timeoutMs: 45_000,
  });

  let pending = ""; // まだ「確定安全」でない末尾バッファ（センチネル判定用）
  let action: "probe" | "next" = "probe";

  for await (const piece of iterateContentDeltas(res)) {
    pending += piece;
    const cut = pending.lastIndexOf("\n");
    if (cut >= 0) {
      const safe = pending.slice(0, cut);
      pending = pending.slice(cut); // 改行以降は保留し続ける
      if (safe) yield { type: "text", text: safe };
    }
  }

  const match = pending.match(SENTINEL);
  if (match) {
    action = match[1] === "NEXT" ? "next" : "probe";
    pending = pending.slice(0, match.index);
  }
  const tail = pending.trim();
  if (tail) yield { type: "text", text: tail };
  yield { type: "control", action };
  yield { type: "done" };
}

/**
 * 制御タグを持たない汎用のストリーミングテキスト生成。
 * レポート生成のステージA（自己理解サマリ）などで使う。
 */
export async function* streamText(
  messages: LlmMessage[],
  opts: {
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
    priority?: LlmPriority;
    timeoutMs?: number;
  } = {},
): AsyncGenerator<string> {
  const res = await rawCall({
    messages,
    maxTokens: opts.maxTokens ?? 300,
    temperature: opts.temperature ?? 0.7,
    stream: true,
    signal: opts.signal,
    priority: opts.priority ?? "batch",
    timeoutMs: opts.timeoutMs ?? 60_000,
  });
  yield* iterateContentDeltas(res);
}
