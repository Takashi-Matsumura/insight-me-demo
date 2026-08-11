import { rawCall, type LlmMessage } from "./client";
import { LlmError } from "./errors";
import type { LlmPriority } from "./queue";

export interface JsonSchemaSpec {
  name: string;
  strict: true;
  schema: object;
}

export async function generateStructured<T>(args: {
  messages: LlmMessage[];
  schema: JsonSchemaSpec;
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
  priority?: LlmPriority;
  timeoutMs?: number;
}): Promise<T> {
  const res = await rawCall({
    messages: args.messages,
    maxTokens: args.maxTokens,
    // 構造化出力は低めの温度の方が安定する
    temperature: args.temperature ?? 0.5,
    responseFormat: { type: "json_schema", json_schema: args.schema },
    signal: args.signal,
    priority: args.priority ?? "batch",
    timeoutMs: args.timeoutMs ?? 90_000,
  });

  const json = (await res.json()) as {
    choices?: [{ message?: { content?: string } }];
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new LlmError("BAD_RESPONSE", "AI の応答が空でした");
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new LlmError("BAD_RESPONSE", "AI の応答(JSON)を解析できませんでした");
  }
}
