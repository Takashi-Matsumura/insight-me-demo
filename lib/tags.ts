// 学生の気づきカード（lib/dialogue/schemas.ts）と職業マスタ（data/careers.json）を
// つなぐ共通の特性タグ語彙。LLM の出力・スキーマの enum・プリフィルタのスコアリング
// すべてがこの語彙に閉じることで、実在しないタグでマッチングが壊れるのを防ぐ。
export const TAG_VOCAB = [
  "people",
  "data",
  "things",
  "ideas",
  "art",
  "nature",
  "lead",
  "support",
  "analyze",
  "create",
  "organize",
  "negotiate",
  "office",
  "field",
  "lab",
  "customer",
  "remote",
  "global",
  "growth",
  "stability",
  "impact",
  "craft",
  "autonomy",
  "team",
] as const;

export type Tag = (typeof TAG_VOCAB)[number];

/** UI 表示専用の日本語ラベル。マッチング用の内部値(Tag)は英語のまま扱う。 */
export const TAG_LABELS_JA: Record<Tag, string> = {
  people: "人",
  data: "データ",
  things: "モノ",
  ideas: "アイデア",
  art: "表現",
  nature: "自然",
  lead: "主導",
  support: "支援",
  analyze: "分析",
  create: "創造",
  organize: "整理",
  negotiate: "交渉",
  office: "オフィス",
  field: "現場",
  lab: "研究",
  customer: "顧客対応",
  remote: "リモート",
  global: "グローバル",
  growth: "成長志向",
  stability: "安定志向",
  impact: "社会的インパクト",
  craft: "職人気質",
  autonomy: "自律",
  team: "チームワーク",
};

export function tagLabel(tag: string): string {
  return TAG_LABELS_JA[tag as Tag] ?? tag;
}
