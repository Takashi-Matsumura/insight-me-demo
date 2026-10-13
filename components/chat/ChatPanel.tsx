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
  /** 現テーマにまだ回答が無いとき、最後の回答を直せる1つ前のテーマ（オープナーは含めない） */
  initialPrevious: ThemeSnapshot | null;
  /** 完了済みでロードされたとき、最後の回答をまだ直せるか（レポート生成前か） */
  initialCompletedEditable: boolean;
}

/** あるテーマの対話。修正対象の特定と、応答完了時の確定に使う */
interface ThemeSnapshot {
  themeId: string;
  messages: ChatMessage[];
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

function lastUserIndex(messages: ChatMessage[]): number {
  return messages.findLastIndex((m) => m.role === "user");
}

export function ChatPanel({
  sessionId,
  initialThemeId,
  initialMessages,
  initialInsights,
  initialCompleted,
  initialPrevious,
  initialCompletedEditable,
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
  // テーマ1問目の回答候補ボタンは、深掘り質問には合わない選択肢のまま残り続けると
  // 学生が回答に迷うため、2問目以降はデフォルトで隠す。「うまく言えない」を押した
  // ときだけ取っかかりとして再表示する(handleStuck 参照)。
  // 初期値: リロード時は現テーマの既存メッセージが0件なら1問目とみなす
  // (initialMessages はオープナーを含まない現テーマぶんの既存メッセージのみ)。
  const [showChoices, setShowChoices] = useState(initialMessages.length === 0);
  // 回答の修正。直せるのは直前の回答だけ(サーバ側の判定は lib/dialogue/edit.ts)。
  // テーマ最後の回答は送信と同時に次テーマへ進むので、進んだ直後は previous に
  // 残した前テーマの対話から直せるようにする。
  const [previous, setPrevious] = useState<ThemeSnapshot | null>(() =>
    initialPrevious
      ? {
          themeId: initialPrevious.themeId,
          messages: seedMessages(initialPrevious.themeId, initialPrevious.messages),
        }
      : null,
  );
  const [completedEditable, setCompletedEditable] = useState(initialCompletedEditable);
  const [editing, setEditing] = useState<(ThemeSnapshot & { index: number }) | null>(null);
  // 修正でテーマを巻き戻したら増やす。巻き戻し前に走り出した気づきカード生成の結果を捨てるため。
  const rewindCountRef = useRef(0);

  const abortRef = useRef<AbortController | null>(null);

  // 応答完了時、Composer(入力欄)を画面内に自動スクロールするための仕掛け。
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevSendingRef = useRef(sending);
  const prevInsightCountRef = useRef(insights.length);
  const followRef = useRef(false); // ユーザーが自分でスクロールしたら追従をやめる

  function scrollToComposer(behavior: ScrollBehavior) {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }

  async function completeTheme(finishedThemeId: string) {
    const rewindCount = rewindCountRef.current;
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
      if (insight && rewindCount === rewindCountRef.current) {
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

  // (a) 応答完了(sending: true→false)の立ち下がりでのみスクロールする。
  // ストリーミング中(sending中)は追従しない — 要望は「生成されたら」であり、
  // 生成中に動くと読んでいる最中に画面が動いて不快なため。
  useEffect(() => {
    const wasSending = prevSendingRef.current;
    prevSendingRef.current = sending;
    if (!wasSending || sending) return;

    followRef.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollToComposer(reduce ? "auto" : "smooth");
  }, [sending]);

  // (b) completeTheme() は await されずに走るため、sending が false になった
  // "後" に insights が増えて InsightDeck(メッセージ一覧より上)が伸び、
  // Composer が再び押し下げられることがある。その分だけ追従し直す。
  useEffect(() => {
    const prev = prevInsightCountRef.current;
    prevInsightCountRef.current = insights.length;
    if (insights.length <= prev || !followRef.current) return;

    scrollToComposer("auto");
  }, [insights.length]);

  // (c) ユーザーが自分でスクロールしたら自動追従をやめる。
  useEffect(() => {
    const stop = () => {
      followRef.current = false;
    };
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchmove", stop, { passive: true });
    return () => {
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
    };
  }, []);

  // base は「このリクエストが応答を返す対象の対話」。state の themeId / messages は
  // 修正による巻き戻しの直後だとまだ古いので、呼び出し側から明示的に受け取る。
  // onRefused: サーバが修正を受け付けなかったとき、先に書き換えた画面を元に戻す。
  async function runChatRequest(
    requestBody: Record<string, unknown>,
    base: ThemeSnapshot,
    onRefused?: () => void,
  ) {
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
        if (onRefused) {
          onRefused();
          setError({ message: data.error ?? "修正に失敗しました", retryable: false });
          return;
        }
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
            const settled: ChatMessage[] = acc.trim()
              ? [...base.messages, { role: "assistant", content: acc.trim() }]
              : base.messages;
            setMessages(settled);
            if (evt.action === "next") {
              void completeTheme(base.themeId);
              if (evt.completed) {
                setCompleted(true);
                setCompletedEditable(true);
              } else if (evt.nextThemeId) {
                setPrevious({ themeId: base.themeId, messages: settled });
                setThemeId(evt.nextThemeId);
                setMessages(seedMessages(evt.nextThemeId, []));
                setShowChoices(true); // 新テーマの1問目は選択肢を見せる
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
    setShowChoices(false); // 送信したら1問目用の選択肢は役目を終える
    setPrevious(null); // 新しい回答を送ったら、直せるのはその回答になる
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    void runChatRequest({ userText: text }, { themeId, messages: next });
  }

  function handleRetry() {
    void runChatRequest({ regenerate: true }, { themeId, messages });
  }

  function startEdit(target: ThemeSnapshot) {
    const index = lastUserIndex(target.messages);
    if (index < 0 || sending) return;
    setEditing({ ...target, index });
  }

  function handleEditSubmit(text: string) {
    if (!editing || sending) return;
    const target = editing.themeId;
    const next: ChatMessage[] = [
      ...editing.messages.slice(0, editing.index),
      { role: "user", content: text },
    ];
    const before = { themeId, messages, completed, completedEditable, previous, insights, showChoices };

    // 対象テーマの修正時点まで画面を巻き戻す(1つ前のテーマや完了画面からのこともある)。
    setEditing(null);
    rewindCountRef.current += 1;
    setInsights((prev) => prev.filter((i) => i.themeId !== target));
    setThemeId(target);
    setMessages(next);
    setCompleted(false);
    setPrevious(null);
    setShowChoices(false);

    void runChatRequest({ edit: true, userText: text }, { themeId: target, messages: next }, () => {
      setThemeId(before.themeId);
      setMessages(before.messages);
      setCompleted(before.completed);
      setCompletedEditable(before.completedEditable);
      setPrevious(before.previous);
      setInsights(before.insights);
      setShowChoices(before.showChoices);
    });
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

      // 飛ばしたテーマの回答は修正の対象外
      setPrevious(null);
      if (data.completed) {
        setCompleted(true);
        setCompletedEditable(false);
      } else if (data.nextThemeId) {
        setThemeId(data.nextThemeId);
        setMessages(seedMessages(data.nextThemeId, []));
        setShowChoices(true); // 新テーマの1問目は選択肢を見せる
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
    setShowChoices(true); // 取っかかりとして1問目用の選択肢を再表示する
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "大丈夫です。じゃあ角度を変えますね。下の選択肢から近いものを選んでみてください。",
      },
    ]);
  }

  if (completed && !editing) {
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
          {completedEditable && lastUserIndex(messages) >= 0 && (
            <p className="mt-4 text-xs text-muted">
              <button
                type="button"
                onClick={() => startEdit({ themeId, messages })}
                className="underline decoration-dotted hover:text-foreground"
              >
                最後の回答を修正する
              </button>
              （レポートを作る前だけ直せます）
            </p>
          )}
          {error && <p className="mt-3 text-xs text-red-700 dark:text-red-300">{error.message}</p>}
        </div>
        <InsightDeck insights={insights} />
        <div ref={bottomRef} aria-hidden className="h-0" />
      </div>
    );
  }

  // 修正中は対象テーマの対話(1つ前のテーマや完了済みの最終テーマのこともある)を表示する。
  const view: ThemeSnapshot = editing ?? { themeId, messages };
  const editableIndex = sending || editing ? -1 : lastUserIndex(messages);

  const theme = getTheme(view.themeId);
  if (!theme) {
    return (
      <p className="text-sm text-muted">
        テーマの読み込みに失敗しました。ページを再読み込みしてください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ProgressRail currentThemeId={view.themeId} />

      <InsightDeck insights={insights} />

      <div className="rounded-lg border border-border bg-background/50 p-4">
        <MessageList
          messages={view.messages}
          streamingText={streamingText}
          waiting={sending}
          editableIndex={editableIndex}
          onEditStart={() => startEdit({ themeId, messages })}
          editing={
            editing
              ? {
                  index: editing.index,
                  onSubmit: handleEditSubmit,
                  onCancel: () => setEditing(null),
                }
              : undefined
          }
        />
        {previous && !editing && !sending && editableIndex < 0 && (
          <div className="mt-3 text-right">
            <button
              type="button"
              onClick={() => startEdit(previous)}
              className="text-xs text-muted underline decoration-dotted hover:text-foreground"
            >
              前のテーマの最後の回答を修正する
            </button>
          </div>
        )}
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

      {!editing && (
        <Composer
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          onSkip={handleSkip}
          onStuck={handleStuck}
          disabled={sending}
          fallbackChoices={showChoices ? theme.fallbackChoices : []}
        />
      )}
      <div ref={bottomRef} aria-hidden className="h-0" />
    </div>
  );
}
