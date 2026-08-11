import { CAREERS, type Career } from "./catalog";

export interface ScoredCareer {
  career: Career;
  /** 正規化されていない生スコア。学生タグの出現頻度と職業タグの内積（実測レンジ 0〜8程度）。 */
  score: number;
}

export function tallyTags(tags: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tag of tags) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return counts;
}

/**
 * 学生タグ × 職業タグの内積（＋カテゴリヒント +2）でスコア付けし降順に返す。
 * プリフィルタ（18件への絞り込み。lib/careers/prefilter.ts）と、レポート画面の
 * 職業一覧（lib/careers/explore.ts）の両方がこの1つの式を共有する。
 */
export function scoreCareers(studentTags: string[], categoryHints: string[] = []): ScoredCareer[] {
  const counts = tallyTags(studentTags);
  return CAREERS.map((career) => ({
    career,
    score:
      career.tags.reduce((sum, tag) => sum + (counts.get(tag) ?? 0), 0) +
      (categoryHints.includes(career.category) ? 2 : 0),
  })).sort((a, b) => b.score - a.score);
}
