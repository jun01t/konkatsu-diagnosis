import { NextResponse } from "next/server";
import { diagnose } from "@/lib/diagnose-server";
import { ALL_QUESTIONS } from "@/lib/questions-data";
import { encodeShareToken } from "@/lib/share-token";

export const maxDuration = 60;

type Body = { answers?: Record<string, string> };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new NextResponse("invalid json", { status: 400 });
  }
  const answers = body.answers ?? {};
  for (const q of ALL_QUESTIONS) {
    if (!(answers[q.id] ?? "").trim()) {
      return new NextResponse("missing answers", { status: 400 });
    }
  }

  try {
    const res = await diagnose(answers);
    const token = encodeShareToken({
      score: res.score,
      headline: res.headline,
    });
    return NextResponse.json({
      score: res.score,
      headline: res.headline,
      bullets: res.bullets,
      shareText: res.shareText,
      sharePath: `/share/${token}`,
    });
  } catch (e) {
    console.error("diagnose:", e);
    return new NextResponse("diagnosis failed", { status: 500 });
  }
}
