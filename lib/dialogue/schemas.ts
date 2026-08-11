import { TAG_VOCAB } from "@/lib/tags";
import type { JsonSchemaSpec } from "@/lib/llm/structured";

export interface InsightCardResult {
  quote: string;
  label: string;
  reframe: string;
  tags: string[];
  summary: string;
}

export const INSIGHT_SCHEMA: JsonSchemaSpec = {
  name: "insight_card",
  strict: true,
  schema: {
    type: "object",
    properties: {
      quote: {
        type: "string",
        description: "学生本人の発言からの引用。20〜40字。学生の言葉を改変しない。",
      },
      label: {
        type: "string",
        description: "その人らしさを表す短い見出し。8〜16字。",
      },
      reframe: {
        type: "string",
        description: "引用を職業的な強みとして言い換えた一文。50〜70字。",
      },
      tags: {
        type: "array",
        items: { type: "string", enum: [...TAG_VOCAB] },
        minItems: 2,
        maxItems: 5,
      },
      summary: {
        type: "string",
        description: "このテーマでの回答を80字程度で要約。後続の分析で使う。",
      },
    },
    required: ["quote", "label", "reframe", "tags", "summary"],
    additionalProperties: false,
  },
};
