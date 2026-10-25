"use client";
import { useEffect, useRef, useState } from "react";
import { projectIdsOf } from "@/lib/policy";
import type { Workspace } from "@/lib/types";
import { readVoteLink, type SharedVoteTarget } from "@/lib/workshop/vote-link";

export function useSharedVote({ workspace, run, onOpen, onError }: {
  workspace: Workspace | null;
  run: (command: unknown) => Promise<boolean>;
  onOpen: (target: SharedVoteTarget) => void;
  onError: (message: string) => void;
}) {
  const [target, setTarget] = useState<SharedVoteTarget | null>(null);
  const handled = useRef("");
  const reported = useRef("");
  const identity = workspace ? workspace.cohort.id + ":" + workspace.me.id : "";
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  useEffect(() => { setTarget(readVoteLink(location.href)); }, []);

  useEffect(() => {
    // Authentication stays on this page, so retain the link until login has finished.
    if (!target || !workspace) return;
    const key = identity + ":" + target.projectId + ":" + target.voteId;
    if (handled.current === key) return;
    if (target.cohortId !== workspace.cohort.id) {
      handled.current = key;
      onError("다른 기수의 투표 링크예요. 해당 기수의 사이트에서 열어주세요.");
      return;
    }
    if (!projectIdsOf(workspace.me).includes(target.projectId) || !workspace.projects.some((p) => p.id === target.projectId)) {
      if (reported.current !== key) onError("이 투표를 보려면 해당 프로젝트에 먼저 참여해주세요.");
      reported.current = key;
      return;
    }
    handled.current = key;
    if (workspace.me.projectId === target.projectId) {
      onOpen(target);
      return;
    }
    // enterProject can also join open projects; the membership check above is essential.
    // Its successful return includes reloading the target project's cards and records.
    void run({ type: "enterProject", projectId: target.projectId }).then((ok) => {
      if (ok && currentIdentity.current === identity) onOpen(target);
    }).catch(() => {
      if (currentIdentity.current === identity) onError("투표를 열지 못했어요. 링크를 다시 열어주세요.");
    });
  }, [workspace, target, identity, run, onOpen, onError]);
}
