export type ThemeId = "flow" | "people" | "drive" | "edge" | "future";

export interface Theme {
  id: ThemeId;
  order: number;
  title: string;
  /** 最初の問い。固定文なので LLM を呼ばず 0 秒で表示できる */
  opener: string;
  /** このテーマで埋めたい観点。深掘りプロンプトに使う */
  aspects: string[];
  /** 学生が詰まったときに提示する選択肢 */
  fallbackChoices: string[];
  /** 深掘りの上限回数。これに達したら強制的に次テーマへ */
  maxProbes: number;
}

export const THEMES: Theme[] = [
  {
    id: "flow",
    order: 1,
    title: "熱中したこと",
    opener:
      "まずは肩の力を抜いていきましょう。これまでで「気づいたら時間が経っていた」ことを、" +
      "ひとつ教えてください。部活でもゲームでもバイトでも、しょうもないと思うことで大丈夫です。",
    aspects: ["何に熱中したか", "どこが面白かったのか", "自分なりに工夫したこと"],
    fallbackChoices: [
      "ものをつくる・組み立てる",
      "調べて分かるまで掘る",
      "誰かと一緒に何かを動かす",
      "記録・整理して形にする",
      "体を動かす・競う",
    ],
    maxProbes: 3,
  },
  {
    id: "people",
    order: 2,
    title: "人との関わり方",
    opener:
      "次は「まわりとの関わり方」です。グループやチームの中で、あなたはどんな役回りに" +
      "なることが多かったですか？頼まれごとや、気づいたら自分がやっていたこと、でも構いません。",
    aspects: ["集団での役割", "人から頼られる場面", "苦手な関わり方"],
    fallbackChoices: [
      "まとめ役になりがち",
      "裏方で支えることが多い",
      "アイデアを出す係",
      "一人で進めるほうが得意",
      "間に立って調整する",
    ],
    maxProbes: 3,
  },
  {
    id: "drive",
    order: 3,
    title: "嬉しかった・悔しかった",
    opener:
      "ここは少し感情の話です。「これは嬉しかった」または「これは悔しかった」という出来事を" +
      "ひとつ思い出せますか？大きな出来事でなくて大丈夫です。",
    aspects: ["具体的な出来事", "なぜその感情になったのか", "そこから何を大事にするようになったか"],
    fallbackChoices: [
      "人に感謝されたとき",
      "自分の作ったものが認められたとき",
      "目標を達成したとき",
      "力不足を感じたとき",
      "理不尽だと感じたとき",
    ],
    maxProbes: 3,
  },
  {
    id: "edge",
    order: 4,
    title: "得意と苦手",
    opener:
      "「まわりは大変そうにしているのに、自分はわりと平気」ということはありますか？" +
      "逆に「これだけは避けたい」も一緒に教えてください。",
    aspects: ["人より苦にならないこと", "避けたいこと・消耗すること", "その自覚のきっかけ"],
    fallbackChoices: [
      "細かい作業を続けるのは平気",
      "初対面の人と話すのは平気",
      "締め切りに追われるのは平気",
      "数字やデータを見るのは平気",
      "人前に立つのは平気",
    ],
    maxProbes: 2,
  },
  {
    id: "future",
    order: 5,
    title: "これからの一日",
    opener:
      "最後です。5年後、あなたが「今日はいい一日だった」と思って帰る日。その日はどんな一日" +
      "でしたか？職種名じゃなくて、場面を想像してみてください。",
    aspects: ["理想の一日の場面", "一緒にいる人", "避けたい働き方"],
    fallbackChoices: [
      "誰かの反応が直接見える一日",
      "静かに集中できた一日",
      "仲間と何かを作り上げた一日",
      "新しいことを学べた一日",
      "自分のペースで進められた一日",
    ],
    maxProbes: 2,
  },
];

const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]));

export function getTheme(id: string): Theme | undefined {
  return THEME_BY_ID.get(id as ThemeId);
}

export function nextThemeId(currentId: string): ThemeId | null {
  const current = getTheme(currentId);
  if (!current) return null;
  const next = THEMES.find((t) => t.order === current.order + 1);
  return next ? next.id : null;
}

export function isLastTheme(id: string): boolean {
  const theme = getTheme(id);
  return theme?.order === THEMES.length;
}
