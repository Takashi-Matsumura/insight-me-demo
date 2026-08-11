// 学生タグ × 職業タグの「重なり」を、学生に読める日本語へ開くための対応表。
// 職業側の文言だけを手書きで持ち、学生側は theme_results.reframe（LLM が対話直後に
// 生成済みの、その学生専用の言い換え文）をそのまま引くことで、新たに LLM を呼ばずに
// 「その人向けの文章」を成立させる。
//
// このファイルは data/careers.json に一切依存しない（クライアントに混ざっても安全な粒度）。
// @/lib/tags 以外を import しないこと — catalog.ts を import すると
// data/careers.json 90KB を巻き込む経路ができてしまう。
import { tagLabel, type Tag } from "@/lib/tags";

/** タグ → その仕事における「あなたの力が活きそうな場面」。
 *  Record<Tag, string> にしているので、TAG_VOCAB に語を足すと tsc が未定義を検出する。
 *  すべて「〜場面」で終える（文テンプレに機械的に差し込むため）。 */
export const TAG_SCENE: Record<Tag, string> = {
  // 何をするか（動詞系）
  lead: "進む方向を決めて、まわりを引っぱっていく場面",
  support: "誰かの手が届いていないところを、先回りして支える場面",
  analyze: "情報や数字を突き合わせて、筋の通る答えを出す場面",
  create: "まだ形になっていないものを、自分なりに形にしていく場面",
  organize: "散らばった段取りや情報を、抜け漏れなく整えていく場面",
  negotiate: "立場のちがう相手と話をつけて、着地点を見つける場面",
  // 何と向き合うか（対象系）
  people: "相手の話を引き出して、信頼を積み上げていく場面",
  data: "数字の動きから「なぜそうなるのか」を読み解く場面",
  things: "実物に触れながら、確かめて手を動かす場面",
  ideas: "まだ誰も言っていない切り口を、考えて持ち込む場面",
  art: "見え方や伝わり方を、感覚と理屈の両方で詰めていく場面",
  nature: "自然や生き物を相手に、時間をかけて向き合う場面",
  // どこで働くか（環境系）
  customer: "使う人の顔が見えるところで、反応を直接受け取る場面",
  field: "机の上ではなく現場に出て、その場で判断する場面",
  lab: "検証を何度も重ねて、確からしさを積み上げていく場面",
  office: "落ち着いた環境で、資料や仕組みとじっくり向き合う場面",
  remote: "離れた相手にも、書いて伝えて仕事を進める場面",
  global: "文化や言葉のちがう相手と、ひとつの仕事を進める場面",
  team: "役割を分け合いながら、チーム全体を前に進める場面",
  // 何を得られるか（志向系）
  growth: "新しいことを覚えて、できることを増やしていく場面",
  stability: "決められた手順を崩さず、正確に回し続ける場面",
  impact: "自分の仕事が誰かの助けになっていると実感できる場面",
  craft: "細部の質に、納得がいくまでこだわれる場面",
  autonomy: "進め方を自分で決めて、自分のペースで動ける場面",
};

/**
 * 「見出しに選ぶタグ」の優先順。先頭ほど優先。
 * 2つの基準を手で織り込んである:
 *  1) 「力が発揮できる場面」として語りやすい順（動詞系 > 対象系 > 環境系 > 志向系）
 *  2) 職業マスタ70件での出現頻度が低い順（珍しいタグを先に出すと、職業ごとの文面が散る）
 * 実測の出現数: analyze:39 organize:25 office:21 stability:18 people:16 things:15
 *              create:14 data:13 ideas:13 lead:12 field/support/team/impact:11
 *              customer/autonomy:10 negotiate:8 growth/global:7 lab:6 craft:5
 *              art:4 remote:2 nature:0
 * analyze / organize / office / stability を後ろに置いているのは、これらが
 * 半数近くの職業に付いていて、先頭に出すと全職業が同じ文面になってしまうため。
 */
const TAG_PRIORITY: Tag[] = [
  "art", "craft", "negotiate", "lead", "create", "nature", "lab", "global",
  "support", "data", "things", "ideas", "people", "analyze",
  "field", "customer", "impact", "autonomy", "growth", "team",
  "organize", "remote", "office", "stability",
];
const RANK = new Map(TAG_PRIORITY.map((t, i) => [t as string, i]));

/** 学生側の根拠。気づきカード1枚 or report.strengths の1つに対応する。 */
export interface FitEvidence {
  /** 見出し。気づきカードの label（8〜16字）or 強み（15字以内） */
  label: string;
  /** 補足。気づきカードの reframe（50〜70字）。強み由来のときは null */
  detail: string | null;
  /** 出所。テーマ名 or 「あなたの強み」 */
  source: string;
}

export interface FitHighlight {
  tag: Tag;
  tagLabel: string;
  scene: string;
  /** ExplorerData.evidences への index。無ければ null */
  evidenceIndex: number | null;
}

export interface CareerFit {
  /** 0〜2件 */
  highlights: FitHighlight[];
  /** highlights が空（＝重なりゼロ）のときだけ入る一言 */
  fallbackNote: string | null;
}

const NO_OVERLAP_NOTE =
  "いまのあなたのキーワードとの重なりは少なめです。だからこそ、知らなかった選択肢として" +
  "眺めてみてください。「自分には無さそう」と感じた理由のほうが、ヒントになることもあります。";

export function buildCareerFit(
  /** 学生タグ ∩ 職業タグ（explore.ts で計算済みのもの） */
  matchedTags: string[],
  /** タグ → 気づきカードの index 群 */
  evidenceIndexByTag: Map<string, number[]>,
  /** タグに紐づかない受け皿（report.strengths 由来の index 群） */
  fallbackEvidenceIndexes: number[],
): CareerFit {
  const ordered = [...matchedTags].sort(
    (a, b) => (RANK.get(a) ?? 99) - (RANK.get(b) ?? 99),
  );

  const highlights: FitHighlight[] = [];
  const used = new Set<number>(); // 1つの職業で同じ気づきカードを2回出さない

  for (const tag of ordered) {
    if (highlights.length >= 2) break;
    const scene = TAG_SCENE[tag as Tag];
    if (!scene) continue;

    let idx = (evidenceIndexByTag.get(tag) ?? []).find((i) => !used.has(i));
    // 1本目だけは、タグ直結の気づきが無くても強みで埋める（空振りを避ける）
    if (idx === undefined && highlights.length === 0) {
      idx = fallbackEvidenceIndexes.find((i) => !used.has(i));
    }
    if (idx !== undefined) used.add(idx);

    highlights.push({
      tag: tag as Tag,
      tagLabel: tagLabel(tag),
      scene,
      evidenceIndex: idx ?? null,
    });
  }

  return {
    highlights,
    fallbackNote: highlights.length === 0 ? NO_OVERLAP_NOTE : null,
  };
}
