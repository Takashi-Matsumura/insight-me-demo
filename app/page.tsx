import {
  DEFAULT_READING_LEVEL,
  READING_LEVELS,
  READING_LEVEL_HINT,
  READING_LEVEL_LABEL,
} from "@/lib/reading-level";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <main className="w-full max-w-md">
        <p className="text-sm font-medium text-accent">InsightMe</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
          本当の自分と、
          <br />
          これからの仕事を見つける。
        </h1>
        <p className="mt-4 text-muted leading-relaxed">
          AIとの短い対話を通じて、あなた自身の経験や価値観を振り返ります。
          最後に、あなたに合いそうな職業の候補をいくつか提案します。
          所要時間は10〜15分ほどです。
        </p>

        <form
          action="/session/new"
          method="POST"
          className="mt-8 flex flex-col gap-3"
        >
          <label htmlFor="studentName" className="text-sm font-medium">
            お名前（ニックネームでも大丈夫です）
          </label>
          <input
            id="studentName"
            name="studentName"
            type="text"
            required
            maxLength={40}
            placeholder="例：山田 太郎"
            className="rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-accent"
          />

          <fieldset className="mt-4">
            <legend className="text-sm font-medium">AIが話す文章のレベル</legend>
            <p className="mt-1 text-xs text-muted">
              ふだん読んでいる文章に近いものを選んでください。あとから変更はできません。
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {READING_LEVELS.map((level) => (
                <label
                  key={level}
                  className={
                    "cursor-pointer rounded-lg border border-border bg-card px-3 py-2.5 transition-colors " +
                    "hover:border-accent " +
                    "has-[:checked]:border-accent has-[:checked]:bg-accent/10 " +
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
                  }
                >
                  <input
                    type="radio"
                    name="readingLevel"
                    value={level}
                    defaultChecked={level === DEFAULT_READING_LEVEL}
                    className="sr-only"
                  />
                  <span className="block text-sm font-medium">
                    {READING_LEVEL_LABEL[level]}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {READING_LEVEL_HINT[level]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            className="mt-2 rounded-lg bg-accent px-4 py-3 font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            はじめる
          </button>
        </form>

        <p className="mt-6 text-xs text-muted">
          入力内容はこの端末上のデータベースに保存され、メンターが後から確認できます。
        </p>
      </main>
    </div>
  );
}
