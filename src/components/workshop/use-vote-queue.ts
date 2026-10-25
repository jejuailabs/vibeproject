"use client";
import { useEffect, useRef, useState } from "react";
import type { RecordOf } from "@/lib/workshop/model";

type VoteCommand = { type: "castTeamVote"; projectId: string; voteId: string; ideaId: string };
type JoinCommand = { type: "pickJoin"; projectId: string; boardId: string; ideaId: string };
type PathCommand = { type: "pickPath"; projectId: string; pathId: string; nickname: string; choice: "team" | "solo"; ideaId?: string };
type JoinPick = RecordOf<"joinBoard">["data"]["picks"][string];
type PathPick = RecordOf<"pathVote">["data"]["picks"][string];
type Queue = { identity: string; commands: (VoteCommand | JoinCommand | PathCommand)[];
  picks: Record<string, string[]>; joinPicks: Record<string, JoinPick | null>; pathPicks: Record<string, PathPick>; running: boolean };
const emptyQueue = (identity: string): Queue => ({ identity, commands: [], picks: {}, joinPicks: {}, pathPicks: {}, running: false });
export type VoteQueue = ReturnType<typeof useVoteQueue>;

// Show every click immediately, but save toggles in order so a cancellation cannot
// overtake the vote it cancels. Stop unsaved toggles if any save fails.
export function useVoteQueue(run: (command: unknown) => Promise<boolean>, identity: string) {
  const latestRun = useRef(run);
  latestRun.current = run;
  const current = useRef<Queue>(emptyQueue(identity));
  if (current.current.identity !== identity) current.current = emptyQueue(identity);
  const mounted = useRef(true);
  const [, render] = useState(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; current.current.commands = []; };
  }, []);

  async function flush(queue: Queue) {
    queue.running = true;
    try {
      while (mounted.current && queue === current.current && queue.commands.length) {
        const command = queue.commands.shift()!;
        if (!(await latestRun.current(command))) {
          queue.commands = [];
          break;
        }
      }
    } catch {
      // run normally reports the error and returns false. A thrown failure must
      // also discard queued toggles instead of sending them on the next click.
      queue.commands = [];
    } finally {
      queue.running = false;
      queue.picks = {};
      queue.joinPicks = {};
      queue.pathPicks = {};
      if (mounted.current && queue === current.current) render((version) => version + 1);
    }
  }

  function cast(command: VoteCommand, saved: string[], max: number) {
    const queue = current.current;
    const before = queue.picks[command.voteId] ?? saved;
    const next = before.includes(command.ideaId)
      ? before.filter((id) => id !== command.ideaId)
      : before.length < max ? [...before, command.ideaId]
      : max === 1 ? [command.ideaId] : null;
    if (!next) return;
    queue.picks = { ...queue.picks, [command.voteId]: next };
    queue.commands.push(command);
    if (!queue.running) void flush(queue);
    render((version) => version + 1);
  }

  function pickJoin(command: JoinCommand, saved: JoinPick | null) {
    const queue = current.current;
    const before = Object.hasOwn(queue.joinPicks, command.boardId) ? queue.joinPicks[command.boardId] : saved;
    queue.joinPicks = { ...queue.joinPicks, [command.boardId]: before?.ideaId === command.ideaId
      ? null : { ideaId: command.ideaId, at: new Date().toISOString() } };
    queue.commands.push(command);
    if (!queue.running) void flush(queue);
    render((version) => version + 1);
  }

  function pickPath(command: PathCommand) {
    const queue = current.current;
    queue.pathPicks = { ...queue.pathPicks, [command.pathId]: {
      nickname: command.nickname, choice: command.choice, ...(command.choice === "solo" && command.ideaId ? { ideaId: command.ideaId } : {}),
    } };
    queue.commands.push(command);
    if (!queue.running) void flush(queue);
    render((version) => version + 1);
  }

  return { optimistic: current.current.picks, joinPicks: current.current.joinPicks, pathPicks: current.current.pathPicks,
    saving: current.current.running, cast, pickJoin, pickPath };
}
