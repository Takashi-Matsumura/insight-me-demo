import type { JsonSchemaSpec } from "@/lib/llm/structured";

export interface CareerPick {
  id: string;
  fitScore: number;
  keyLink: string;
}

export interface CareerSelectionResult {
  strengths: string[];
  values: string[];
  picks: CareerPick[];
}

/**
 * ステージB: 自己理解サマリ(ステージA)と並列実行する構造化出力。
 * 職種の説明文は careers.json に既にあるので生成させない。
 * ここで作らせるのは「選定」と「学生固有の結びつけ(keyLink)」だけに絞り、
 * 出力トークン数を抑えて速度を確保する。
 */
export const CAREER_SELECTION_SCHEMA: JsonSchemaSpec = {
  name: "career_selection",
  strict: true,
  schema: {
    type: "object",
    properties: {
      strengths: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
        description: "学生の強み。15字以内で3つ。",
      },
      values: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
        description: "学生が大事にしていること。15字以内で3つ。",
      },
      picks: {
        type: "array",
        minItems: 6,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "候補リストにある id をそのまま使う" },
            fitScore: { type: "integer", minimum: 50, maximum: 99 },
            keyLink: { type: "string", description: "学生のどの発言と結びつくか。20字以内" },
          },
          required: ["id", "fitScore", "keyLink"],
          additionalProperties: false,
        },
      },
    },
    required: ["strengths", "values", "picks"],
    additionalProperties: false,
  },
};
