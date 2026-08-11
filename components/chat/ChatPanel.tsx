"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getTheme } from "@/lib/dialogue/themes";
import { MessageList, type ChatMessage } from "./MessageList";
import { Composer } from "./Composer";
import { ProgressRail } from "./ProgressRail";
import { InsightDeck, type InsightCardData } from "./InsightDeck";

interface ChatPanelProps {
  sessionId: string;
  initialThemeId: string;
  /** 現テーマぶんの既存メッセージのみ（オープナーは含めない。ChatPanel が先頭に補う） */
  initialMessages: ChatMessage[];
  /** 既に完了しているテーマの気づきカード（リロード時の復元用） */
  initialInsights: InsightCardData[];
  /** セッションが既に completed 状態でロードされたか */
  initialCompleted: boolean;
}

interface StreamError {
  message: string;
  retryable: boolean;
}

type SseEvent =
  | { type: "text"; text: string }
  | { type: "control"; action: "probe" | "next"; nextThemeId: string | null; completed: boolean }
  | { type: "error"; code: string; message: string; retryable: boolean };

function seedMessages(themeId: string, existing: ChatMessage[]): ChatMessage[] {
  const theme = getTheme(themeId);
  const opener: ChatMessage[] = theme ? [{ role: "assistant", content: theme.opener }] : [];
  return [...opener, ...existing];
}

export function ChatPanel({
  sessionId,
  initialThemeId,
  initialMessages,
  initialInsights,
  initialCompleted,
}: ChatPanelProps) {
  const [themeId, setThemeId] = useState(initialThemeId);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    seedMessages(initialThemeId, initialMessages),
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<StreamError | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [completed, setCompleted] = useState(initialCompleted);
  const [insights, setInsights] = useState<InsightCardData[]>(initialInsights);

  const abortRef = useRef<AbortController | null>(null);

  async function completeTheme(finishedThemeId: string) {
    try {
      const res = await fetch("/api/theme/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, themeId: finishedThemeId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        insight?: { quote: string; label: string; reframe: string; tags: string[] } | null;
      };
      const insight = data.insight;
      if (insight) {
        const finishedTheme = getTheme(finishedThemeId);
        setInsights((prev) => [
          ...prev,
          {
            themeId: finishedThemeId,
            themeTitle: finishedTheme?.title ?? finishedThemeId,
            ...insight,
          },
        ]);
      }
    } catch {
      // 気づきカードの生成失敗は対話の進行をブロックしない。静かに無視する。
    }
  }

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function runChatRequest(requestBody: Record<string, unknown>) {
    setError(null);
    setCanRetry(false);
    setSending(true);
    setStreamingText("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...requestBody }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "送信に失敗しました");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
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

          if (evt.type === "text") {
            acc += evt.text;
            setStreamingText(acc);
          } else if (evt.type === "error") {
            setStreamingText("");
            setError({ message: evt.message, retryable: evt.retryable });
            setCanRetry(evt.retryable);
          } else if (evt.type === "control") {
            setStreamingText("");
            if (acc.trim()) {
              setMessages((prev) => [...prev, { role: "assistant", content: acc.trim() }]);
            }
            if (evt.action === "next") {
              void completeTheme(themeId);
              if (evt.completed) {
                setCompleted(true);
              } else if (evt.nextThemeId) {
                setThemeId(evt.nextThemeId);
                setMessages(seedMessages(evt.nextThemeId, []));
              }
            }
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setStreamingText("");
      setError({
        message: e instanceof Error ? e.message : "通信エラーが発生しました",
        retryable: true,
      });
      setCanRetry(true);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    void runChatRequest({ userText: text });
  }

  function handleRetry() {
    void runChatRequest({ regenerate: true });
  }

  async function handleSkip() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, skip: true }),
      });
      const data = (await res.json()) as {
        error?: string;
        completed?: boolean;
        nextThemeId?: string | null;
      };
      if (!res.ok) throw new Error(data.error ?? "スキップに失敗しました");

      if (data.completed) {
        setCompleted(true);
      } else if (data.nextThemeId) {
        setThemeId(data.nextThemeId);
        setMessages(seedMessages(data.nextThemeId, []));
      }
    } catch (e) {
      setError({
        message: e instanceof Error ? e.message : "スキップに失敗しました",
        retryable: false,
      });
    } finally {
      setSending(false);
    }
  }

  function handleStuck() {
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "大丈夫です。じゃあ角度を変えますね。下の選択肢から近いものを選んでみてください。",
      },
    ]);
  }

  if (completed) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-border bg-card px-6 py-8 text-center">
          <p className="text-lg font-medium">お疲れさまでした。</p>
          <p className="mt-2 text-sm text-muted">
            すべてのテーマについて対話が完了しました。ここまでの内容は保存されています。
          </p>
          <Link
            href={`/session/${sessionId}/report`}
            className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            レポートを見る
          </Link>
        </div>
        <InsightDeck insights={insights} />
      </div>
    );
  }

  const theme = getTheme(themeId);
  if (!theme) {
    return (
      <p className="text-sm text-muted">
        テーマの読み込みに失敗しました。ページを再読み込みしてください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ProgressRail currentThemeId={themeId} />

      <InsightDeck insights={insights} />

      <div className="rounded-lg border border-border bg-background/50 p-4">
        <MessageList messages={messages} streamingText={streamingText} waiting={sending} />
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <span>{error.message}</span>
          {canRetry && (
            <button onClick={handleRetry} className="shrink-0 underline">
              もう一度送る
            </button>
          )}
        </div>
      )}

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        onSkip={handleSkip}
        onStuck={handleStuck}
        disabled={sending}
        fallbackChoices={theme.fallbackChoices}
      />
    </div>
  );
}
