export type LlmErrorCode =
  | "UNAVAILABLE" // llama.cpp に接続できない（ECONNREFUSED / ECONNRESET）。launchd 再起動中もこれ
  | "TIMEOUT" // 応答が timeoutMs を超えた
  | "ABORTED" // 呼び出し側の signal（クライアント切断など）で中断された
  | "UPSTREAM_ERROR" // llama.cpp が 2xx 以外を返した
  | "BAD_RESPONSE" // 応答の形が想定と違う（JSON parse 失敗など）
  | "UNKNOWN";

export class LlmError extends Error {
  readonly code: LlmErrorCode;

  constructor(code: LlmErrorCode, message: string) {
    super(message);
    this.name = "LlmError";
    this.code = code;
  }
}

/** ユーザー向けの日本語メッセージ。UI はこれをそのまま表示してよい。 */
export function llmErrorMessage(code: LlmErrorCode): string {
  switch (code) {
    case "UNAVAILABLE":
      return "AI サーバに接続できませんでした。自動で復旧を試みています。";
    case "TIMEOUT":
      return "AI の応答が時間内に返りませんでした。";
    case "ABORTED":
      return "中断されました。";
    case "UPSTREAM_ERROR":
      return "AI サーバでエラーが発生しました。";
    case "BAD_RESPONSE":
      return "AI の応答を正しく読み取れませんでした。";
    default:
      return "予期しないエラーが発生しました。";
  }
}
