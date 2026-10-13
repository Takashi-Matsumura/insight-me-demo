import { useState } from "react";
import { renderBold } from "@/lib/formatted-text";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnswerEditing {
  index: number;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export function MessageList({
  messages,
  streamingText,
  waiting,
  editableIndex = -1,
  onEditStart,
  editing,
}: {
  messages: ChatMessage[];
  streamingText: string;
  waiting: boolean;
  /** 「修正する」を出す発言の位置。出さないときは -1 */
  editableIndex?: number;
  onEditStart?: () => void;
  /** 修正中の発言。指定するとその吹き出しが編集フォームに置き換わる */
  editing?: AnswerEditing;
}) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((m, i) =>
        editing && i === editing.index ? (
          <AnswerEditor
            key={i}
            initial={m.content}
            onSubmit={editing.onSubmit}
            onCancel={editing.onCancel}
          />
        ) : (
          <Bubble
            key={i}
            role={m.role}
            content={m.content}
            // 修正すると作り直されるやり取りは薄く見せる
            dimmed={!!editing && i > editing.index}
            onEdit={!editing && i === editableIndex ? onEditStart : undefined}
          />
        ),
      )}
      {(streamingText || waiting) && (
        <Bubble role="assistant" content={streamingText} pending={waiting && !streamingText} />
      )}
    </div>
  );
}

function Bubble({
  role,
  content,
  pending,
  dimmed,
  onEdit,
}: {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  dimmed?: boolean;
  onEdit?: () => void;
}) {
  const isUser = role === "user";
  return (
    <div
      className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"} ${dimmed ? "opacity-40" : ""}`}
    >
      <div
        className={
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed " +
          (isUser
            ? "bg-accent text-accent-foreground"
            : "border border-border bg-card text-foreground")
        }
      >
        {pending ? <TypingDots /> : isUser ? content : renderBold(content)}
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-muted underline decoration-dotted hover:text-foreground"
        >
          修正する
        </button>
      )}
    </div>
  );
}

function AnswerEditor({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const trimmed = text.trim();
  const canSave = trimmed !== "" && trimmed !== initial.trim();

  // 誤送信を直すための場所なので、Enter では送らない(改行のみ)。送信はボタンだけ。
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSubmit(trimmed);
      }}
      className="flex flex-col items-end gap-2"
    >
      <textarea
        autoFocus
        // 途中で送ってしまった回答の続きを書けるよう、カーソルは末尾に置く
        onFocus={(e) => {
          const end = e.currentTarget.value.length;
          e.currentTarget.setSelectionRange(end, end);
        }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // IME変換中の Escape は変換の取り消しなので、編集のキャンセルにはしない
          if (e.key === "Escape" && !e.nativeEvent.isComposing) onCancel();
        }}
        rows={3}
        maxLength={500}
        aria-label="回答を修正"
        className="w-full max-w-[85%] resize-none rounded-2xl border border-accent bg-card px-4 py-2.5 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-accent"
      />
      <p className="text-xs text-muted">修正すると、これ以降のやり取りは作り直されます。</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={!canSave}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          修正して送り直す
        </button>
      </div>
    </form>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
    </span>
  );
}
