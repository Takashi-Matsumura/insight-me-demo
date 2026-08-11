import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getSession,
  listThemeResults,
  getReport,
  listCareerMatches,
} from "@/lib/db/queries";
import { getCareerById, getCategoryLabel } from "@/lib/careers/catalog";
import { getTheme } from "@/lib/dialogue/themes";
import { InsightDeck, type InsightCardData } from "@/components/chat/InsightDeck";
import { ReportStream } from "@/components/report/ReportStream";
import { CareerCard, type CareerCardData } from "@/components/report/CareerCard";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: PageProps<"/session/[id]/report">) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) notFound();

  if (session.status !== "completed") {
    return (
      <div className="flex flex-1 flex-col px-6 py-10">
        <main className="mx-auto w-full max-w-2xl">
          <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted">
            対話がまだ完了していません。すべてのテーマについて対話を終えると、
            ここでレポートが見られるようになります。
          </p>
          <Link
            href={`/session/${id}`}
            className="mt-4 inline-block text-sm text-accent underline"
          >
            対話に戻る
          </Link>
        </main>
      </div>
    );
  }

  const insights: InsightCardData[] = listThemeResults(id)
    .filter((r) => !r.skipped && r.quote && r.label && r.reframe)
    .map((r) => ({
      themeId: r.themeId,
      themeTitle: getTheme(r.themeId)?.title ?? r.themeId,
      quote: r.quote!,
      label: r.label!,
      reframe: r.reframe!,
      tags: r.tags,
    }));

  const report = getReport(id);
  const isComplete = report?.status === "complete";

  const staticCards: CareerCardData[] = isComplete
    ? listCareerMatches(id)
        .map((m) => {
          const career = getCareerById(m.careerId);
          if (!career) return null;
          return {
            careerId: career.id,
            rank: m.rank,
            fitScore: m.fitScore,
            isDiscovery: m.isDiscovery,
            obscurity: career.obscurity,
            name: career.name,
            categoryLabel: getCategoryLabel(career.category),
            oneLiner: career.oneLiner,
            detail: career.detail,
            goodFit: career.goodFit,
            dayInLife: career.dayInLife,
            skills: career.skills,
            nextStep: career.nextStep,
            relatedMajors: career.relatedMajors,
            reason: m.reason,
          } satisfies CareerCardData;
        })
        .filter((c): c is CareerCardData => c !== null)
    : [];

  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <main className="mx-auto w-full max-w-3xl">
        <p className="text-sm text-muted">{session.studentName} さんのレポート</p>

        <div className="mt-6 flex flex-col gap-10">
          {isComplete ? (
            <>
              <section>
                <p className="text-xl font-medium leading-relaxed tracking-tight text-balance">
                  {report.profileMd}
                </p>
              </section>

              <section className="flex flex-col gap-4 sm:flex-row sm:gap-10">
                <div>
                  <p className="text-xs font-medium text-muted">あなたの強み</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {report.strengths.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-border px-2.5 py-1 text-xs"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted">大事にしていること</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {report.values.map((v) => (
                      <span
                        key={v}
                        className="rounded-full border border-border px-2.5 py-1 text-xs"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            </>
          ) : null}

          {insights.length > 0 && (
            <section>
              <InsightDeck insights={insights} />
            </section>
          )}

          {isComplete ? (
            <section>
              <h2 className="text-lg font-semibold tracking-tight">あなたに合いそうな仕事</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {staticCards.map((card) => (
                  <CareerCard key={card.careerId} card={card} />
                ))}
              </div>
            </section>
          ) : (
            <ReportStream sessionId={id} />
          )}
        </div>
      </main>
    </div>
  );
}
