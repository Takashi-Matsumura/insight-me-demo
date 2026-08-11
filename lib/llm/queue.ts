// llama.cpp は total_slots=4 だが、実測で 4 並列（長いプロンプト併用時）が
// `ggml_abort`（KVキャッシュ復元失敗）でサーバをクラッシュさせることを確認済み。
// アプリ側で同時実行数を絞り、対話中にレポート生成が割り込んで詰まらないよう
// 優先度付きセマフォとして実装する。

export type LlmPriority = "interactive" | "batch";

class LlmQueue {
  // 既定 2。緊急時は環境変数で 1 まで落とせる。
  private readonly limit = Math.max(1, Number(process.env.LLAMA_MAX_CONCURRENCY ?? 2));
  private active = 0;
  private readonly waiting: Array<{ priority: number; resume: () => void }> = [];

  async run<T>(priority: LlmPriority, fn: () => Promise<T>): Promise<T> {
    await this.acquire(priority === "interactive" ? 0 : 1);
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(priority: number): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiting.push({ priority, resume: resolve });
      // 数値が小さいほど優先。対話(0) がレポート生成(1) より先に通る。
      this.waiting.sort((a, b) => a.priority - b.priority);
    });
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) {
      // スロットを次の待ち手にそのまま引き継ぐ（active は変えない）
      next.resume();
    } else {
      this.active--;
    }
  }
}

// dev の HMR でキューが多重生成されないよう globalThis に固定する。
const globalForQueue = globalThis as unknown as { __llmQueue?: LlmQueue };
export const llmQueue = (globalForQueue.__llmQueue ??= new LlmQueue());
