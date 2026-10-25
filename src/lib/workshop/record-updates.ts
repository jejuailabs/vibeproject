import type { WorkshopRecord } from "./model";

// A poll that started before a vote was saved must not undo the POST response.
export function mergeRecordUpdates(records: WorkshopRecord[], updates: WorkshopRecord[]) {
  const merged = new Map(records.map((record) => [record.id, record]));
  for (const update of updates) {
    const current = merged.get(update.id);
    if (!current || update.revision >= current.revision) merged.set(update.id, update);
  }
  return [...merged.values()];
}
