import Link from "next/link";
import { listSessions, type SessionStatus } from "@/lib/db/queries";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<SessionStatus, string> = {
  active: "対話中",
  completed: "完了",
  abandoned: "中断",
};

export default function MentorPage() {
  const sessions = listSessions();

  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <main className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">メンター用ビュー</h1>
        <p className="mt-1 text-sm text-muted">学生の対話セッション一覧</p>

        {sessions.length === 0 ? (
          <p className="mt-8 text-sm text-muted">まだセッションがありません。</p>
        ) : (
          <div className="mt-6 flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/mentor/${s.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-background/50"
              >
                <div>
                  <p className="font-medium">{s.studentName}</p>
                  <p className="mt-0.5 text-xs text-muted">{formatDateTime(s.createdAt)}</p>
                </div>
                <span
                  className={
                    "rounded-full px-2.5 py-1 text-xs " +
                    (s.status === "completed"
                      ? "bg-accent/10 text-accent"
                      : "border border-border text-muted")
                  }
                >
                  {STATUS_LABEL[s.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
