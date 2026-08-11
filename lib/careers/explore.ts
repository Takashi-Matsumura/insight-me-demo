import { scoreCareers } from "./scoring";
import { CATEGORIES } from "./catalog";
import { tagLabel } from "@/lib/tags";

export interface CareerExplorerItem {
  careerId: string;
  name: string;
  categoryId: string;
  oneLiner: string;
  obscurity: number;
  /** 0〜100。重なりタグが1つも無い場合は0（UI側で "—" 表示にする） */
  matchPct: number;
  /** 重なったタグの日本語ラベル */
  matchedTagLabels: string[];
}

export interface ExplorerCategory {
  id: string;
  label: string;
  count: number;
}

/**
 * 「あなたに合いそうな仕事」6件(excludeIds)以外の職業を、学生タグとの重なり率(%)付きで返す。
 * 重なり率 = 重複を除いた「学生タグ ∩ 職業タグ」の件数 / 職業タグ数。
 * (生スコアは頻度加算のため職業タグ数を超えうる。100%を超えないよう Set の積集合で計算する)
 */
export function buildExplorerItems(
  studentTags: string[],
  excludeIds: string[],
): CareerExplorerItem[] {
  const excluded = new Set(excludeIds);
  const uniqueTags = new Set(studentTags);
  const scored = scoreCareers(studentTags);

  return scored
    .filter((s) => !excluded.has(s.career.id))
    .map((s) => {
      const matched = s.career.tags.filter((t) => uniqueTags.has(t));
      const pct =
        s.career.tags.length > 0
          ? Math.round((matched.length / s.career.tags.length) * 100)
          : 0;
      return {
        careerId: s.career.id,
        name: s.career.name,
        categoryId: s.career.category,
        oneLiner: s.career.oneLiner,
        obscurity: s.career.obscurity,
        matchPct: pct,
        matchedTagLabels: matched.map(tagLabel),
      };
    })
    .sort((a, b) => b.matchPct - a.matchPct || a.name.localeCompare(b.name, "ja"));
}

export function explorerCategories(items: CareerExplorerItem[]): ExplorerCategory[] {
  return CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    count: items.filter((i) => i.categoryId === c.id).length,
  })).filter((c) => c.count > 0);
}
