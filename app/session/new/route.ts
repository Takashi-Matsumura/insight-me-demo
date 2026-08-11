import { redirect } from "next/navigation";
import { createSession } from "@/lib/db/queries";

export async function POST(request: Request) {
  const formData = await request.formData();
  const raw = formData.get("studentName");
  const studentName = typeof raw === "string" ? raw.trim().slice(0, 40) : "";

  if (!studentName) {
    return new Response("お名前を入力してください。", { status: 400 });
  }

  const session = createSession(studentName);
  redirect(`/session/${session.id}`);
}
