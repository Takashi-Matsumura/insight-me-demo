"use client";

import { useState } from "react";
import type { CareerExplorerItem, ExplorerCategory, FitEvidence } from "@/lib/careers/explore";
import { CareerDialog } from "./CareerDialog";

export function CareerExplorer({
  items,
  categories,
  evidences,
  sessionId,
}: {
  items: CareerExplorerItem[];
  categories: ExplorerCategory[];
  evidences: FitEvidence[];
  sessionId: string;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(null); // null = すべて
  const [selected, setSelected] = useState<CareerExplorerItem | null>(null);
  // careerId → AIが生成した詳しい文章。ダイアログを閉じても保持し、同セッション内での
  // 再オープンを即時にする（DBキャッシュとは別に、クライアント側でも持ち上げる）。
  const [aiFits, setAiFits] = useState<Map<string, string>>(new Map());
  const visible = categoryId ? items.filter((i) => i.categoryId === categoryId) : items;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <FilterPill
          label={`すべて（${items.length}）`}
          active={categoryId === null}
          onClick={() => setCategoryId(null)}
        />
        {categories.map((c) => (
          <FilterPill
            key={c.id}
            label={`${c.label}（${c.count}）`}
            active={categoryId === c.id}
            onClick={() => setCategoryId(c.id)}
          />
        ))}
      </div>

      <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {visible.map((item) => (
          <button
            key={item.careerId}
            type="button"
            aria-haspopup="dialog"
            onClick={() => setSelected(item)}
            className={
              "flex w-full items-center justify-between gap-4 px-4 py-3 text-left " +
              "transition-colors hover:bg-accent/5 " +
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            }
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-medium">{item.name}</p>
                {item.obscurity >= 3 && (
                  <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                    🔍
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">{item.oneLiner}</p>
              {item.matchedTagLabels.length > 0 && (
                <p className="mt-1 text-[11px] text-muted">{item.matchedTagLabels.join("・")}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="h-1 w-16 overflow-hidden rounded-full bg-border sm:w-24">
                <div
                  className="h-full rounded-full bg-accent/40"
                  style={{ width: `${item.matchPct}%` }}
                />
              </div>
              <span className="w-10 text-right text-[11px] text-muted">
                {item.matchPct > 0 ? `${item.matchPct}%` : "—"}
              </span>
              {/* 行がクリックできることの手がかり。バーだけだと不活性に見えるため */}
              <span className="text-muted" aria-hidden>
                ›
              </span>
            </div>
          </button>
        ))}
        {visible.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted">
            このカテゴリの仕事は上のおすすめに含まれています。
          </p>
        )}
      </div>

      <CareerDialog
        item={selected}
        evidences={evidences}
        sessionId={sessionId}
        aiFits={aiFits}
        onAiFitLoaded={(careerId, text) =>
          setAiFits((prev) => new Map(prev).set(careerId, text))
        }
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1.5 text-xs transition-colors " +
        (active
          ? "border-accent bg-accent/10 font-medium text-accent"
          : "border-border bg-card text-muted hover:border-accent hover:text-foreground")
      }
    >
      {label}
    </button>
  );
}
