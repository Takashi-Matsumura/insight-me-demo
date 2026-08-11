import { LlmError } from "./errors";
import { llmQueue, type LlmPriority } from "./queue";

const BASE_URL = process.env.LLAMA_BASE_URL ?? "http://127.0.0.1:8080";
const MODEL = process.env.LLAMA_MODEL ?? "gemma-4-12b-it-Q4_K_M.gguf";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * 呼び出し側に許すのはこれだけ。`chat_template_kwargs` / `model` は
 * 型からも露出させず、buildBody() の1箇所だけで enable_thinking:false を
 * 強制する（付け忘れると対話1往復が思考トークンだけで25秒かかる実測あり）。
 */
export interface LlmRequest {
  messages: LlmMessage[];
  maxTokens: number;
  temperature?: number;
  responseFormat?: unknown;
  stream?: boolean;
  signal?: AbortSignal;
  /** 待ち時間の上限(ms)。既定 90秒 */
  timeoutMs?: number;
  /** interactive=対話（優先）、batch=レポート生成 */
  priority?: LlmPriority;
}

function buildBody(req: LlmRequest) {
  return {
    model: MODEL,
    messages: req.messages,
    max_tokens: req.maxTokens,
    temperature: req.temperature ?? 0.8,
    stream: req.stream ?? false,
    // 実測: これが無いと思考トークンだけで25.4秒。付けると1.5秒。
    chat_template_kwargs: { enable_thinking: false },
    ...(req.responseFormat ? { response_format: req.responseFormat } : {}),
  };
}

export async function rawCall(req: LlmRequest): Promise<Response> {
  const timeoutMs = req.timeoutMs ?? 90_000;
  const timeoutCtl = new AbortController();
  const timer = setTimeout(() => timeoutCtl.abort(new Error("llm-timeout")), timeoutMs);

  const signal = req.signal
    ? AbortSignal.any([req.signal, timeoutCtl.signal])
    : timeoutCtl.signal;

  try {
    return await llmQueue.run(req.priority ?? "batch", async () => {
      const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(req)),
        signal,
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new LlmError(
          "UPSTREAM_ERROR",
          `llama.cpp が ${res.status} を返しました${text ? `: ${text.slice(0, 200)}` : ""}`,
        );
      }
      return res;
    });
  } catch (e) {
    throw toLlmError(e, timeoutCtl.signal.aborted);
  } finally {
    clearTimeout(timer);
  }
}

function toLlmError(e: unknown, timedOut: boolean): LlmError {
  if (e instanceof LlmError) return e;
  // 内部タイムアウトが原因で abort された場合は、実際の例外の形に関わらず TIMEOUT 扱いにする
  if (timedOut) return new LlmError("TIMEOUT", "AI の応答が時間内に返りませんでした");

  const err = e as { name?: string; cause?: { code?: string } };
  if (err?.cause?.code === "ECONNREFUSED" || err?.cause?.code === "ECONNRESET") {
    return new LlmError("UNAVAILABLE", "AI サーバに接続できません");
  }
  if (err?.name === "AbortError") {
    return new LlmError("ABORTED", "中断されました");
  }
  return new LlmError("UNKNOWN", e instanceof Error ? e.message : String(e));
}

/** 非ストリーミングの単発テキスト生成（レポートの個別理由生成などで使う） */
export async function generateText(args: {
  messages: LlmMessage[];
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
  priority?: LlmPriority;
  timeoutMs?: number;
}): Promise<string> {
  const res = await rawCall({ ...args, stream: false });
  const json = (await res.json()) as { choices?: [{ message?: { content?: string } }] };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new LlmError("BAD_RESPONSE", "AI の応答が空でした");
  }
  return content.trim();
}

export async function checkHealth(timeoutMs = 3000): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
