import { redirect } from "next/navigation";
import { createSession } from "@/lib/db/queries";
import { normalizeReadingLevel } from "@/lib/reading-level";

export async function POST(request: Request) {
  const formData = await request.formData();
  const raw = formData.get("studentName");
  const studentName = typeof raw === "string" ? raw.trim().slice(0, 40) : "";

  if (!studentName) {
    return new Response("お名前を入力してください。", { status: 400 });
  }

  // studentName の slice(0,40) と同じ方針で、不正値・未送信は黙って既定値に落とす
  const readingLevel = normalizeReadingLevel(formData.get("readingLevel"));

  const session = createSession(studentName, readingLevel);
  redirect(`/session/${session.id}`);
}
