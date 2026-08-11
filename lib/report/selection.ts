import { getCareerById, type Career } from "@/lib/careers/catalog";
import type { CareerPick } from "./schemas";

export interface ValidatedPick {
  id: string;
  fitScore: number;
}

/**
 * LLM が返した id をカタログで検証し、無効・重複な id は破棄する。
 * 実在しない職種を出さないための最後の砦。不足分はプリフィルタの上位から
 * 補填し、常にちょうど6件を返す。
 */
export function validateAndBackfillPicks(
  picks: CareerPick[],
  fallbackCandidates: Career[],
): ValidatedPick[] {
  const seen = new Set<string>();
  const valid: ValidatedPick[] = [];

  for (const pick of picks) {
    if (seen.has(pick.id) || !getCareerById(pick.id)) continue;
    seen.add(pick.id);
    valid.push({ id: pick.id, fitScore: clampScore(pick.fitScore) });
  }

  for (const career of fallbackCandidates) {
    if (valid.length >= 6) break;
    if (seen.has(career.id)) continue;
    seen.add(career.id);
    valid.push({ id: career.id, fitScore: 70 });
  }

  return valid.slice(0, 6);
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 70;
  return Math.min(99, Math.max(50, Math.round(score)));
}
