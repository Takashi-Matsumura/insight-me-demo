import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

function createDb(): DatabaseSync {
  const dataDir = path.join(process.cwd(), "data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const file = process.env.DATABASE_PATH ?? path.join(dataDir, "insight-me.db");
  const db = new DatabaseSync(file);
  // ビルド時は複数ワーカーが同時に同じ新規DBファイルへスキーマを適用しようとし、
  // 書き込みロックが競合して SQLITE_BUSY (database is locked) になることがある。
  db.exec("PRAGMA busy_timeout = 5000;");

  const schemaPath = path.join(process.cwd(), "lib", "db", "schema.sql");
  db.exec(readFileSync(schemaPath, "utf8"));

  return db;
}

// Next.js の dev サーバは HMR のたびにモジュールを再評価する。
// globalThis に固定しないと DatabaseSync が積み上がり、WAL のロック競合と
// ファイルディスクリプタ枯渇を起こす。
const globalForDb = globalThis as unknown as { __insightDb?: DatabaseSync };
export const db: DatabaseSync = (globalForDb.__insightDb ??= createDb());
