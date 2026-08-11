// SSE (Server-Sent Events) の共通ユーティリティ。
// アプリ→ブラウザへ送るイベントの組み立てと、llama.cpp→アプリの
// SSEレスポンスからトークンを取り出す処理の両方をここに集約する。

const encoder = new TextEncoder();

export function encodeSseEvent(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function* iterateContentDeltas(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("ストリームの読み取りに失敗しました");

  const decoder = new TextDecoder();
  let buf = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;

        let delta: { content?: string } | undefined;
        try {
          delta = JSON.parse(payload).choices?.[0]?.delta;
        } catch {
          continue; // 壊れた行はスキップ(次のチャンクで継続)
        }

        // enable_thinking:false でも念のため reasoning_content は無視する
        if (delta?.content) yield delta.content;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
