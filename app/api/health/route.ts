import { checkHealth } from "@/lib/llm/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await checkHealth();
  return Response.json(
    ok
      ? { ok: true }
      : { ok: false, hint: "AI サーバ (llama.cpp) が応答していません" },
  );
}
