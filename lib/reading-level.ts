// AIが生成する文章のレベル。セッション作成時に確定し、以後は変更しない。
// 適用先は LLM に渡すシステムプロンプトのみ。テーマの固定文(opener/fallbackChoices)や
// 職業マスタの決定論テンプレ(lib/careers/fit.ts の TAG_SCENE)には適用しない。
//
// 注入文言は「読み手は中学生です」ではなく「中学生が読んで分かる文章で書くこと」と
// 書く。前者は各プロンプトのペルソナ行(「新卒学生向けのキャリアアドバイザー」等)と
// 矛盾し、モデルがどちらに従うか不定になるため。

export const READING_LEVELS = [
  "junior_high",
  "high_school",
  "university",
  "professional",
] as const;

export type ReadingLevel = (typeof READING_LEVELS)[number];

/**
 * 未設定・不正値のフォールバック。
 * 既存の6プロンプトは語彙指示ゼロの状態でチューニング済みで、university の指示文は
 * その文体を言語化しただけの実質no-opにしてある。移行前に作られたセッション
 * (ALTER TABLE の DEFAULT で埋まる行)がこれまでと同じ文章を生成し続けるよう、
 * 「以前と同じ挙動」を意味する値として university を選ぶ。
 */
export const FALLBACK_READING_LEVEL: ReadingLevel = "university";

/** トップページのフォームで最初に選ばれている値。アプリの想定利用者は高校生。 */
export const DEFAULT_READING_LEVEL: ReadingLevel = "high_school";

/** UI表示専用の日本語ラベル(lib/tags.ts の TAG_LABELS_JA と同じ役割) */
export const READING_LEVEL_LABEL: Record<ReadingLevel, string> = {
  junior_high: "中学生レベル",
  high_school: "高校生レベル",
  university: "大学生レベル",
  professional: "社会人レベル",
};

/** トップページのラジオに添える短い説明 */
export const READING_LEVEL_HINT: Record<ReadingLevel, string> = {
  junior_high: "むずかしい言葉を使いません",
  high_school: "ふだんの言葉で話します",
  university: "少し抽象的な言葉も使います",
  professional: "仕事で使う言葉のまま話します",
};

interface LevelGuide {
  /** 文章のレベルの一言指定 */
  headline: string;
  /** 語彙・文の組み立て・比喩の指示。行頭の "- " 込み */
  rules: string[];
  /** 対話プロンプト専用。問いの立て方 */
  question: string;
}

const GUIDE: Record<ReadingLevel, LevelGuide> = {
  junior_high: {
    headline: "中学生が読んで分かる文章で書くこと。",
    rules: [
      "- 中学生が習う漢字の範囲で書き、それを超える語はひらがなか易しい言葉に置き換える。",
      "- カタカナのビジネス用語(スキル、マネジメント、コミット、リソースなど)は使わない。",
      "- 抽象語(価値観、主体性、再現性など)は使わず、「どうしたか」「どう思ったか」で言い表す。",
      "- 一文には言いたいことを1つだけ入れ、読点でつなぎすぎない。",
      "- たとえ話は、学校・部活・家など身近な場面から選ぶ。",
      "- 話しかけるような、やわらかい敬体で書く。",
    ],
    question: "- 質問は「そのときどうしましたか？」のように、やったことや場面をそのまま聞く。",
  },
  high_school: {
    headline: "高校生が読んで分かる文章で書くこと。",
    rules: [
      "- 高校生が日常的に読む言葉で書く。常用漢字の範囲に収める。",
      "- 業界用語・ビジネス用語は避ける。どうしても必要なら、その場で短く言い添える。",
      "- 抽象語を使うときは、必ず具体的な場面とセットにする。",
      "- 修飾を重ねすぎず、素直な語順で書く。",
      "- たとえ話は、授業・部活・アルバイト・友人関係など、本人が経験しうる範囲から選ぶ。",
      "- 敬体で、対等に話す。子ども扱いはしない。",
    ],
    question: "- 質問は具体的な場面を聞く。「自己分析」「キャリア」といった言葉は使わない。",
  },
  university: {
    headline: "大学生が読んで分かる文章で書くこと。",
    rules: [
      "- 一般的な大学生が読む語彙で書く。常用漢字と、広く通じるカタカナ語まで。",
      "- 業界固有の専門用語は避けるが、「役割」「裁量」「再現性」程度の抽象語は使ってよい。",
      "- 一文に2つ以上の主張を詰め込まない。",
      "- たとえ話は、ゼミ・サークル・インターン・アルバイトなどから選ぶ。",
      "- 敬体。ていねいだが、まわりくどくしない。",
    ],
    question: "- 質問は場面を軸にしつつ、本人がそのとき何を選んだかまで踏み込んでよい。",
  },
  professional: {
    headline: "社会人向けの文章として書くこと。",
    rules: [
      "- 社会人が読み慣れた語彙で書く。一般的なビジネス用語(役割、裁量、意思決定、再現性、成果)はそのまま使ってよい。",
      "- 平易さより正確さを優先する。ただし業界の隠語やバズワードは避ける。",
      "- 一文を長めに取ってよいが、係り受けは明確にする。",
      "- たとえ話は、チーム・顧客・締切・引き継ぎなど仕事の現場から選ぶ。",
      "- 敬体。過度に励まさず、観察したことを淡々と書く。",
    ],
    question: "- 質問は場面に加えて、そのときの判断の分かれ目まで踏み込んでよい。",
  },
};

/**
 * 全レベル共通の最終行。レベル調整が既存の字数指示(20〜40字、8〜16字、50〜70字…)や
 * 引用の忠実性を壊さないための優先順位を明示する。
 * 「やさしい言葉に直す」指示が学生本人の発言の引用を書き換えてしまうのが
 * この機能の最大の副作用なので、この1行は省略しないこと。
 */
const GUARD =
  "※ 上のレベル調整より、指定された字数と引用のルールを優先すること。" +
  "学生本人の言葉を引用する箇所は、読みやすくするための言い換えもしないこと。";

/** buildTurnSystemPrompt 用。問いの立て方の指示を含む。 */
export function readingLevelDialogueBlock(level: ReadingLevel): string {
  const g = GUIDE[level];
  return ["【文章のレベル】", g.headline, ...g.rules, g.question, GUARD].join("\n");
}

/** 気づきカード・レポート系(生成物を学生が読む)プロンプト用。 */
export function readingLevelWritingBlock(level: ReadingLevel): string {
  const g = GUIDE[level];
  return ["【文章のレベル】", g.headline, ...g.rules, GUARD].join("\n");
}

/** DB の値・フォーム入力・未設定のいずれでも必ず有効な値を返す。 */
export function normalizeReadingLevel(value: unknown): ReadingLevel {
  return typeof value === "string" &&
    (READING_LEVELS as readonly string[]).includes(value)
    ? (value as ReadingLevel)
    : FALLBACK_READING_LEVEL;
}
