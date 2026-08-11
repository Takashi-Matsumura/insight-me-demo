import { rawCall } from "./client";
import { buildTurnSystemPrompt } from "@/lib/dialogue/prompts";
import { THEMES } from "@/lib/dialogue/themes";

/**
 * 起動直後にダミーのシステムプロンプトを1回投げて、llama.cpp のプロンプトキャッシュを
 * 温めておく。実測: 同一プレフィクスの2回目は 19.3秒 → 2.9秒に短縮される。
 * 4並列でサーバがクラッシュした実測があるため、ウォームアップは必ず単発・逐次で行う。
 */
export async function warmup(): Promise<void> {
  const theme = THEMES[0];
  const systemPrompt = buildTurnSystemPrompt(theme, 0);
  try {
    await rawCall({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "こんにちは" },
      ],
      maxTokens: 1,
      timeoutMs: 30_000,
      priority: "batch",
    });
  } catch {
    // llama.cpp が未起動でもアプリの起動自体は継続する
  }
}
