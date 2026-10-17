import type { Store, PreviewState, Context, WorkshopRecord } from "./model";
import type {
  Workspace,
  Member,
  Idea,
  Project,
  Message,
  HistoryEvent,
  Comment,
} from "../types";
import { applyWorkshop } from "./engine";
import { canRead } from "./core";
export class MemoryStore implements Store {
  rows = new Map<string, unknown>();
  async read<T>(p: string) {
    return structuredClone(this.rows.get(p.replace(/\/$/, ""))) as
      | T
      | undefined;
  }
  async list<T>(p: string, where: { field: string; value: unknown }[] = []) {
    return [...this.rows]
      .filter(
        ([k, v]) =>
          k.startsWith(p + "/") &&
          !k.slice(p.length + 1).includes("/") &&
          where.every(
            (w) =>
              w.field.split(".").reduce((o: any, s) => o?.[s], v) === w.value,
          ),
      )
      .map(([, v]) => structuredClone(v) as T);
  }
  write(p: string, v: unknown, merge = false) {
    p = p.replace(/\/$/, "");
    this.rows.set(
      p,
      merge
        ? { ...(this.rows.get(p) as object), ...(v as object) }
        : structuredClone(v),
    );
  }
  remove(p: string) {
    this.rows.delete(p);
  }
}
// Server-only rows (join password hashes) never enter PreviewState; keep them in this page's memory.
const privateRows = new Map<string, unknown>();
export async function previewWorkshop(
  state: PreviewState,
  raw: unknown,
): Promise<PreviewState & { result: unknown }> {
  const w = structuredClone(state.workspace),
    s = new MemoryStore(),
    root = "cohorts/" + w.cohort.id;
  s.write(root, w.cohort);
  for (const m of w.members) {
    s.write(root + "/members/" + m.id, m);
    s.write(root + "/profiles/" + m.id, m);
  }
  for (const i of w.ideas) s.write(root + "/ideas/" + i.id, i);
  for (const p of w.projects) {
    s.write(root + "/projects/" + p.id, p);
    s.write(root + "/projectDirectory/" + p.id, p);
  }
  for (const m of w.messages)
    s.write(root + "/channels/" + m.channel + "/messages/" + m.id, m);
  for (const e of w.events)
    s.write(root + "/ideas/" + e.ideaId + "/history/" + e.id, e);
  for (const e of w.comments)
    s.write(root + "/ideas/" + e.ideaId + "/comments/" + e.id, e);
  for (const r of state.records) s.write(root + "/workshop/" + r.id, r);
  s.write(root + "/activities/discovery", w.activity);
  for (const [k, v] of privateRows) s.write(k, v);
  const c: Context = {
    store: s,
    uid: w.me.id,
    me: w.me,
    cohortId: w.cohort.id,
    now: new Date().toISOString(),
    requestId: crypto.randomUUID(),
    grants: state.records.filter(
      (r) => r.kind === "support" && r.ownerId === w.me.id,
    ) as import("./model").RecordOf<"support">[],
  };
  const result = await applyWorkshop(c, raw);
  privateRows.clear();
  for (const [k, v] of s.rows)
    if (k.startsWith(root + "/projectSecrets/")) privateRows.set(k, v);
  const members = await s.list<Member>(root + "/members"),
    ideas = await s.list<Idea>(root + "/ideas");
  const cohort = await s.read<Workspace["cohort"]>(root);
  return {
    workspace: {
      ...w,
      cohort: cohort!,
      me: members.find((m) => m.id === w.me.id)!,
      members,
      ideas,
      projects: await s.list<Project>(root + "/projects"),
      activity: (await s.read(root + "/activities/discovery"))!,
      messages: [...s.rows]
        .filter(([k]) =>
          /^cohorts\/[^/]+\/channels\/[^/]+\/messages\/[^/]+$/.test(k),
        )
        .map(([, v]) => v as Message),
      events: [...s.rows]
        .filter(
          ([k]) =>
            k.includes("/history/") && !k.split("/history/")[1].includes("/"),
        )
        .map(([, v]) => v as HistoryEvent),
      comments: [...s.rows]
        .filter(([k]) => k.includes("/comments/"))
        .map(([, v]) => v as Comment),
    },
    records: await s.list<WorkshopRecord>(root + "/workshop"),
    result,
  };
}
