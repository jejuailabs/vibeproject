// Used only by the isolated browser harness. The real preview commands and
// workspace shape stay in use, with a team and solo project to test visibility.
import { previewWorkspace as baseWorkspace } from "../../src/lib/preview";
export { previewCommand } from "../../src/lib/preview";

export function previewWorkspace() {
  const workspace = baseWorkspace();
  workspace.members.push({ id: "fac", name: "테스트 진행자", avatar: "", role: "facilitator", projectId: null, active: true });
  const first = workspace.projects[0];
  if (new URLSearchParams(window.location.search).has("mobile")) {
    const ready = workspace.ideas.find((idea) => idea.refinement?.ready)!;
    for (const [index, ownerId] of ["jun", "seo"].entries()) workspace.ideas.push({ ...structuredClone(ready), id: "mobile-card-" + index, title: "모바일에서도 읽고 투표할 수 있는 문제 카드 " + (index + 1), ownerId, projectId: first.id, scope: "project", state: "shared" });
  }
  workspace.projects.push({
    ...first,
    id: "p-voted",
    name: "투표에서 만들어진 프로젝트",
    leaderId: "jun",
    memberIds: ["jun"],
    sourceIdeaId: "i3",
    mode: "team",
    createdFromVote: {
      projectId: first.id,
      projectName: first.name,
      voteId: "v-completed",
      boardId: "j-completed",
      endedBy: "time",
    },
  }, {
    ...first,
    id: "p-solo",
    name: "개인 진행 프로젝트",
    leaderId: "ha",
    memberIds: ["ha"],
    mode: "solo",
    capacity: 1,
  });
  workspace.members.find((member) => member.id === "jun")!.projectIds = [first.id, "p-voted"];
  workspace.members.find((member) => member.id === "ha")!.projectId = "p-solo";
  if (new URLSearchParams(window.location.search).has("adminMember")) {
    workspace.me.projectId = first.id;
    workspace.me.projectIds = [first.id];
    first.memberIds.push(workspace.me.id);
  }
  return workspace;
}
