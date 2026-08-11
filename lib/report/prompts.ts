import { getTheme } from "@/lib/dialogue/themes";
import type { ThemeResult } from "@/lib/db/queries";
import type { LlmMessage } from "@/lib/llm/client";
import type { Career } from "@/lib/careers/catalog";

export function collectTags(themeResults: ThemeResult[]): string[] {
  return themeResults.flatMap((r) => r.tags);
}

/** 対話中に前倒し生成済みの気づきカードを、レポート生成の入力用にまとめる */
export function buildStudentProfileText(themeResults: ThemeResult[]): string {
  return themeResults
    .map((r) => {
      const title = getTheme(r.themeId)?.title ?? r.themeId;
      return `【${title}】\n引用: 「${r.quote}」\n言い換え: ${r.reframe}\n要約: ${r.summary}`;
    })
    .join("\n\n");
}

/** ステージA: ストリーミングで流す自己理解サマリ */
export function buildSummaryMessages(profileText: string): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        "あなたは学生向けキャリアレポートを書くメンターです。以下は対話から得られた、この学生についての" +
        "気づきです。これらを一つのストーリーとして繋げ、学生本人に語りかけるように200〜280字程度で" +
        "自己理解のサマリーを書いてください。最初の一文は、この学生の核心を突く印象的な一文にしてください" +
        "（レポートの見出しとして使われます）。決めつけすぎず、しかし芯のある言い方で。" +
        "職業名は出さないこと（職業提案は別セクションで行います）。",
    },
    { role: "user", content: profileText },
  ];
}

/** ステージB: 職種選定＋強み/価値観の構造化出力 */
export function buildSelectionMessages(profileText: string, candidates: Career[]): LlmMessage[] {
  const candidateList = candidates.map((c) => `${c.id}|${c.name}|${c.oneLiner}`).join("\n");

  return [
    {
      role: "system",
      content:
        "あなたは新卒学生向けのキャリアアドバイザーです。以下の学生プロファイルと職種候補リストから、" +
        "この学生に合いそうな職種を6件選んでください。\n\n" +
        "【職種候補】ID|職種名|一言説明\n" +
        candidateList +
        "\n\n【出力してほしいもの】\n" +
        "- strengths: 学生の強みを15字以内で3つ\n" +
        "- values: 学生が大事にしていることを15字以内で3つ\n" +
        "- picks: 上記候補から6件選び、それぞれ id・fitScore(50〜99)・keyLink" +
        "(学生のどの発言と結びつくか、20字以内)\n" +
        "候補リストに無い id は絶対に使わないこと。",
    },
    { role: "user", content: profileText },
  ];
}

/** ステージC: 職種ごとの個別の推薦理由（1件あたり短いプロンプトなので並列化が効く） */
export function buildReasonMessages(career: Career, themeResults: ThemeResult[]): LlmMessage[] {
  const quotes = themeResults
    .filter((r) => r.quote)
    .map((r) => `・「${r.quote}」（${getTheme(r.themeId)?.title ?? r.themeId}）`)
    .join("\n");

  return [
    {
      role: "system",
      content:
        `あなたは新卒学生向けのキャリアアドバイザーです。\n\n【あなたが聞いた学生の言葉】\n${quotes}\n\n` +
        `【職種】${career.name}\n${career.oneLiner}\n\n` +
        "この学生にこの職種を薦める理由を、本人の言葉を1つ「」で引用しながら120字程度で書いてください。" +
        "断定しすぎず、「〜かもしれません」のような余白を残してください。" +
        "理由の本文だけを出力し、前置きや見出しは付けないこと。",
    },
  ];
}
