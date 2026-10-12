import { NextResponse } from "next/server";
import { authenticatedUid } from "@/server/firebase";
import { getSnapshot, runWorkshop } from "@/server/workshop";
import { workshopEnvelope } from "@/lib/workshop/commands";
import { DomainError } from "@/lib/policy";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/);
function error(e: unknown) {
  return NextResponse.json(
    {
      error:
        e instanceof DomainError
          ? e.message
          : e instanceof z.ZodError
            ? "입력 내용을 확인해주세요."
            : "처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
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
export async function GET(request: Request) {
  try {
    const user = await authenticatedUid(request);
    if (!user)
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    const u = new URL(request.url);
    return NextResponse.json(
      await getSnapshot(
        id.parse(u.searchParams.get("cohortId")),
        user.uid,
        u.searchParams.get("cursor")
          ? id.parse(u.searchParams.get("cursor"))
          : undefined,
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return error(e);
  }
}
export async function POST(request: Request) {
  try {
    const user = await authenticatedUid(request);
    if (!user)
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1000000)
      return NextResponse.json(
        { error: "입력이 너무 큽니다." },
        { status: 413 },
      );
    const value = workshopEnvelope.parse(JSON.parse(raw));
    return NextResponse.json(
      await runWorkshop(
        value.cohortId,
        user.uid,
        value.requestId,
        value.command,
      ),
    );
  } catch (e) {
    return error(e);
  }
}
