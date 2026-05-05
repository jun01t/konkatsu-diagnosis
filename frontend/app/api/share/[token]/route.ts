import { NextResponse } from "next/server";
import { decodeShareToken } from "@/lib/share-token";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const payload = decodeShareToken(token);
  if (!payload) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json({
    score: payload.score,
    headline: payload.headline,
  });
}
