import {
  getSession,
  listThemeResults,
  getReport,
  upsertReport,
  initCareerMatches,
  listCareerMatches,
  updateCareerMatchReason,
  type CareerMatch,
} from "@/lib/db/queries";
import { getCareerById, getCategoryLabel, type Career } from "@/lib/careers/catalog";
import { prefilter } from "@/lib/careers/prefilter";
import { streamText } from "@/lib/llm/chat";
import { generateText } from "@/lib/llm/client";
import { generateStructured } from "@/lib/llm/structured";
import { encodeSseEvent } from "@/lib/llm/sse";
import { LlmError, llmErrorMessage } from "@/lib/llm/errors";
import { CAREER_SELECTION_SCHEMA, type CareerSelectionResult } from "@/lib/report/schemas";
import {
  buildReasonMessages,
  buildStudentProfileText,
  buildSelectionMessages,
  buildSummaryMessages,
  collectTags,
  selectReportThemeResults,
} from "@/lib/report/prompts";
import { validateAndBackfillPicks } from "@/lib/report/selection";

export const dynamic = "force-dynamic";

interface ReportRequestBody {
  sessionId?: unknown;
}

function careerCardPayload(career: Career, match: CareerMatch) {
  return {
    careerId: career.id,
    rank: match.rank,
    fitScore: match.fitScore,
    isDiscovery: match.isDiscovery,
    obscurity: career.obscurity,
    name: career.name,
    categoryLabel: getCategoryLabel(career.category),
    oneLiner: career.oneLiner,
    detail: career.detail,
    goodFit: career.goodFit,
    dayInLife: career.dayInLife,
    skills: career.skills,
    nextStep: career.nextStep,
    relatedMajors: career.relatedMajors,
    reason: match.reason,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ReportRequestBody | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) {
    return Response.json({ error: "sessionId が必要です" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return Response.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  if (session.status !== "completed") {
    return Response.json({ error: "対話がまだ完了していません" }, { status: 400 });
  }

  const themeResults = selectReportThemeResults(listThemeResults(sessionId));
  if (themeResults.length === 0) {
    return Response.json(
      { error: "レポートを作成できるだけの対話がありません" },
      { status: 400 },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encodeSseEvent(data));

      try {
        const existingReport = getReport(sessionId);
        let profileMd: string;
        let strengths: string[];
        let values: string[];
        let matches: CareerMatch[];

        if (existingReport) {
          // 再開: ステージA/Bは前回実行済み。DBの内容をそのまま即座に流す。
          profileMd = existingReport.profileMd;
          strengths = existingReport.strengths;
          values = existingReport.values;
          send({ type: "summary_text", text: profileMd });
          send({ type: "profile", strengths, values });

          matches = listCareerMatches(sessionId);
          for (const m of matches) {
            const career = getCareerById(m.careerId);
            if (!career) continue;
            send({ type: "career", ...careerCardPayload(career, m) });
          }
        } else {
          // 新規生成: ステージA(ストリーミング)とステージB(構造化)を並列実行する
          const profileText = buildStudentProfileText(themeResults);
          const prefiltered = prefilter(collectTags(themeResults));

          const [summaryText, selection] = await Promise.all([
            (async () => {
              let acc = "";
              for await (const piece of streamText(buildSummaryMessages(profileText), {
                maxTokens: 320,
                signal: request.signal,
              })) {
                acc += piece;
                send({ type: "summary_text", text: piece });
              }
              return acc.trim();
            })(),
            generateStructured<CareerSelectionResult>({
              messages: buildSelectionMessages(profileText, prefiltered.candidates),
              schema: CAREER_SELECTION_SCHEMA,
              // strengths(3)+values(3)+picks(6件×id/fitScore/keyLink) で
              // 実測 400〜500tok 前後まで伸びるため余裕を持たせる(260だと finish_reason:"length" で
              // JSONが途中で切れて解析エラーになることを確認済み)
              maxTokens: 700,
              signal: request.signal,
              timeoutMs: 60_000,
            }),
          ]);

          profileMd = summaryText;
          strengths = selection.strengths;
          values = selection.values;

          const validPicks = validateAndBackfillPicks(selection.picks, prefiltered.candidates);

          upsertReport({ sessionId, profileMd, strengths, values, status: "partial" });
          initCareerMatches(
            sessionId,
            validPicks.map((p, i) => ({
              careerId: p.id,
              rank: i + 1,
              fitScore: p.fitScore,
              isDiscovery: prefiltered.discoveryIds.includes(p.id),
            })),
          );

          send({ type: "profile", strengths, values });

          matches = listCareerMatches(sessionId);
          for (const m of matches) {
            const career = getCareerById(m.careerId);
            if (!career) continue;
            send({ type: "career", ...careerCardPayload(career, m) });
          }
        }

        // ステージC: 理由が未生成のものだけ生成する(同時実行数は lib/llm/queue が制御)
        const pending = matches.filter((m) => !m.reason);
        await Promise.all(
          pending.map(async (match) => {
            const career = getCareerById(match.careerId);
            if (!career) return;
            try {
              const reason = await generateText({
                messages: buildReasonMessages(career, themeResults),
                maxTokens: 160,
                temperature: 0.7,
                signal: request.signal,
                timeoutMs: 30_000,
              });
              updateCareerMatchReason(sessionId, match.careerId, {
                reason,
                nextStep: career.nextStep,
              });
              send({ type: "career_reason", careerId: match.careerId, reason });
            } catch (e) {
              const message = e instanceof LlmError ? e.message : llmErrorMessage("UNKNOWN");
              send({ type: "career_reason_error", careerId: match.careerId, message });
            }
          }),
        );

        upsertReport({ sessionId, profileMd, strengths, values, status: "complete" });
        send({ type: "done" });
      } catch (e) {
        const code = e instanceof LlmError ? e.code : "UNKNOWN";
        const message = e instanceof LlmError ? e.message : llmErrorMessage("UNKNOWN");
        send({
          type: "error",
          code,
          message,
          retryable: code === "UNAVAILABLE" || code === "TIMEOUT",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
