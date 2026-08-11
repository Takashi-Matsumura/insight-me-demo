import { CAREERS, type Career } from "./catalog";

export interface PrefilterResult {
  /** LLM に渡す候補（最大18件）。id|name|oneLiner だけを渡して選定させる */
  candidates: Career[];
  /** candidates のうち「学生が知らないだろう」枠として決定論的に確保した id */
  discoveryIds: string[];
}

/**
 * 70件(将来的な拡張後)規模の職業マスタを、LLM に渡す前に18件へ決定論的に絞り込む。
 * 「学生が知らない職種を確実に候補へ入れる」という要件は LLM の気まぐれに委ねず、
 * ここで obscurity ベースに強制的に枠を確保することで保証する。
 */
export function prefilter(studentTags: string[], categoryHints: string[] = []): PrefilterResult {
  const counts = tally(studentTags);
  const scored = CAREERS.map((career) => ({
    career,
    score:
      career.tags.reduce((sum, tag) => sum + (counts.get(tag) ?? 0), 0) +
      (categoryHints.includes(career.category) ? 2 : 0),
  })).sort((a, b) => b.score - a.score);

  // 1) スコア上位10件
  const top = scored.slice(0, 10).map((s) => s.career);
  const topIds = new Set(top.map((c) => c.id));

  // 2) top に含まれないカテゴリから、カテゴリごとに最高スコア1件を最大4件
  const seenCategories = new Set(top.map((c) => c.category));
  const diverse: Career[] = [];
  for (const s of scored) {
    if (diverse.length >= 4) break;
    if (topIds.has(s.career.id) || seenCategories.has(s.career.category)) continue;
    seenCategories.add(s.career.category);
    diverse.push(s.career);
  }
  const diverseIds = new Set(diverse.map((c) => c.id));

  // 3) 発見枠: obscurity>=3 かつスコアがある(=無関係ではない)ものを最大4件
  const discovery: Career[] = [];
  for (const s of scored) {
    if (discovery.length >= 4) break;
    if (topIds.has(s.career.id) || diverseIds.has(s.career.id)) continue;
    if (s.career.obscurity < 3 || s.score <= 0) continue;
    discovery.push(s.career);
  }

  return {
    candidates: [...top, ...diverse, ...discovery],
    discoveryIds: discovery.map((c) => c.id),
  };
}

function tally(tags: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tag of tags) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return counts;
}
