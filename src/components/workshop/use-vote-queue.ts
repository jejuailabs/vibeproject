"use client";
import { useEffect, useRef, useState } from "react";

type VoteCommand = { type: "castTeamVote"; projectId: string; voteId: string; ideaId: string };
type Queue = { identity: string; commands: VoteCommand[]; picks: Record<string, string[]>; running: boolean };
export type VoteQueue = ReturnType<typeof useVoteQueue>;

// Show every click immediately, but save toggles in order so a cancellation cannot
// overtake the vote it cancels. Stop unsaved toggles if any save fails.
export function useVoteQueue(run: (command: unknown) => Promise<boolean>, identity: string) {
  const latestRun = useRef(run);
  latestRun.current = run;
  const current = useRef<Queue>({ identity, commands: [], picks: {}, running: false });
  if (current.current.identity !== identity) current.current = { identity, commands: [], picks: {}, running: false };
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

  return { optimistic: current.current.picks, saving: current.current.running, cast };
}
