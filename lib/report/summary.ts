// かんたんまとめ(app/session/[id]/report/summary)用の組み立て。
// LLM は呼ばず、生成済みレポートと気づきカードから決定論的に作る。
// (待ち時間が無く、過去に完了したセッションでもそのまま表示できる)

/**
 * 自己理解サマリの最初の一文を見出しとして取り出す。
 * lib/report/prompts.ts の buildSummaryMessages が「最初の一文は見出しとして使う」と
 * 指示しているので、それをそのまま使う。LLM が混ぜる **強調** は外す。
 */
export function reportHeadline(profileMd: string): string {
  const firstLine =
    profileMd
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line !== "") ?? "";
  const plain = firstLine.replaceAll("**", "");
  // 改行なしで本文が続いている場合は、最初の句点までを見出しとみなす
  const end = plain.indexOf("。");
  return end >= 0 && end < plain.length - 1 ? plain.slice(0, end + 1) : plain;
}

export interface KeywordCount {
  tag: string;
  /** そのタグが付いたテーマの数 */
  count: number;
}

/** テーマごとのタグから、よく出てきた順のキーワードを作る。同数なら先に出てきた順。 */
export function topKeywords(tagsPerTheme: string[][], limit: number): KeywordCount[] {
  const counts = new Map<string, number>();
  for (const tags of tagsPerTheme) {
    for (const tag of new Set(tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
