import "server-only";
import { getStorage } from "firebase-admin/storage";
import { firebaseApp } from "./firebase";
import { transaction, readWorkshop } from "./workshop";
import {
  record,
  write,
  optional,
  editableProject,
  fail,
  path,
} from "@/lib/workshop/core";
import { baselineArchive } from "@/lib/workshop/export";
import { z } from "zod";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/);
export const fileCommand = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("start"),
      cohortId: id,
      requestId: z.string().uuid(),
      name: z.string().min(1).max(180),
      size: z.number().int().min(1).max(10485760),
      scope: z.enum(["owner", "project", "cohort"]),
      projectId: id.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("finish"),
      cohortId: id,
      requestId: z.string().uuid(),
      assetId: id,
    })
    .strict(),
]);
const mime: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
};
export function bucket() {
  return getStorage(firebaseApp()).bucket(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  );
}
export async function upload(uid: string, raw: unknown) {
  const cmd = fileCommand.parse(raw);
  if (cmd.type === "start") {
    const ext = cmd.name.split(".").at(-1)?.toLowerCase() || "",
      contentType = mime[ext];
    if (!contentType)
      fail("PNG, JPG, WebP, PDF, TXT, MD만 업로드할 수 있습니다.", 400);
    const result = await transaction(
      cmd.cohortId,
      uid,
      cmd.requestId,
      cmd,
      async (c) => {
        const settings = await optional(c, "settings", "settings");
        if (settings?.data.state === "completed")
          fail("종료된 기수는 읽기 전용입니다.");
        if (cmd.scope === "project") {
          if (!cmd.projectId) fail("프로젝트가 필요합니다.");
          await editableProject(c, cmd.projectId);
        } else if (cmd.projectId) fail("공개 범위가 올바르지 않습니다.");
        const rate = await c.store.read<{ at: string; count: number }>(
          path(c, "uploadRates/" + uid),
        );
        const recent =
          rate && Date.parse(c.now) - Date.parse(rate.at) < 3600000;
        if (recent && rate.count >= 30)
          fail("시간당 업로드 수를 초과했습니다.", 429);
        c.store.write(path(c, "uploadRates/" + uid), {
          at: recent ? rate.at : c.now,
          count: recent ? rate.count + 1 : 1,
        });
        const assetId = "asset-" + cmd.requestId,
          storagePath =
            "vibecoding2/private/" + cmd.cohortId + "/" + assetId + "." + ext;
        const name = cmd.name.replace(/[\\/\x00-\x1f\x7f]/g, "_");
        write(
          c,
          assetId,
          "asset",
          {
            name,
            contentType,
            size: cmd.size,
            storagePath,
            state: "pending",
            generation: "",
          },
          cmd.scope,
          cmd.projectId,
        );
        return { assetId, storagePath, contentType, size: cmd.size };
      },
    );
    const [url] = await bucket()
      .file(result.storagePath)
      .getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 300000,
        contentType: result.contentType,
        extensionHeaders: {
          "content-length": String(result.size),
          "x-goog-if-generation-match": "0",
        },
      });
    return { assetId: result.assetId, url, contentType: result.contentType };
  }
  const asset = await readWorkshop(cmd.cohortId, uid, async (c) => {
    const a = await record(c, cmd.assetId, "asset");
    if (a.ownerId !== uid) fail("업로드 작성자만 확정할 수 있습니다.", 403);
    return a;
  });
  const file = bucket().file(asset.data.storagePath),
    [meta] = await file.getMetadata();
  if (
    Number(meta.size) !== asset.data.size ||
    meta.contentType !== asset.data.contentType
  )
    fail("파일 크기 또는 형식이 일치하지 않습니다.", 400);
  const [head] = await file.download({ start: 0, end: 4095 });
  const type = asset.data.contentType;
  const valid =
    type === "image/png"
      ? head
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : type === "image/jpeg"
        ? head[0] === 255 && head[1] === 216 && head[2] === 255
        : type === "image/webp"
          ? head.toString("ascii", 0, 4) === "RIFF" &&
            head.toString("ascii", 8, 12) === "WEBP"
          : type === "application/pdf"
            ? head.toString("ascii", 0, 5) === "%PDF-"
            : !head.includes(0);
  if (!valid) fail("파일 내용과 확장자가 일치하지 않습니다.", 400);
  return transaction(
    cmd.cohortId,
    uid,
    cmd.requestId + "-verified",
    { assetId: cmd.assetId, generation: String(meta.generation) },
    async (c) => {
      const a = await record(c, cmd.assetId, "asset");
      if (a.ownerId !== uid) fail("권한이 없습니다.", 403);
      const settings = await optional(c, "settings", "settings");
      if (settings?.data.state === "completed") fail("종료된 기수입니다.");
      if (a.data.state === "ready") {
        if (a.data.generation !== String(meta.generation))
          fail("업로드한 파일이 변경되었습니다.");
        return { id: a.id };
      }
      write(
        c,
        a.id,
        "asset",
        { ...a.data, state: "ready", generation: String(meta.generation) },
        a.scope,
        a.projectId,
        a.ownerId,
        a,
      );
      return { id: a.id };
    },
  );
}
export async function download(cohortId: string, uid: string, assetId: string) {
  // Each download performs a fresh membership and ACL check; URL lifetime is 60 seconds.
  const a = await readWorkshop(cohortId, uid, (c) =>
    record(c, assetId, "asset"),
  );
  if (a.data.state !== "ready") fail("업로드가 완료되지 않았습니다.");
  const file = bucket().file(a.data.storagePath),
    [meta] = await file.getMetadata();
  if (String(meta.generation) !== a.data.generation)
    fail("파일이 변경되었습니다.");
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 60000,
    queryParams: { generation: a.data.generation },
    responseDisposition:
      "attachment; filename*=UTF-8''" + encodeURIComponent(a.data.name),
  });
  return { url };
}
export async function exportDocuments(
  cohortId: string,
  uid: string,
  baselineId: string,
) {
  return readWorkshop(cohortId, uid, async (c) => {
    const b = await record(c, baselineId, "baseline"),
      versions = await Promise.all(
        b.data.versions.map((v) => record(c, v.id, "version")),
      );
    const p = await c.store.read<{ name: string }>(
      "cohorts/" + cohortId + "/projects/" + b.projectId,
    );
    const output = await baselineArchive(b, versions, p?.name || "프로젝트");
    // Do not store binary data in Firestore/idempotency.
    return { files: output.files, name: b.id };
  });
}
