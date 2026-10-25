import type { Idea } from "../types";

export function teamVoteTitle(
  vote: { title?: string; candidateIds: string[] } | undefined,
  cards: Pick<Idea, "id" | "title">[],
) {
  if (vote?.title?.trim()) return vote.title.trim();
  const first = cards.find((card) => card.id === vote?.candidateIds[0])?.title.trim();
  if (!first) return "함께 풀 문제 고르기";
  const title = first.length > 64 ? first.slice(0, 64) + "…" : first;
  const others = vote!.candidateIds.length - 1;
  return title + (others > 0 ? " 외 " + others + "개" : "");
}
