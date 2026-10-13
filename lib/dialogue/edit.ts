import { previousThemeId } from "./themes";
import {
  getReport,
  listMessagesForTheme,
  listThemeResults,
  type Message,
  type Session,
} from "@/lib/db/queries";

export interface EditableAnswer {
  themeId: string;
  /** 対象テーマの全メッセージ(オープナーは含まない) */
  messages: Message[];
  /** 修正対象(= そのテーマで最後のユーザー発言) */
  target: Message;
  /** 対象の発言を送った時点の probe_count(それより前にあるメンター発言の数) */
  probeCount: number;
}

/**
 * いま修正できる回答(= 直前の回答)を返す。無ければ null。
 * テーマ最後の回答は送信と同時に次テーマへ進んでしまうので、現テーマにまだ回答が
 * 無いときは1つ前のテーマの最後の回答を対象にする。全テーマ完了後も、レポートを
 * 作り始めるまでは最後の回答を直せる(レポートは対話内容から作るので、生成後は不可)。
 * app/api/chat/route.ts(修正の実行)と app/session/[id]/page.tsx(リロード時の
 * 修正ボタンの復元)が同じ判定を使う。
 */
export function findEditableAnswer(session: Session): EditableAnswer | null {
  if (session.status === "abandoned") return null;
  if (session.status === "completed" && getReport(session.id)) return null;

  let themeId = session.currentTheme;
  let messages = listMessagesForTheme(session.id, themeId);

  if (session.status === "active" && !messages.some((m) => m.role === "user")) {
    const prev = previousThemeId(themeId);
    if (!prev) return null;
    themeId = prev;
    messages = listMessagesForTheme(session.id, themeId);
  }

  // 「このテーマは飛ばす」で終えたテーマは、回答ではなくスキップが最後の操作なので対象外
  const result = listThemeResults(session.id).find((r) => r.themeId === themeId);
  if (result?.skipped) return null;

  const target = messages.filter((m) => m.role === "user").at(-1);
  if (!target) return null;

  const probeCount = messages.filter((m) => m.role === "assistant" && m.id < target.id).length;
  return { themeId, messages, target, probeCount };
}
