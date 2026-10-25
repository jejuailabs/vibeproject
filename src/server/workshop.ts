import "server-only";
import { createHash } from "node:crypto";
import type { Transaction, Query } from "firebase-admin/firestore";
import { db } from "./firebase";
import type {
  Store,
  Context,
  WorkshopRecord,
  RecordOf,
  Snapshot,
} from "@/lib/workshop/model";
import type { Member, Project } from "@/lib/types";
import { canRead, fail } from "@/lib/workshop/core";
import { applyWorkshop } from "@/lib/workshop/engine";
import { workshopCommand } from "@/lib/workshop/commands";
export class FirebaseStore implements Store {
  pending = new Map<string, { value: unknown; merge: boolean } | null>();
  constructor(private tx: Transaction) {}
  async read<T>(p: string): Promise<T | undefined> {
    p = p.replace(/\/$/, "");
    const pending = this.pending.get(p);
    if (pending === null) return undefined;
    if (pending && !pending.merge) return pending.value as T;
    const snap = await this.tx.get(db().doc(p));
    return pending
      ? ({ ...snap.data(), ...(pending.value as object) } as T)
      : snap.exists
        ? ({ ...snap.data(), id: snap.id } as T)
        : undefined;
  }
  async list<T>(
    p: string,
    where: { field: string; value: unknown }[] = [],
  ): Promise<T[]> {
    let q: Query = db().collection(p);
    for (const w of where) q = q.where(w.field, "==", w.value);
    const snap = await this.tx.get(q);
    const map = new Map(
      snap.docs.map((d) => [d.ref.path, { ...d.data(), id: d.id }]),
    );
    for (const [k, v] of this.pending) {
      if (!k.startsWith(p + "/") || k.slice(p.length + 1).includes("/"))
        continue;
      if (v === null) {
        map.delete(k);
        continue;
      }
      const value = v.merge
        ? { ...map.get(k), ...(v.value as object) }
        : (v.value as any);
      if (
        where.every(
          (w) =>
            w.field.split(".").reduce((a: any, b) => a?.[b], value) === w.value,
        )
      )
        map.set(k, value);
      else map.delete(k);
    }
    return [...map.values()] as T[];
  }
  write(p: string, value: unknown, merge = false) {
    p = p.replace(/\/$/, "");
    const old = this.pending.get(p);
    if (merge && old)
      this.pending.set(p, {
        value: { ...(old.value as object), ...(value as object) },
        merge: old.merge,
      });
    else this.pending.set(p, { value, merge });
  }
  remove(p: string) {
    this.pending.set(p, null);
  }
  flush() {
    for (const [p, v] of this.pending) {
      if (v === null) this.tx.delete(db().doc(p));
      else
        this.tx.set(db().doc(p), v.value as Record<string, unknown>, {
          merge: v.merge,
        });
    }
  }
}
export async function context(
  store: Store,
  cohortId: string,
  uid: string,
  requestId: string,
): Promise<Context> {
  const me = await store.read<Member>(
    "cohorts/" + cohortId + "/members/" + uid,
  );
  if (!me?.active) fail("기수 참여 권한이 필요합니다.", 403);
  const grants = (
    await store.list<RecordOf<"support">>("cohorts/" + cohortId + "/workshop", [
      { field: "ownerId", value: uid },
      { field: "kind", value: "support" },
    ])
  ).filter((r) => r.kind === "support");
  return {
    store,
    uid,
    me,
    cohortId,
    requestId,
    now: new Date().toISOString(),
    grants: me.role === "participant" ? [] : grants,
  };
}
export async function transaction<T>(
  cohortId: string,
  uid: string,
  requestId: string,
  raw: unknown,
  fn: (c: Context) => Promise<T>,
) {
  const hash = createHash("sha256").update(JSON.stringify(raw)).digest("hex");
  return db().runTransaction(async (tx) => {
    const store = new FirebaseStore(tx),
      c = await context(store, cohortId, uid, requestId),
      p = "cohorts/" + cohortId + "/idempotency/" + uid + "_" + requestId;
    const replay = await store.read<{ hash: string; result: T }>(p);
    if (replay) {
      if (replay.hash !== hash) fail("같은 요청 번호에 다른 내용이 있습니다.");
      return replay.result;
    }
    const result = await fn(c);
    store.write(p, { hash, result, createdAt: c.now });
    store.flush();
    return result;
  });
}
export async function readWorkshop<T>(
  cohortId: string,
  uid: string,
  fn: (c: Context) => Promise<T>,
) {
  return db().runTransaction(async (tx) =>
    fn(await context(new FirebaseStore(tx), cohortId, uid, "read")),
  );
}
export function runWorkshop(
  cohortId: string,
  uid: string,
  requestId: string,
  raw: unknown,
) {
  const cmd = workshopCommand.parse(raw);
  return transaction(cohortId, uid, requestId, cmd, (c) =>
    applyWorkshop(c, cmd),
  );
}
export async function getSnapshot(
  cohortId: string,
  uid: string,
  cursor?: string,
): Promise<Snapshot> {
  return db().runTransaction(async (tx) => {
    const s = new FirebaseStore(tx),
      c = await context(s, cohortId, uid, "read");
    // Pagination is scanned on the server; private records never enter the response.
    let q = db()
      .collection("cohorts/" + cohortId + "/workshop")
      .orderBy("__name__")
      .limit(300);
    if (cursor) q = q.startAfter(cursor);
    const snap = await tx.get(q),
      projects = await s.list<Project>(
        "cohorts/" + cohortId + "/projectDirectory",
      );
    const records: WorkshopRecord[] = [];
    let bytes = 0,
      lastId = cursor || "",
      truncated = false;
    for (const d of snap.docs) {
      const r = { ...d.data(), id: d.id } as WorkshopRecord;
      const allowed =
        (!r.projectId || projects.some((p) => p.id === r.projectId)) &&
        canRead(c, r) &&
        (r.kind !== "join" ||
          r.ownerId === uid ||
          c.me.role === "admin" ||
          projects.some((p) => p.id === r.projectId && p.leaderId === uid));
      const size = allowed ? Buffer.byteLength(JSON.stringify(r)) : 0;
      if (bytes + size > 1000000 && records.length) {
        truncated = true;
        break;
      }
      lastId = d.id;
      if (allowed) {
        records.push(r);
        bytes += size;
      }
    }
    const invites =
      c.me.role === "admin"
        ? (await s.list<any>("cohorts/" + cohortId + "/invites")).map((v) => ({
            id: v.id,
            email: v.email,
            role: v.role,
            status: v.status,
            expiresAt: v.expiresAt,
          }))
        : undefined;
    return {
      records,
      nextCursor: truncated || snap.size === 300 ? lastId : null,
      ai: {
        enabled:
          process.env.AI_PROVIDER === "openai" &&
          !!process.env.OPENAI_API_KEY &&
          !!process.env.AI_MODEL,
        model: process.env.AI_MODEL || "",
      },
      ...(invites ? { invites } : {}),
    };
  });
}
