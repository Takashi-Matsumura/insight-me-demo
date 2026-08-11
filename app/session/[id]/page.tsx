import { notFound } from "next/navigation";
import { getSession, listMessagesForTheme, listThemeResults } from "@/lib/db/queries";
import { getTheme } from "@/lib/dialogue/themes";
import { ChatPanel } from "@/components/chat/ChatPanel";
import type { InsightCardData } from "@/components/chat/InsightDeck";

// node:sqlite を読むため、ビルド時に静的化させず常にリクエスト時に実行する。
export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: PageProps<"/session/[id]">) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) notFound();

  const themeMessages = listMessagesForTheme(id, session.currentTheme);

  const initialInsights: InsightCardData[] = listThemeResults(id)
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
        <p className="text-sm text-muted">{session.studentName} さん</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          対話をはじめましょう
        </h1>

        <div className="mt-6">
          <ChatPanel
            sessionId={session.id}
            initialThemeId={session.currentTheme}
            initialMessages={themeMessages.map((m) => ({
              role: m.role,
              content: m.content,
            }))}
            initialInsights={initialInsights}
            initialCompleted={session.status === "completed"}
          />
        </div>
      </main>
    </div>
  );
}
