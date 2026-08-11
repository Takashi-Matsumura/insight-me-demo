import type { ReactNode } from "react";

// LLM が自発的に混ぜてくる **強調** だけを対象にした最小パーサー。
// 追加依存を持ち込まないための割り切りで、見出し(#)・箇条書き(-)・リンクは扱わない
// （lib/report/prompts.ts / lib/dialogue/prompts.ts は markdown を指示していないため）。
// 行をまたぐ ** は誤爆の温床なので [^\n] に限定する。
const BOLD_PATTERN = /\*\*([^\n]+?)\*\*/g;

/**
 * テキストに含まれる `**強調**` を <strong> に変換し、それ以外はそのまま返す。
 * ストリーミング中に閉じていない `**` は一瞬 literal に見えるが、閉じた瞬間に
 * 自己修復される（許容仕様）。
 */
export function renderBold(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const m of text.matchAll(BOLD_PATTERN)) {
    const start = m.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    nodes.push(
      <strong key={`b${key++}`} className="font-semibold">
        {m[1]}
      </strong>,
    );
    last = start + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return nodes;
}
