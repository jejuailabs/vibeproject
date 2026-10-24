import { NextResponse } from "next/server";
import { authenticatedUid } from "@/server/firebase";
import { uploadAvatar, MAX_PHOTO_BYTES } from "@/server/profile";
import { DomainError } from "@/lib/policy";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 60;
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/);
// The photo travels as the raw request body; the nickname and the choice are saved by the updateProfile command.
export async function POST(request: Request) {
  try {
    const identity = await authenticatedUid(request);
    if (!identity)
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const cohortId = id.parse(new URL(request.url).searchParams.get("cohortId"));
    if (Number(request.headers.get("content-length") || 0) > MAX_PHOTO_BYTES)
      return NextResponse.json({ error: "사진은 3MB 이하로 올려주세요." }, { status: 413 });
    const bytes = Buffer.from(await request.arrayBuffer());
    return NextResponse.json(await uploadAvatar(cohortId, identity.uid, bytes));
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof DomainError
            ? e.message
            : e instanceof z.ZodError
              ? "요청을 확인해주세요."
              : "사진을 올리지 못했어요. 다시 시도해주세요.",
      },
      { status: e instanceof DomainError ? e.status : e instanceof z.ZodError ? 400 : 503 },
    );
  }
}
