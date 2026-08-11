import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getSession,
  listThemeResults,
  getReport,
  listCareerMatches,
} from "@/lib/db/queries";
import { getCareerById, getCategoryLabel } from "@/lib/careers/catalog";
import { buildExplorer } from "@/lib/careers/explore";
import { getTheme } from "@/lib/dialogue/themes";
import { collectTags, selectReportThemeResults } from "@/lib/report/prompts";
import { InsightDeck, type InsightCardData } from "@/components/chat/InsightDeck";
import { ReportStream } from "@/components/report/ReportStream";
import { CareerCard, type CareerCardData } from "@/components/report/CareerCard";
import { CareerExplorer } from "@/components/report/CareerExplorer";
import { renderBold } from "@/lib/formatted-text";

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

  const themeResults = listThemeResults(id);

  const insights: InsightCardData[] = themeResults
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

  // LLMの選定結果とは独立に、保存済みタグから毎回決定論的に計算する
  // （LLM呼び出し・DB書き込みなし。生成中でも即座に表示でき、過去の完了済み
  //   セッションにも同じ内容が出る）。
  const matches = listCareerMatches(id);
  const featuredIds = matches.map((m) => m.careerId);
  const studentTags = collectTags(selectReportThemeResults(themeResults));
  const explorer = buildExplorer({
    studentTags,
    excludeIds: featuredIds,
    insights: insights.map((i) => ({
      themeTitle: i.themeTitle,
      label: i.label,
      reframe: i.reframe,
      tags: i.tags,
    })),
    // report は生成完了前は undefined。strengths が無くても気づきカード側で fit は成立する
    strengths: report?.strengths ?? [],
  });

  const staticCards: CareerCardData[] = isComplete
    ? matches
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
                <p className="text-xl font-medium leading-relaxed tracking-tight text-balance whitespace-pre-wrap">
                  {renderBold(report.profileMd)}
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

          {explorer.items.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold tracking-tight">
                ほかにもこんな仕事があります
              </h2>
              <p className="mt-1 text-sm text-muted">
                世の中の仕事はもっとたくさんあります。カテゴリを切り替えて、気になるものを
                眺めてみてください。{" "}
                <strong className="font-medium text-foreground">
                  気になった仕事をタップすると、どんな仕事か・あなたの力がどこで活きそうかが
                  読めます。
                </strong>
              </p>
              <div className="mt-4">
                <CareerExplorer
                  items={explorer.items}
                  categories={explorer.categories}
                  evidences={explorer.evidences}
                  sessionId={id}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                ※ バーは、あなたのキーワードとその仕事の特徴がどれくらい重なっているかの
                目安です。上の「あなたに合いそうな仕事」の適合度とは別の指標です。
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
