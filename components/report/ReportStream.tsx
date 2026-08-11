"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CareerCard, type CareerCardData } from "./CareerCard";
import { renderBold } from "@/lib/formatted-text";

type SseEvent =
  | { type: "summary_text"; text: string }
  | { type: "profile"; strengths: string[]; values: string[] }
  | ({ type: "career" } & CareerCardData)
  | { type: "career_reason"; careerId: string; reason: string }
  | { type: "career_reason_error"; careerId: string; message: string }
  | { type: "error"; code: string; message: string; retryable: boolean }
  | { type: "done" };

interface ReportError {
  message: string;
  retryable: boolean;
}

export function ReportStream({ sessionId }: { sessionId: string }) {
  const [summaryText, setSummaryText] = useState("");
  const [strengths, setStrengths] = useState<string[] | null>(null);
  const [values, setValues] = useState<string[] | null>(null);
  const [cards, setCards] = useState<Record<string, CareerCardData>>({});
  const [error, setError] = useState<ReportError | null>(null);
  const [done, setDone] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    abortRef.current = controller;

    async function run() {
      setError(null);
      try {
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "レポートの生成を開始できませんでした");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { value, done: readerDone } = await reader.read();
          if (readerDone) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data: ")) continue;

            let evt: SseEvent;
            try {
              evt = JSON.parse(line.slice(6)) as SseEvent;
            } catch {
              continue;
            }
            if (cancelled) return;

            switch (evt.type) {
              case "summary_text":
                setSummaryText((prev) => prev + evt.text);
                break;
              case "profile":
                setStrengths(evt.strengths);
                setValues(evt.values);
                break;
              case "career":
                setCards((prev) => ({ ...prev, [evt.careerId]: evt }));
                break;
              case "career_reason":
                setCards((prev) => {
                  const card = prev[evt.careerId];
                  if (!card) return prev;
                  return { ...prev, [evt.careerId]: { ...card, reason: evt.reason } };
                });
                break;
              case "career_reason_error":
                setCards((prev) => {
                  const card = prev[evt.careerId];
                  if (!card) return prev;
                  return {
                    ...prev,
                    [evt.careerId]: { ...card, reason: "理由の生成に失敗しました。" },
                  };
                });
                break;
              case "error":
                setError({ message: evt.message, retryable: evt.retryable });
                break;
              case "done":
                setDone(true);
                // Server Component を再実行し、静的カード表示＋一覧からの6件除外を確定させる
                router.refresh();
                break;
            }
          }
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError({
          message: e instanceof Error ? e.message : "レポートの生成に失敗しました",
          retryable: true,
        });
      }
    }

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionId, attempt, router]);

  const sortedCards = Object.values(cards).sort((a, b) => a.rank - b.rank);

  return (
    <div className="flex flex-col gap-10">
      <section>
        {summaryText ? (
          <p className="text-xl font-medium leading-relaxed tracking-tight text-balance whitespace-pre-wrap">
            {renderBold(summaryText)}
          </p>
        ) : (
          !error && (
            <div className="flex flex-col gap-2">
              <div className="h-5 w-full animate-pulse rounded bg-border" />
              <div className="h-5 w-2/3 animate-pulse rounded bg-border" />
            </div>
          )
        )}
      </section>

      {(strengths || values) && (
        <section className="flex flex-col gap-4 sm:flex-row sm:gap-10">
          {strengths && (
            <div>
              <p className="text-xs font-medium text-muted">あなたの強み</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {strengths.map((s) => (
                  <span key={s} className="rounded-full border border-border px-2.5 py-1 text-xs">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {values && (
            <div>
              <p className="text-xs font-medium text-muted">大事にしていること</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {values.map((v) => (
                  <span key={v} className="rounded-full border border-border px-2.5 py-1 text-xs">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <span>{error.message}</span>
          {error.retryable && (
            <button
              onClick={() => setAttempt((n) => n + 1)}
              className="shrink-0 rounded-md border border-red-300 px-3 py-1 underline dark:border-red-800"
            >
              もう一度試す
            </button>
          )}
        </div>
      )}

      {sortedCards.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">あなたに合いそうな仕事</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sortedCards.map((card) => (
              <CareerCard key={card.careerId} card={card} />
            ))}
          </div>
        </section>
      )}

      {!done && !error && sortedCards.length === 0 && (
        <p className="text-sm text-muted">職業候補を選定しています…</p>
      )}
    </div>
  );
}
