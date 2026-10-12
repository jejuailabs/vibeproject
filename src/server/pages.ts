import "server-only";
import { db } from "./firebase";
import { readWorkshop } from "./workshop";
import { canReadIdea, assertCanRead, assertChannel } from "@/lib/policy";
import { fail } from "@/lib/workshop/core";
import type { Idea } from "@/lib/types";
import { z } from "zod";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/);
export const pageQuery = z.object({
  cohortId: id,
  kind: z.enum(["ideas", "messages", "comments", "history"]),
  target: id.optional(),
  cursor: id.optional(),
});
export async function getPage(uid: string, raw: unknown) {
  const cmd = pageQuery.parse(raw);
  return readWorkshop(cmd.cohortId, uid, async (c) => {
    const root = db().collection("cohorts").doc(cmd.cohortId);
    let collection = root.collection("ideas");
    if (cmd.kind === "messages") {
      assertChannel(c.me, cmd.target || "cohort");
      collection = root
        .collection("channels")
        .doc(cmd.target || "cohort")
        .collection("messages");
    }
    if (cmd.kind === "comments" || cmd.kind === "history") {
      if (!cmd.target) fail("아이디어를 선택해주세요.", 400);
      const i = await c.store.read<Idea>(root.path + "/ideas/" + cmd.target);
      if (!i) fail("아이디어를 찾을 수 없습니다.", 404);
      assertCanRead(c.me, i);
      collection = root
        .collection("ideas")
        .doc(cmd.target)
        .collection(cmd.kind);
    }
    let query =
      cmd.kind === "ideas"
        ? collection.orderBy("__name__").limit(50)
        : collection
            .orderBy("createdAt", "desc")
            .orderBy("__name__", "desc")
            .limit(50);
    if (cmd.cursor) {
      const cursor = await collection.doc(cmd.cursor).get();
      if (!cursor.exists)
        fail("이전 페이지가 변경되었습니다. 새로고침해주세요.");
      query = query.startAfter(cursor);
    }
    const snap = await query.get(),
      items = snap.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .filter((d) => cmd.kind !== "ideas" || canReadIdea(c.me, d as Idea));
    return {
      items,
      nextCursor: snap.size === 50 ? snap.docs.at(-1)!.id : null,
    };
  });
}
