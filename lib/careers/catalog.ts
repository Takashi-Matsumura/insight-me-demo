import careersData from "@/data/careers.json";
import { TAG_VOCAB, type Tag } from "@/lib/tags";

export interface CareerCategory {
  id: string;
  label: string;
}

export interface Career {
  id: string;
  name: string;
  category: string;
  oneLiner: string;
  detail: string;
  goodFit: string;
  skills: string[];
  dayInLife: string;
  tags: Tag[];
  obscurity: number;
  nextStep: string;
  relatedMajors: string[];
}

interface CareersFile {
  version: number;
  tagVocab: string[];
  categories: CareerCategory[];
  careers: Career[];
}

const data = careersData as CareersFile;

export const CATEGORIES: CareerCategory[] = data.categories;
export const CAREERS: Career[] = data.careers;

const CATEGORY_LABELS = new Map(CATEGORIES.map((c) => [c.id, c.label]));
const CAREER_BY_ID = new Map(CAREERS.map((c) => [c.id, c]));

export function getCareerById(id: string): Career | undefined {
  return CAREER_BY_ID.get(id);
}

export function getCategoryLabel(categoryId: string): string {
  return CATEGORY_LABELS.get(categoryId) ?? categoryId;
}

// careers.json は人手(LLM生成)で作られているため、tags/category の綴りミスが
// マッチングロジックを静かに壊さないよう、読み込み時に軽く検証しておく。
function validateCatalog(): void {
  const categoryIds = new Set(CATEGORIES.map((c) => c.id));
  const tagSet = new Set<string>(TAG_VOCAB);
  const seenIds = new Set<string>();

  for (const career of CAREERS) {
    if (seenIds.has(career.id)) {
      throw new Error(`data/careers.json: id が重複しています: ${career.id}`);
    }
    seenIds.add(career.id);

    if (!categoryIds.has(career.category)) {
      throw new Error(
        `data/careers.json: 不正な category です (${career.id}: ${career.category})`,
      );
    }
    for (const tag of career.tags) {
      if (!tagSet.has(tag)) {
        throw new Error(`data/careers.json: 不正な tag です (${career.id}: ${tag})`);
      }
    }
  }
}

validateCatalog();
