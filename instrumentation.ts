export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { warmup } = await import("./lib/llm/warmup");
  // register() の完了をブロックしないよう await しない
  void warmup().catch(() => {});
}
