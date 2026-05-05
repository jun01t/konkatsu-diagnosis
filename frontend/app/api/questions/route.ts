import { NextResponse } from "next/server";
import { ALL_QUESTIONS } from "@/lib/questions-data";

export const dynamic = "force-static";
export const revalidate = 60;

export function GET() {
  return NextResponse.json(ALL_QUESTIONS);
}
