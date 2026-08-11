"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-lg font-medium">予期しないエラーが発生しました。</p>
      <p className="mt-2 text-sm text-muted">
        お手数ですが、もう一度お試しください。改善しない場合はメンターにご連絡ください。
      </p>
      <button
        onClick={() => retry()}
        className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        もう一度試す
      </button>
    </div>
  );
}
