import { NextResponse } from "next/server";
import { authenticatedUid } from "@/server/firebase";
import { getPage } from "@/server/pages";
import { DomainError } from "@/lib/policy";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const user = await authenticatedUid(request);
    if (!user)
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return NextResponse.json(await getPage(user.uid, params), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof DomainError
            ? e.message
            : "이전 기록을 불러오지 못했습니다.",
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
