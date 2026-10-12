import { NextResponse } from "next/server";
import { authenticatedUid } from "@/server/firebase";
import { analyze } from "@/server/ai";
import { DomainError } from "@/lib/policy";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const user = await authenticatedUid(request);
    if (!user)
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    const raw = await request.text();
    if (raw.length > 5000)
      return NextResponse.json(
        { error: "요청이 너무 깁니다." },
        { status: 413 },
      );
    return NextResponse.json(await analyze(user.uid, JSON.parse(raw)));
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof DomainError
            ? e.message
            : e instanceof z.ZodError
              ? "분석 요청을 확인해주세요."
              : "분석을 완료하지 못했습니다.",
      },
      {
        status:
          e instanceof DomainError
            ? e.status
            : e instanceof z.ZodError
              ? 400
              : 503,
      },
    );
  }
}
