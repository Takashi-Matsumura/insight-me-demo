"use client";

import { useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 20_000;
// 再起動中の一瞬のポーリング失敗で驚かせないよう、2回連続失敗ではじめて表示する
const FAILURE_THRESHOLD = 2;

export function LlmStatusBanner() {
  const [visible, setVisible] = useState(false);
  const failureCount = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      let ok = false;
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = (await res.json().catch(() => ({ ok: false }))) as {
          ok?: boolean;
        };
        ok = data.ok === true;
      } catch {
        ok = false;
      }
      if (cancelled) return;

      if (ok) {
        failureCount.current = 0;
        setVisible(false);
      } else {
        failureCount.current += 1;
        if (failureCount.current >= FAILURE_THRESHOLD) setVisible(true);
      }
    }

    void poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
    >
      AI が一時的に応答していません。自動で復旧を試みています…（入力内容は保存されています）
    </div>
  );
}
