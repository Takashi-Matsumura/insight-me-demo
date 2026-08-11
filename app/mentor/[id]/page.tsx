import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getSession,
  listMessagesForTheme,
  listThemeResults,
  type SessionStatus,
} from "@/lib/db/queries";
import { THEMES, getTheme } from "@/lib/dialogue/themes";
import { formatDateTime } from "@/lib/format";
import { InsightDeck, type InsightCardData } from "@/components/chat/InsightDeck";
import { MessageList, type ChatMessage } from "@/components/chat/MessageList";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<SessionStatus, string> = {
  active: "対話中",
  completed: "完了",
  abandoned: "中断",
};

export default async function MentorSessionPage({
  params,
}: PageProps<"/mentor/[id]">) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) notFound();

  const themeResults = listThemeResults(id);
  const skippedThemeIds = new Set(themeResults.filter((r) => r.skipped).map((r) => r.themeId));

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

  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <main className="mx-auto w-full max-w-2xl">
        <Link href="/mentor" className="text-sm text-accent underline">
          ← 一覧に戻る
        </Link>

        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {session.studentName} さん
            </h1>
            <p className="mt-1 text-sm text-muted">
              {STATUS_LABEL[session.status]} ・ 開始 {formatDateTime(session.createdAt)}
            </p>
          </div>
          {session.status === "completed" && (
            <Link
              href={`/session/${id}/report`}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              レポートを見る
            </Link>
          )}
        </div>

        {insights.length > 0 && (
          <div className="mt-8">
            <InsightDeck insights={insights} />
          </div>
        )}

        <div className="mt-8 flex flex-col gap-8">
          {THEMES.map((theme) => {
            const messages = listMessagesForTheme(id, theme.id);
            const skipped = skippedThemeIds.has(theme.id);
            if (messages.length === 0 && !skipped) return null;

            const displayMessages: ChatMessage[] = [
              { role: "assistant", content: theme.opener },
              ...messages.map((m): ChatMessage => ({ role: m.role, content: m.content })),
            ];

            return (
              <section key={theme.id}>
                <h2 className="text-sm font-medium text-muted">{theme.title}</h2>
                {skipped ? (
                  <p className="mt-2 text-sm text-muted">（このテーマはスキップされました）</p>
                ) : (
                  <div className="mt-2 rounded-lg border border-border bg-background/50 p-4">
                    <MessageList messages={displayMessages} streamingText="" waiting={false} />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
