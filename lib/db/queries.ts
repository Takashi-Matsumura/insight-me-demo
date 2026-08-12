import { randomUUID } from "node:crypto";
import { db } from "./index";
import { normalizeReadingLevel, type ReadingLevel } from "@/lib/reading-level";

// ---------- 型 ----------

export type SessionStatus = "active" | "completed" | "abandoned";

export interface Session {
  id: string;
  studentName: string;
  status: SessionStatus;
  currentTheme: string;
  probeCount: number;
  createdAt: string;
  updatedAt: string;
  readingLevel: ReadingLevel;
}

export interface Message {
  id: number;
  sessionId: string;
  themeId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ThemeResult {
  id: number;
  sessionId: string;
  themeId: string;
  skipped: boolean;
  quote: string | null;
  label: string | null;
  reframe: string | null;
  summary: string | null;
  tags: string[];
  createdAt: string;
}

export interface Report {
  sessionId: string;
  profileMd: string;
  strengths: string[];
  values: string[];
  status: "partial" | "complete";
  createdAt: string;
}

export interface CareerMatch {
  id: number;
  sessionId: string;
  careerId: string;
  rank: number;
  fitScore: number;
  isDiscovery: boolean;
  reason: string | null;
  nextStep: string | null;
  createdAt: string;
}

// ---------- row → 型 変換 ----------
// node:sqlite が返す行は null-prototype オブジェクトなので、
// snake_case → camelCase の変換を兼ねてここで詰め替える。

interface SessionRow {
  id: string;
  student_name: string;
  status: string;
  current_theme: string;
  probe_count: number;
  created_at: string;
  updated_at: string;
  reading_level: string;
}
function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    studentName: row.student_name,
    status: row.status as SessionStatus,
    currentTheme: row.current_theme,
    probeCount: row.probe_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // 手編集されたDBや、万一マイグレーション前の行を読んだ場合(undefined)でも
    // 必ず有効な値に落とす
    readingLevel: normalizeReadingLevel(row.reading_level),
  };
}

interface MessageRow {
  id: number;
  session_id: string;
  theme_id: string;
  role: string;
  content: string;
  created_at: string;
}
function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    themeId: row.theme_id,
    role: row.role as Message["role"],
    content: row.content,
    createdAt: row.created_at,
  };
}

interface ThemeResultRow {
  id: number;
  session_id: string;
  theme_id: string;
  skipped: number;
  quote: string | null;
  label: string | null;
  reframe: string | null;
  summary: string | null;
  tags_json: string;
  created_at: string;
}
function mapThemeResult(row: ThemeResultRow): ThemeResult {
  return {
    id: row.id,
    sessionId: row.session_id,
    themeId: row.theme_id,
    skipped: row.skipped === 1,
    quote: row.quote,
    label: row.label,
    reframe: row.reframe,
    summary: row.summary,
    tags: JSON.parse(row.tags_json) as string[],
    createdAt: row.created_at,
  };
}

interface ReportRow {
  session_id: string;
  profile_md: string;
  strengths_json: string;
  values_json: string;
  status: string;
  created_at: string;
}
function mapReport(row: ReportRow): Report {
  return {
    sessionId: row.session_id,
    profileMd: row.profile_md,
    strengths: JSON.parse(row.strengths_json) as string[],
    values: JSON.parse(row.values_json) as string[],
    status: row.status as Report["status"],
    createdAt: row.created_at,
  };
}

interface CareerMatchRow {
  id: number;
  session_id: string;
  career_id: string;
  rank: number;
  fit_score: number;
  is_discovery: number;
  reason: string | null;
  next_step: string | null;
  created_at: string;
}
function mapCareerMatch(row: CareerMatchRow): CareerMatch {
  return {
    id: row.id,
    sessionId: row.session_id,
    careerId: row.career_id,
    rank: row.rank,
    fitScore: row.fit_score,
    isDiscovery: row.is_discovery === 1,
    reason: row.reason,
    nextStep: row.next_step,
    createdAt: row.created_at,
  };
}

// ---------- sessions ----------

export function createSession(studentName: string, readingLevel: ReadingLevel): Session {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO sessions (id, student_name, reading_level) VALUES (?, ?, ?)",
  ).run(id, studentName, readingLevel);
  const session = getSession(id);
  if (!session) throw new Error("セッションの作成に失敗しました");
  return session;
}

export function getSession(id: string): Session | undefined {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as unknown as SessionRow | undefined;
  return row ? mapSession(row) : undefined;
}

export function listSessions(): Session[] {
  const rows = db
    .prepare("SELECT * FROM sessions ORDER BY created_at DESC")
    .all() as unknown as SessionRow[];
  return rows.map(mapSession);
}

