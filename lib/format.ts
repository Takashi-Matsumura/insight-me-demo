/** SQLite の datetime('now') は UTC・タイムゾーン表記無しの "YYYY-MM-DD HH:MM:SS" 形式で返る */
export function formatDateTime(sqliteUtc: string): string {
  return new Date(`${sqliteUtc.replace(" ", "T")}Z`).toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
