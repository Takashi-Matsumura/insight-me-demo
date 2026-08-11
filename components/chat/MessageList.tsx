import { renderBold } from "@/lib/formatted-text";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function MessageList({
  messages,
  streamingText,
  waiting,
}: {
  messages: ChatMessage[];
  streamingText: string;
  waiting: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((m, i) => (
        <Bubble key={i} role={m.role} content={m.content} />
      ))}
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
}: {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
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
    </div>
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
