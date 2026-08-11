"use client";

import { useRef } from "react";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onStuck: () => void;
  disabled: boolean;
  fallbackChoices: string[];
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onSkip,
  onStuck,
  disabled,
  fallbackChoices,
}: ComposerProps) {
  // IME変換確定のEnterで誤送信しないためのフラグ。
  // ブラウザによっては確定Enterの keydown で isComposing が既に false になっている
  // ことがあるため、onCompositionStart/End での自前追跡と keyCode===229 の両方で防御する。
  const isComposingRef = useRef(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {fallbackChoices.map((choice) => (
          <button
            key={choice}
            type="button"
            disabled={disabled}
            onClick={() => onChange(choice)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-foreground disabled:opacity-50"
          >
            {choice}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled && value.trim()) onSubmit();
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          onKeyDown={(e) => {
            if (
              e.key !== "Enter" ||
              e.shiftKey ||
              isComposingRef.current ||
              e.nativeEvent.isComposing ||
              e.keyCode === 229
            ) {
              return;
            }
            e.preventDefault();
            if (!disabled && value.trim()) onSubmit();
          }}
          disabled={disabled}
          rows={2}
          placeholder="思いついたことをそのまま書いてください（短くても大丈夫です）"
          className="flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          送信
        </button>
      </form>

      <div className="flex items-center justify-between text-xs text-muted">
        <button
          type="button"
          onClick={onStuck}
          disabled={disabled}
          className="underline decoration-dotted hover:text-foreground disabled:opacity-50"
        >
          うまく言えない
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={disabled}
          className="underline decoration-dotted hover:text-foreground disabled:opacity-50"
        >
          このテーマは飛ばす
        </button>
      </div>
    </div>
  );
}
