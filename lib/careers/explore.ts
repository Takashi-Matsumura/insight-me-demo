import { scoreCareers } from "./scoring";
import { CATEGORIES, getCategoryLabel } from "./catalog";
import { tagLabel } from "@/lib/tags";
import { buildCareerFit, type CareerFit, type FitEvidence } from "./fit";

// クライアントコンポーネント（CareerExplorer / CareerDialog）は型だけを import する。
// 値を import すると catalog.ts 経由で data/careers.json 90KB がクライアントバンドルに
// 入ってしまうため。isolatedModules: true なので `export type` 構文が必須。
export type { CareerFit, FitHighlight, FitEvidence } from "./fit";

export interface CareerExplorerItem {
  careerId: string;
  name: string;
  categoryId: string;
  categoryLabel: string;
  oneLiner: string;
  obscurity: number;
  /** 0〜100。重なりタグが1つも無い場合は0（UI側で "—" 表示にする） */
  matchPct: number;
  /** 重なったタグの日本語ラベル */
  matchedTagLabels: string[];

  // ---- ここから下はダイアログ（CareerDialog）専用。一覧行では使わない ----
  detail: string;
  goodFit: string;
  dayInLife: string;
  skills: string[];
  nextStep: string;
  relatedMajors: string[];
  /** 「あなたの力が活きそうなところ」。evidenceIndex は ExplorerData.evidences を指す */
  fit: CareerFit;
}

export interface ExplorerCategory {
  id: string;
  label: string;
  count: number;
}

/** fit の学生側の根拠になる入力。report ページが theme_results / report から組み立てる */
export interface ExplorerInput {
  studentTags: string[];
  /** 「あなたに合いそうな仕事」6件。一覧から除外する */
  excludeIds: string[];
  /** 気づきカード。fit の第一候補になる */
  insights: { themeTitle: string; label: string; reframe: string; tags: string[] }[];
  /** report.strengths。気づきカードに該当タグが無いときの受け皿。生成前は [] */
  strengths: string[];
}

export interface ExplorerData {
  items: CareerExplorerItem[];
  categories: ExplorerCategory[];
  /**
   * fit.highlights[].evidenceIndex の参照先。
   * reframe(50〜70字) は最大5種類しか存在しないのに、素朴に埋め込むと64件×2回＝
   * 最大128回重複するため、ここへ正規化して RSC ペイロードを節約する。
   */
  evidences: FitEvidence[];
}

/**
 * 「あなたに合いそうな仕事」6件(excludeIds)以外の職業を、学生タグとの重なり率(%)と
 * 「あなたの力が活きそうなところ」付きで返す。
 * 重なり率 = 重複を除いた「学生タグ ∩ 職業タグ」の件数 / 職業タグ数。
 * (生スコアは頻度加算のため職業タグ数を超えうる。100%を超えないよう Set の積集合で計算する)
 *
 * LLM を一切呼ばない。theme_results だけから決定論的に導けるので、
 * レポート生成中でも、AIサーバが落ちていても、過去の完了済みセッションでも同じ結果になる。
 */
export function buildExplorer(input: ExplorerInput): ExplorerData {
  const { evidences, byTag, fallbackIndexes } = buildEvidences(input);

  const excluded = new Set(input.excludeIds);
  const uniqueTags = new Set(input.studentTags);
  const scored = scoreCareers(input.studentTags);

  const items = scored
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
        categoryLabel: getCategoryLabel(s.career.category),
        oneLiner: s.career.oneLiner,
        obscurity: s.career.obscurity,
        matchPct: pct,
        matchedTagLabels: matched.map(tagLabel),
        detail: s.career.detail,
        goodFit: s.career.goodFit,
        dayInLife: s.career.dayInLife,
        skills: s.career.skills,
        nextStep: s.career.nextStep,
        relatedMajors: s.career.relatedMajors,
        fit: buildCareerFit(matched, byTag, fallbackIndexes),
      };
    })
    .sort((a, b) => b.matchPct - a.matchPct || a.name.localeCompare(b.name, "ja"));

  const categories = CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    count: items.filter((i) => i.categoryId === c.id).length,
  })).filter((c) => c.count > 0);

  return { items, categories, evidences };
}

function buildEvidences(input: ExplorerInput): {
  evidences: FitEvidence[];
  byTag: Map<string, number[]>;
  fallbackIndexes: number[];
} {
  const evidences: FitEvidence[] = [];
  const byTag = new Map<string, number[]>();

  // 第一候補: 気づきカード。reframe は対話直後に LLM が書いた「その学生専用の一文」なので、
  // ここを引くだけで、新たに LLM を呼ばずに個別性のある文章になる。
  for (const ins of input.insights) {
    const idx =
      evidences.push({ label: ins.label, detail: ins.reframe, source: ins.themeTitle }) - 1;
    for (const tag of ins.tags) {
      const arr = byTag.get(tag);
      if (arr) arr.push(idx);
      else byTag.set(tag, [idx]);
    }
  }

  // 受け皿: report.strengths（タグ紐付けが無いので byTag には入れない）
  const fallbackIndexes: number[] = [];
  for (const s of input.strengths) {
    fallbackIndexes.push(
      evidences.push({ label: s, detail: null, source: "あなたの強み" }) - 1,
    );
  }

  return { evidences, byTag, fallbackIndexes };
}
