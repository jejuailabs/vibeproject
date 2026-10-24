import "server-only";
import { randomUUID } from "node:crypto";
import { bucket } from "./files";
import { transaction, readWorkshop } from "./workshop";
import { fail, optional, path } from "@/lib/workshop/core";
import type { AvatarPhoto } from "@/lib/workshop/profile";
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const HOURLY_LIMIT = 20;
type Rate = { at: string; count: number };
// The file's first bytes decide its type, so a renamed file cannot pass as an image.
function imageType(b: Buffer) {
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return { ext: "png", contentType: "image/png" };
  if (b[0] === 255 && b[1] === 216 && b[2] === 255)
    return { ext: "jpg", contentType: "image/jpeg" };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP")
    return { ext: "webp", contentType: "image/webp" };
  return null;
}
const recent = (rate: Rate | undefined, now: string) =>
  !!rate && Date.parse(now) - Date.parse(rate.at) < 3600000;
export async function uploadAvatar(cohortId: string, uid: string, bytes: Buffer) {
  if (!bytes.length) fail("사진 파일이 비어 있어요.", 400);
  if (bytes.length > MAX_PHOTO_BYTES) fail("사진은 3MB 이하로 올려주세요.", 413);
  const type = imageType(bytes);
  if (!type) fail("PNG, JPG, WebP 사진만 올릴 수 있어요.", 400);
  await readWorkshop(cohortId, uid, async (c) => {
    if ((await optional(c, "settings", "settings"))?.data.state === "completed")
      fail("종료된 기수는 읽기 전용입니다.");
    const rate = await c.store.read<Rate>(path(c, "avatarRates/" + uid));
    if (recent(rate, c.now) && rate!.count >= HOURLY_LIMIT)
      fail("사진은 한 시간에 " + HOURLY_LIMIT + "번까지 올릴 수 있어요.", 429);
  });
  const id = "photo-" + randomUUID(),
    token = randomUUID(),
    storagePath = "vibecoding2/avatars/" + cohortId + "/" + uid + "/" + id + "." + type.ext,
    b = bucket();
  // A download token makes the photo viewable by link, like the built-in character images.
  await b.file(storagePath).save(bytes, {
    resumable: false,
    contentType: type.contentType,
    metadata: {
      cacheControl: "public, max-age=31536000, immutable",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const url =
    "https://firebasestorage.googleapis.com/v0/b/" + b.name + "/o/" +
    encodeURIComponent(storagePath) + "?alt=media&token=" + token;
  return transaction(cohortId, uid, id, { id }, async (c) => {
    const rate = await c.store.read<Rate>(path(c, "avatarRates/" + uid)),
      again = recent(rate, c.now);
    c.store.write(path(c, "avatarRates/" + uid), {
      at: again ? rate!.at : c.now,
      count: again ? rate!.count + 1 : 1,
    });
    const photo: AvatarPhoto = { id, ownerId: uid, url, createdAt: c.now };
    c.store.write(path(c, "avatarPhotos/" + id), { ...photo, storagePath });
    return { photoId: id, url };
  });
}
