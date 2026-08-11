"use client";

import { useEffect, useRef, useState } from "react";
import type { CareerExplorerItem, CareerFit, FitEvidence } from "@/lib/careers/explore";

export function CareerDialog({
  item,
  evidences,
  sessionId,
  aiFits,
  onAiFitLoaded,
  onClose,
}: {
  item: CareerExplorerItem | null;
  evidences: FitEvidence[];
  sessionId: string;
  /** careerId → AIが生成した詳しい文章。同セッション内での再オープンを即時にするための持ち上げキャッシュ */
  aiFits: Map<string, string>;
  onAiFitLoaded: (careerId: string, text: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const isOpen = item !== null;

  // open 属性を JSX で付けると「非モーダル」ダイアログになり、Escape も
  // フォーカストラップも backdrop も効かない。必ず showModal() を命令的に呼ぶ。
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isOpen && !el.open) {
      el.showModal();
      el.scrollTop = 0; // 前回開いたときのスクロール位置が残るため
    } else if (!isOpen && el.open) {
      el.close();
    }
  }, [isOpen]);

  // showModal() は背後を inert にするだけで、body のスクロールは止まらない
  // （iOS Safari で背面がスクロールしてしまう）。
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="career-dialog-title"
      // Escape / close() の両方でここに来る。state を単一の真実に戻す。
      onClose={onClose}
      // backdrop クリック: backdrop を押したときだけ e.target が dialog 自身になる。
      // そのため dialog 側は p-0 にし、余白は内側の div で作ること
      //（dialog に padding を付けると、その余白のクリックでも閉じてしまう）。
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className={
        "m-auto w-[calc(100vw-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto " +
        "overscroll-contain rounded-xl border border-border bg-card p-0 " +
        "text-foreground shadow-xl"
      }
    >
      {/* 64件ぶんの DOM を先に吐かないよう、選択中の1件だけを描画する */}
      {item && (
        <CareerDialogBody
          item={item}
          evidences={evidences}
          sessionId={sessionId}
          aiText={aiFits.get(item.careerId) ?? null}
          onAiFitLoaded={onAiFitLoaded}
          onRequestClose={() => ref.current?.close()}
        />
      )}
    </dialog>
  );
}

function CareerDialogBody({
  item,
  evidences,
  sessionId,
  aiText,
  onAiFitLoaded,
  onRequestClose,
}: {
  item: CareerExplorerItem;
  evidences: FitEvidence[];
  sessionId: string;
  aiText: string | null;
  onAiFitLoaded: (careerId: string, text: string) => void;
  onRequestClose: () => void;
}) {
  return (
    <div>
      {/* スクロールしても閉じるボタンに届くよう sticky。dialog 自体がスクロールコンテナ */}
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs text-muted">{item.categoryLabel}</p>
          <h2 id="career-dialog-title" className="mt-0.5 text-lg font-semibold tracking-tight">
            {item.name}
          </h2>
          {item.obscurity >= 3 && (
            <span className="mt-1.5 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
              🔍 あまり知られていない職種
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRequestClose}
          aria-label="閉じる"
          className="shrink-0 rounded-md border border-border px-2 py-1 text-sm text-muted transition-colors hover:text-foreground"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <p className="text-sm leading-relaxed text-muted">{item.oneLiner}</p>

        <Section title="どんな仕事？">
          <p className="text-sm leading-relaxed">{item.detail}</p>
        </Section>

        <Section title="ある一日">
          <p className="text-sm leading-relaxed text-muted">{item.dayInLife}</p>
        </Section>

        <Section title="求められる役割・向いている人">
          <p className="text-sm leading-relaxed text-muted">{item.goodFit}</p>
        </Section>

        <FitBlock fit={item.fit} evidences={evidences} />

        <AiFitBlock
          careerId={item.careerId}
          sessionId={sessionId}
          aiText={aiText}
          onAiFitLoaded={onAiFitLoaded}
        />

        <Section title="必要なスキル">
          <div className="flex flex-wrap gap-1.5">
            {item.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted"
              >
                {skill}
              </span>
            ))}
          </div>
        </Section>

        {item.relatedMajors.length > 0 && (
          <Section title="関連しやすい学部・専攻">
            <p className="text-sm text-muted">{item.relatedMajors.join("・")}</p>
          </Section>
        )}

        <div className="mt-1 rounded-lg bg-accent/5 px-3 py-2.5 text-sm">
          <span className="font-medium text-accent">次の一歩　</span>
          {item.nextStep}
        </div>
      </div>
    </div>
  );
}

function FitBlock({ fit, evidences }: { fit: CareerFit; evidences: FitEvidence[] }) {
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
      <p className="text-xs font-medium text-accent">この仕事で、あなたの力が活きそうなところ</p>

      {fit.highlights.length > 0 ? (
        <ul className="mt-2.5 flex flex-col gap-3">
          {fit.highlights.map((h) => {
            const ev = h.evidenceIndex !== null ? evidences[h.evidenceIndex] : null;
            return (
              <li key={h.tag}>
                <p className="text-sm leading-relaxed">{h.scene}</p>
                {ev ? (
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    ここで、あなたの「
                    <span className="font-medium text-foreground">{ev.label}</span>
                    」が効いてきそうです。
                    {ev.detail && <>　{ev.detail}</>}
                    <span className="ml-1 whitespace-nowrap">（{ev.source}）</span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted">
                    あなたのキーワード「{h.tagLabel}」と重なっている部分です。
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-muted">{fit.fallbackNote}</p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        ※ あなたの気づきカードのキーワードと、この仕事の特徴が重なっている部分から
        組み立てた見立てです。当たっているかどうかは、あなた自身が確かめてみてください。
      </p>
    </div>
  );
}

function AiFitBlock({
  careerId,
  sessionId,
  aiText,
  onAiFitLoaded,
}: {
  careerId: string;
  sessionId: string;
  aiText: string | null;
  onAiFitLoaded: (careerId: string, text: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (aiText) {
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted">{aiText}</p>
    );
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/careers/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, careerId }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error ?? "生成に失敗しました");
      onAiFitLoaded(careerId, data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-1.5 py-1">
        <div className="h-3 w-full animate-pulse rounded bg-border" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-border" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        className="self-start rounded-md border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
      >
        AIにもっと詳しく書いてもらう
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

// CareerCard.tsx と同じ体裁。8行のためだけに相互 import すると
// サーバ/クライアント両用コンポーネントへの依存が増えるので、ここでは複製する。
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
