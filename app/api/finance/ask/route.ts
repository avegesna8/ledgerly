import { NextResponse } from "next/server";
import { answerFinanceQuestion } from "@/lib/finance-question";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const question =
    typeof body?.question === "string" ? body.question.trim() : "";
  if (question.length < 3)
    return NextResponse.json(
      { error: "Ask a complete financial question." },
      { status: 400 },
    );
  if (question.length > 500)
    return NextResponse.json(
      { error: "Keep the question under 500 characters." },
      { status: 400 },
    );
  try {
    return NextResponse.json(await answerFinanceQuestion(question));
  } catch (error) {
    console.error("Finance question error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ledgerly could not answer that question.",
      },
      { status: 502 },
    );
  }
}
