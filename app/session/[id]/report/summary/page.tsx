import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getReport,
  getSession,
  listCareerMatches,
  listThemeResults,
} from "@/lib/db/queries";
import { getCareerById, getCategoryLabel } from "@/lib/careers/catalog";
import { reportHeadline, topKeywords } from "@/lib/report/summary";
import { tagLabel } from "@/lib/tags";
import styles from "./summary.module.css";

export const dynamic = "force-dynamic";

const TOP_CAREERS = 3;
const TOP_KEYWORDS = 4;

// くわしいレポートの「あなたに合いそうな仕事」と同じ並び(rank 順)の先頭から出す。
// rank は適合度の高い順とは限らないので、順位(○位)は書かない。
// 適合度リング(viewBox 40×40)の半径と円周
const RING_R = 16;
const RING_C = 2 * Math.PI * RING_R;

// 強みの三角形(viewBox 100×70)の頂点と、その横に置く言葉の枠
const STRENGTH_SLOTS = [
  { cx: 50, cy: 12, box: { x: 57, y: 3, width: 43, height: 18 }, align: "left" },
  { cx: 20, cy: 46, box: { x: 0, y: 53, width: 44, height: 17 }, align: "center" },
  { cx: 80, cy: 46, box: { x: 56, y: 53, width: 44, height: 17 }, align: "center" },
] as const;

/**
 * かんたんまとめ。くわしいレポート(../page.tsx)を1画面に要約したもの。
 * 学生が画面ごとスマホで写真に撮って持ち帰る前提なので、スクロールなしで収める。
 */
export default async function ReportSummaryPage({
  params,
}: PageProps<"/session/[id]/report/summary">) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) notFound();

  const report = getReport(id);
  if (session.status !== "completed" || report?.status !== "complete") {
    return (
      <div className="flex flex-1 flex-col px-6 py-10">
        <main className="mx-auto w-full max-w-2xl">
          <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted">
            かんたんまとめは、レポートができあがると見られるようになります。
          </p>
          <Link
            href={`/session/${id}/report`}
            className="mt-4 inline-block text-sm text-accent underline"
          >
            レポートに戻る
          </Link>
        </main>
      </div>
    );
  }

  const answered = listThemeResults(id).filter((r) => !r.skipped && r.tags.length > 0);
  const keywords = topKeywords(
    answered.map((r) => r.tags),
    TOP_KEYWORDS,
  );

  const careers = listCareerMatches(id)
    .flatMap((m) => {
      const career = getCareerById(m.careerId);
      return career
        ? [
            {
              fitScore: m.fitScore,
              name: career.name,
              categoryLabel: getCategoryLabel(career.category),
            },
          ]
        : [];
    })
    .slice(0, TOP_CAREERS);

  return (
    <div className={styles.stage}>
      <div className={styles.bar}>
        <Link href={`/session/${id}/report`}>← くわしいレポートを見る</Link>
        <span>この画面をスマホで写真にとっておくと、あとで見返せます</span>
      </div>

      <main className={styles.board}>
        <header className={styles.header}>
          <span>
            <span className={styles.name}>{session.studentName} さん</span> のまとめ
          </span>
          <span>InsightMe</span>
        </header>

        <section className={styles.hero}>
          <p className={styles.label}>
            <StarIcon />
            あなたは、こんな人
          </p>
          <p className={styles.headline}>{reportHeadline(report.profileMd)}</p>
        </section>

        <div className={styles.middle}>
          <section className={`${styles.panel} ${styles.strengths}`}>
            <p className={styles.label}>
              <TriangleIcon />
              あなたの強み
            </p>
            <div className={styles.triangle}>
              <svg viewBox="0 0 100 70">
                <polygon className={styles.triangleEdge} points="50,12 20,46 80,46" />
                <text className={styles.triangleCenter} x="50" y="37" textAnchor="middle">
                  強み
                </text>
                {STRENGTH_SLOTS.map((slot, i) => (
                  <g key={i}>
                    <circle className={styles.triangleNode} cx={slot.cx} cy={slot.cy} r="4.6" />
                    <text
                      className={styles.triangleNodeText}
                      x={slot.cx}
                      y={slot.cy + 1.4}
                      textAnchor="middle"
                    >
                      {i + 1}
                    </text>
                    {/* 言葉は折り返せるよう HTML で置く。foreignObject なので図と一緒に拡縮する */}
                    <foreignObject {...slot.box}>
                      <p className={styles.strength} style={{ textAlign: slot.align }}>
                        {report.strengths[i]}
                      </p>
                    </foreignObject>
                  </g>
                ))}
              </svg>
            </div>
          </section>

          <section className={styles.panel}>
            <p className={styles.label}>
              <HeartIcon />
              大事にしていること
            </p>
            <ul className={styles.list}>
              {report.values.map((value) => (
                <li key={value} className={styles.value}>
                  <HeartIcon />
                  {value}
                </li>
              ))}
            </ul>
          </section>

          {keywords.length > 0 && (
            <section className={styles.panel}>
              <p className={styles.label}>
                <DotsIcon />
                よく出てきたキーワード
              </p>
              <ul className={styles.list}>
                {keywords.map((k) => (
                  <li key={k.tag} className={styles.keyword}>
                    {tagLabel(k.tag)}
                    <span
                      className={styles.dots}
                      role="img"
                      aria-label={`${answered.length}テーマ中${k.count}回`}
                    >
                      {answered.map((r, i) => (
                        <span
                          key={r.themeId}
                          className={`${styles.dot} ${i < k.count ? styles.dotOn : ""}`}
                        />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={styles.note}>
                ● の数 ＝ {answered.length}つのテーマのうち、出てきた回数
              </p>
            </section>
          )}
        </div>

        {careers.length > 0 && (
          <section>
            <p className={styles.label}>
              <CompassIcon />
              あなたに合いそうな仕事
            </p>
            <ol className={styles.careers}>
              {careers.map((career) => (
                <li key={career.name} className={styles.career}>
                  <FitRing score={career.fitScore} />
                  <div className="min-w-0">
                    <p className={styles.careerCategory}>{career.categoryLabel}</p>
                    <p className={styles.careerName}>{career.name}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}

/** 適合度を円の埋まり具合で見せる。数値は中央に必ず併記する */
function FitRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  return (
    <svg className={styles.ring} viewBox="0 0 40 40" role="img" aria-label={`適合度 ${score}`}>
      <circle className={styles.ringTrack} cx="20" cy="20" r={RING_R} />
      <circle
        className={styles.ringValue}
        cx="20"
        cy="20"
        r={RING_R}
        strokeDasharray={`${(RING_C * pct) / 100} ${RING_C}`}
        transform="rotate(-90 20 20)"
      />
      <text className={styles.ringNumber} x="20" y="22.5" textAnchor="middle">
        {score}
      </text>
      <text className={styles.ringUnit} x="20" y="29.5" textAnchor="middle">
        適合度
      </text>
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6L2.5 9.5l6.6-.9z" />
    </svg>
  );
}

function TriangleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3.5l9.5 16.5h-19z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 21s-7.5-4.6-9.6-9.4C.9 8 3 4.5 6.6 4.5c2 0 3.6 1 5.4 3 1.8-2 3.4-3 5.4-3C21 4.5 23.1 8 21.6 11.6 19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="19" cy="12" r="3.2" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.5 5.5l-2.6 6.4-6.4 2.6 2.6-6.4z" />
    </svg>
  );
}
