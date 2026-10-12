import { NextResponse } from "next/server";
import { authenticatedUid } from "@/server/firebase";
import { upload, download, exportDocuments } from "@/server/files";
import { DomainError } from "@/lib/policy";
import { z } from "zod";
import { zipSync, strToU8 } from "fflate";
export const runtime = "nodejs";
export const maxDuration = 60;
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/);
function error(e: unknown) {
  return NextResponse.json(
    {
      error:
        e instanceof DomainError
          ? e.message
          : e instanceof z.ZodError
            ? "파일 요청을 확인해주세요."
            : "파일을 처리하지 못했습니다. 다시 시도해주세요.",
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
export async function POST(request: Request) {
  try {
    const identity = await authenticatedUid(request);
    if (!identity)
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    const text = await request.text();
    if (text.length > 10000)
      return NextResponse.json(
        { error: "요청이 너무 큽니다." },
        { status: 413 },
      );
    return NextResponse.json(await upload(identity.uid, JSON.parse(text)));
  } catch (e) {
    return error(e);
  }
}
export async function GET(request: Request) {
  try {
    const identity = await authenticatedUid(request);
    if (!identity)
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    const u = new URL(request.url),
      cohortId = id.parse(u.searchParams.get("cohortId")),
      target = id.parse(u.searchParams.get("id"));
    if (u.searchParams.get("type") === "export") {
      const value = await exportDocuments(cohortId, identity.uid, target);
      const bytes = zipSync(
        Object.fromEntries(
          Object.entries(value.files).map(([p, s]) => [
            p,
            [strToU8(s), { mtime: new Date("2000-01-01T00:00:00Z") }],
          ]),
        ),
      );
      return new Response(Buffer.from(bytes), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="' + target + '.zip"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    return NextResponse.json(await download(cohortId, identity.uid, target), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return error(e);
  }
}