export function updateSessionProgress(
  id: string,
  input: { currentTheme: string; probeCount: number },
): void {
  db.prepare(
    "UPDATE sessions SET current_theme = ?, probe_count = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(input.currentTheme, input.probeCount, id);
}

export function updateSessionStatus(id: string, status: SessionStatus): void {
  db.prepare(
    "UPDATE sessions SET status = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(status, id);
}

// ---------- messages ----------

export function addMessage(input: {
  sessionId: string;
  themeId: string;
  role: "user" | "assistant";
  content: string;
}): Message {
  const result = db
    .prepare(
      "INSERT INTO messages (session_id, theme_id, role, content) VALUES (?, ?, ?, ?)",
    )
    .run(input.sessionId, input.themeId, input.role, input.content);
  const row = db
    .prepare("SELECT * FROM messages WHERE id = ?")
    .get(result.lastInsertRowid) as unknown as MessageRow;
  return mapMessage(row);
}

export function listMessages(sessionId: string): Message[] {
  const rows = db
    .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY id")
    .all(sessionId) as unknown as MessageRow[];
  return rows.map(mapMessage);
}

export function listMessagesForTheme(sessionId: string, themeId: string): Message[] {
  const rows = db
    .prepare("SELECT * FROM messages WHERE session_id = ? AND theme_id = ? ORDER BY id")
    .all(sessionId, themeId) as unknown as MessageRow[];
  return rows.map(mapMessage);
}

// ---------- theme_results ----------

export function upsertThemeResult(input: {
  sessionId: string;
  themeId: string;
  skipped?: boolean;
  quote?: string | null;
  label?: string | null;
  reframe?: string | null;
  summary?: string | null;
  tags?: string[];
}): ThemeResult {
  db.prepare(
    `INSERT INTO theme_results (session_id, theme_id, skipped, quote, label, reframe, summary, tags_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id, theme_id) DO UPDATE SET
       skipped = excluded.skipped,
       quote = excluded.quote,
       label = excluded.label,
       reframe = excluded.reframe,
       summary = excluded.summary,
       tags_json = excluded.tags_json`,
  ).run(
    input.sessionId,
    input.themeId,
    input.skipped ? 1 : 0,
    input.quote ?? null,
    input.label ?? null,
    input.reframe ?? null,
    input.summary ?? null,
    JSON.stringify(input.tags ?? []),
  );
  const row = db
    .prepare("SELECT * FROM theme_results WHERE session_id = ? AND theme_id = ?")
    .get(input.sessionId, input.themeId) as unknown as ThemeResultRow;
  return mapThemeResult(row);
}

export function listThemeResults(sessionId: string): ThemeResult[] {
  const rows = db
    .prepare("SELECT * FROM theme_results WHERE session_id = ? ORDER BY id")
    .all(sessionId) as unknown as ThemeResultRow[];
  return rows.map(mapThemeResult);
}

// ---------- reports ----------

export function getReport(sessionId: string): Report | undefined {
  const row = db
    .prepare("SELECT * FROM reports WHERE session_id = ?")
    .get(sessionId) as unknown as ReportRow | undefined;
  return row ? mapReport(row) : undefined;
}

export function upsertReport(input: {
  sessionId: string;
  profileMd: string;
  strengths?: string[];
  values?: string[];
  status?: "partial" | "complete";
}): Report {
  db.prepare(
    `INSERT INTO reports (session_id, profile_md, strengths_json, values_json, status)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       profile_md = excluded.profile_md,
       strengths_json = excluded.strengths_json,
       values_json = excluded.values_json,
       status = excluded.status`,
  ).run(
    input.sessionId,
    input.profileMd,
    JSON.stringify(input.strengths ?? []),
    JSON.stringify(input.values ?? []),
    input.status ?? "partial",
  );
  const row = db
    .prepare("SELECT * FROM reports WHERE session_id = ?")
    .get(input.sessionId) as unknown as ReportRow;
  return mapReport(row);
}

// ---------- career_matches ----------

/** ステージBの選定直後に、理由が空のまま行を先行INSERTする。
 *  途中でリロードされても「カードは6枚あるが理由が一部だけ埋まっている」
 *  状態を正しく復元し、未生成分だけ再開できるようにするため。 */
export function initCareerMatches(
  sessionId: string,
  picks: { careerId: string; rank: number; fitScore: number; isDiscovery: boolean }[],
): void {
  const stmt = db.prepare(
    `INSERT INTO career_matches (session_id, career_id, rank, fit_score, is_discovery)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(session_id, career_id) DO UPDATE SET
       rank = excluded.rank,
       fit_score = excluded.fit_score,
       is_discovery = excluded.is_discovery`,
  );
  for (const pick of picks) {
    stmt.run(sessionId, pick.careerId, pick.rank, pick.fitScore, pick.isDiscovery ? 1 : 0);
  }
}

export function updateCareerMatchReason(
  sessionId: string,
  careerId: string,
  input: { reason: string; nextStep: string },
): void {
  db.prepare(
    "UPDATE career_matches SET reason = ?, next_step = ? WHERE session_id = ? AND career_id = ?",
  ).run(input.reason, input.nextStep, sessionId, careerId);
}

export function listCareerMatches(sessionId: string): CareerMatch[] {
  const rows = db
    .prepare("SELECT * FROM career_matches WHERE session_id = ? ORDER BY rank")
    .all(sessionId) as unknown as CareerMatchRow[];
  return rows.map(mapCareerMatch);
}

// ---------- career_fits ----------
// 職業一覧ダイアログの「AIにもっと詳しく書いてもらう」結果のキャッシュ。
// career_matches（おすすめ6件専用）とは別テーブル。最大70件/セッション入りうる。

export function getCareerFit(sessionId: string, careerId: string): string | undefined {
  const row = db
    .prepare("SELECT text FROM career_fits WHERE session_id = ? AND career_id = ?")
    .get(sessionId, careerId) as unknown as { text: string } | undefined;
  return row?.text;
}

export function upsertCareerFit(sessionId: string, careerId: string, text: string): void {
  db.prepare(
    `INSERT INTO career_fits (session_id, career_id, text) VALUES (?, ?, ?)
     ON CONFLICT(session_id, career_id) DO UPDATE SET text = excluded.text`,
  ).run(sessionId, careerId, text);
}
