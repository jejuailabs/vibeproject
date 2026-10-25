export type SharedVoteTarget = { cohortId: string; projectId: string; voteId: string };

export function voteShareUrl(currentUrl: string, target: SharedVoteTarget): string {
  const current = new URL(currentUrl);
  // Keep the preview path, but never forward invitation codes or other screen state.
  const link = new URL(current.pathname, current.origin);
  link.searchParams.set("cohort", target.cohortId);
  link.searchParams.set("project", target.projectId);
  link.searchParams.set("vote", target.voteId);
  return link.href;
}

export function readVoteLink(currentUrl: string): SharedVoteTarget | null {
  const params = new URL(currentUrl).searchParams;
  const cohortId = params.get("cohort"), projectId = params.get("project"), voteId = params.get("vote");
  return cohortId && projectId && voteId ? { cohortId, projectId, voteId } : null;
}
