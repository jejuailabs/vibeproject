"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { Workspace } from "@/lib/types";
import type {
  Snapshot,
  WorkshopRecord,
  RecordOf,
  Context,
} from "@/lib/workshop/model";
import { previewWorkshop } from "@/lib/workshop/memory";
import { canRead } from "@/lib/workshop/core";
import { baselineArchive } from "@/lib/workshop/export";
import { basicCard, basicCoach, basicDraft, type CardInput, type CardReply, type CoachInput, type CoachReply, type DraftInput, type DraftReply } from "@/lib/coaching";
export function useWorkshop({
  data,
  setData,
  user,
  preview,
  cohortId,
  reload,
  setError,
  setNotice,
}: {
  data: Workspace | null;
  setData: (w: Workspace | null) => void;
  user: User | null;
  preview: boolean;
  cohortId: string;
  reload: (u: User) => Promise<void>;
  setError: (s: string) => void;
  setNotice: (s: string) => void;
}) {
  const [records, setRecords] = useState<WorkshopRecord[]>([]),
    [invites, setInvites] = useState<Snapshot["invites"]>(),
    [ai, setAi] = useState<Snapshot["ai"]>({ enabled: false, model: "" }),
    [busy, setBusy] = useState(false),
    pending = useRef<{ key: string; id: string } | null>(null),
    localFiles = useRef(new Map<string, File>());
  const refresh = useCallback(async () => {
    if (!user || preview) return;
    let cursor: string | null = null,
      all: WorkshopRecord[] = [];
    do {
      const response: Response = await fetch(
        "/api/workshop?cohortId=" +
          encodeURIComponent(cohortId) +
          (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
        {
          headers: { Authorization: "Bearer " + (await user.getIdToken()) },
          cache: "no-store",
        },
      );
      const v: Snapshot & { error?: string } = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setRecords([]);
          setData(null);
        }
        throw new Error(v.error || "진행 정보를 불러오지 못했습니다.");
      }
      all = all.concat(v.records);
      cursor = v.nextCursor;
      setInvites(v.invites);
      setAi(v.ai);
    } while (cursor);
    setRecords(all);
  }, [user, preview, cohortId, setData]);
  useEffect(() => {
    if (!user && !preview) {
      setRecords([]);
      return;
    }
    refresh().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        refresh().catch((e) => setError(e.message));
    }, 20000);
    return () => clearInterval(timer);
  }, [refresh, user, preview, setError]);
  async function run(command: unknown) {
    setBusy(true);
    setError("");
    let denied: { denied?: boolean; message?: string } | null = null;
    try {
      if (preview) {
        if (!data) throw new Error("작업 공간이 없습니다.");
        const result = await previewWorkshop(
          { workspace: data, records },
          command,
        );
        setData(result.workspace);
        setRecords(result.records);
        denied = (result.result as { denied?: boolean; message?: string } | null) || null;
      } else {
        if (!user) throw new Error("로그인이 필요합니다.");
        const key = JSON.stringify(command);
        if (pending.current?.key !== key)
          pending.current = { key, id: crypto.randomUUID() };
        const isAI = (command as any)?.type === "analyze";
        const { type: aiType, ...aiCommand } = command as any;
        const response: Response = await fetch(
          isAI ? "/api/ai" : "/api/workshop",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + (await user.getIdToken()),
            },
            body: JSON.stringify(
              isAI
                ? { cohortId, requestId: pending.current.id, ...aiCommand }
                : { cohortId, requestId: pending.current.id, command },
            ),
          },
        );
        const value = await response.json();
        if (!response.ok) throw new Error(value.error);
        pending.current = null;
        denied = value;
        await Promise.all([refresh(), reload(user)]);
      }
      if (denied?.denied) {
        setError(denied.message || "요청을 처리하지 못했습니다.");
        return false;
      }
      setNotice(
        preview
          ? "샘플에 반영했어요. 새로고침하면 초기화됩니다."
          : "저장했어요.",
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "입력 내용을 확인해주세요.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  // The coach only suggests text; nothing is saved until the writer saves the form.
  async function askCoach(input: CoachInput): Promise<CoachReply> {
    if (preview || !user) return basicCoach(input);
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await user.getIdToken()) },
      body: JSON.stringify({ cohortId, ...input }),
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || "AI 코치가 답하지 못했어요.");
    return value;
  }
  async function makeCard(input: CardInput): Promise<CardReply> {
    if (preview || !user) return basicCard(input);
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await user.getIdToken()) },
      body: JSON.stringify({ cohortId, kind: "card", ...input }),
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || "AI가 문제 카드를 만들지 못했어요.");
    return value;
  }
  async function makeDraft(input: DraftInput): Promise<DraftReply> {
    if (preview || !user) return basicDraft(input);
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await user.getIdToken()) },
      body: JSON.stringify({ cohortId, kind: "draft", ...input }),
    });
    const value = await response.json().catch(() => ({ error: "파일이 너무 크거나 응답이 늦어요. 파일을 줄여 다시 해주세요." }));
    if (!response.ok) throw new Error(value.error || "AI가 정리하지 못했어요.");
    return value;
  }
  function saveBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function fileRequest(path: string, options?: RequestInit) {
    if (!user) throw new Error("로그인이 필요합니다.");
    return fetch(path, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: "Bearer " + (await user.getIdToken()),
      },
    });
  }
  async function upload(file: File, scope: string, projectId: string | null) {
    setBusy(true);
    setError("");
    let denied: { denied?: boolean; message?: string } | null = null;
    try {
      if (
        file.size > 10485760 ||
        !file.size ||
        !/\.(png|jpe?g|webp|pdf|txt|md)$/i.test(file.name)
      )
        throw new Error(
          "10MB 이하 PNG·JPG·WebP·PDF·TXT·MD 파일을 선택해주세요.",
        );
      if (preview) {
        const id = "asset-" + crypto.randomUUID(),
          now = new Date().toISOString();
        localFiles.current.set(id, file);
        setRecords((r) => [
          ...r,
          {
            id,
            kind: "asset",
            ownerId: data!.me.id,
            scope: scope as "owner" | "project" | "cohort",
            projectId,
            revision: 1,
            createdAt: now,
            updatedAt: now,
            data: {
              name: file.name,
              size: file.size,
              contentType: file.type,
              storagePath: "preview",
              state: "ready",
              generation: "1",
            },
          },
        ]);
      } else {
        const start = await fileRequest("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "start",
            cohortId,
            requestId: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            scope,
            projectId,
          }),
        });
        const value = await start.json();
        if (!start.ok) throw new Error(value.error);
        const put = await fetch(value.url, {
          method: "PUT",
          headers: {
            "Content-Type": value.contentType,
            "x-goog-if-generation-match": "0",
          },
          body: file,
        });
        if (!put.ok)
          throw new Error(
            "Firebase 업로드를 완료하지 못했습니다. 다시 선택해주세요.",
          );
        const finish = await fileRequest("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "finish",
            cohortId,
            requestId: crypto.randomUUID(),
            assetId: value.assetId,
          }),
        });
        const done = await finish.json();
        if (!finish.ok) throw new Error(done.error);
        await refresh();
      }
      setNotice(
        preview
          ? "미리보기 메모리에 보관했습니다."
          : "Firebase에 자료를 저장했습니다.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 오류");
    } finally {
      setBusy(false);
    }
  }
  async function download(id: string) {
    setError("");
    try {
      if (preview) {
        const file = localFiles.current.get(id);
        if (file) saveBlob(file, file.name);
        return;
      }
      const response = await fileRequest(
        "/api/files?cohortId=" + cohortId + "&id=" + id,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const a = document.createElement("a");
      a.href = result.url;
      a.rel = "noopener";
      a.click();
    } catch (e) {
      setError(e instanceof Error ? e.message : "다운로드 오류");
    }
  }
  async function exportBaseline(id: string) {
    setBusy(true);
    setError("");
    let denied: { denied?: boolean; message?: string } | null = null;
    try {
      if (preview) {
        const b = records.find(
          (r) => r.kind === "baseline" && r.id === id,
        ) as RecordOf<"baseline">;
        const archive = await baselineArchive(
          b,
          records.filter((r) => r.kind === "version") as RecordOf<"version">[],
          data?.projects.find((p) => p.id === b.projectId)?.name || "프로젝트",
        );
        saveBlob(
          new Blob([new Uint8Array(archive.bytes)], {
            type: "application/zip",
          }),
          id + ".zip",
        );
      } else {
        const response = await fileRequest(
          "/api/files?type=export&cohortId=" + cohortId + "&id=" + id,
        );
        if (!response.ok) throw new Error((await response.json()).error);
        saveBlob(await response.blob(), id + ".zip");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "내보내기 오류");
    } finally {
      setBusy(false);
    }
  }
  const visible =
    preview && data
      ? records.filter(
          (r) =>
            canRead(
              {
                uid: data.me.id,
                me: data.me,
                now: new Date().toISOString(),
                grants: records.filter(
                  (r) => r.kind === "support" && r.ownerId === data.me.id,
                ),
              } as Context,
              r,
            ) &&
            (r.kind !== "join" ||
              r.ownerId === data.me.id ||
              data.me.role === "admin" ||
              data.projects.some(
                (p) => p.id === r.projectId && p.leaderId === data.me.id,
              )),
        )
      : records;
  return {
    records: visible,
    invites,
    ai,
    busy,
    run,
    askCoach,
    makeCard,
    makeDraft,
    upload,
    download,
    exportBaseline,
    refresh,
  };
}
