export default function Loading() {
  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <main className="mx-auto w-full max-w-2xl animate-pulse">
        <div className="h-6 w-40 rounded bg-border" />
        <div className="mt-2 h-4 w-56 rounded bg-border" />
        <div className="mt-6 h-16 rounded-lg bg-border" />
      </main>
    </div>
  );
}
