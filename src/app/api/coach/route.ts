import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedUid } from "@/server/firebase";
import { coach } from "@/server/coach";
import { DomainError } from "@/lib/policy";
export const runtime = "nodejs";
export const maxDuration = 40;
export async function POST(request: Request) {
  try {
    const user = await authenticatedUid(request);
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const raw = await request.text();
    if (raw.length > 40000) return NextResponse.json({ error: "요청이 너무 깁니다." }, { status: 413 });
    return NextResponse.json(await coach(user.uid, JSON.parse(raw)));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof DomainError ? e.message : e instanceof z.ZodError ? "코치 요청을 확인해주세요." : "AI 코치가 답하지 못했어요. 다시 시도해주세요." },
      { status: e instanceof DomainError ? e.status : e instanceof z.ZodError ? 400 : 503 },
    );
  }
}
