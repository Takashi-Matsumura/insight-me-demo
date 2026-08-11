import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-lg font-medium">ページが見つかりませんでした。</p>
      <p className="mt-2 text-sm text-muted">URLが正しいかご確認ください。</p>
      <Link href="/" className="mt-6 text-sm text-accent underline">
        トップへ戻る
      </Link>
    </div>
  );
}
