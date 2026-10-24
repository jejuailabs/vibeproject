import type { Context } from "./model";
import type { WorkshopCommand } from "./commands";
import type { Member } from "../types";
import { isCharacterId } from "../characters";
import { fail, path } from "./core";

// A photo a member uploaded; the server writes it after checking the file, and only its owner can use it.
export type AvatarPhoto = { id: string; ownerId: string; url: string; createdAt: string };
const same = (a: string) => a.toLowerCase();

export async function profile(c: Context, cmd: WorkshopCommand) {
  if (cmd.type !== "updateProfile") return undefined;
  const members = await c.store.list<Member>(path(c, "members"));
  if (members.some((m) => m.id !== c.uid && same(m.name) === same(cmd.name)))
    fail("이미 다른 사람이 쓰는 닉네임이에요. 다른 닉네임을 골라주세요.");
  let avatar = cmd.avatar ?? c.me.avatar;
  if (cmd.avatar && !isCharacterId(cmd.avatar)) {
    const photo = await c.store.read<AvatarPhoto>(path(c, "avatarPhotos/" + cmd.avatar));
    if (!photo || photo.ownerId !== c.uid) fail("올린 사진을 찾을 수 없어요. 다시 올려주세요.", 404);
    avatar = photo.url;
  }
  const patch = { name: cmd.name, avatar };
  c.store.write(path(c, "members/" + c.uid), patch, true);
  c.store.write(path(c, "profiles/" + c.uid), patch, true);
  c.me = { ...c.me, ...patch };
  return { id: c.uid };
}
