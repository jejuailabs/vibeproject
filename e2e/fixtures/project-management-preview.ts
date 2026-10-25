// Used only by the isolated browser harness. The real preview commands and
// workspace shape stay in use, with a team and solo project to test visibility.
import { previewWorkspace as baseWorkspace } from "../../src/lib/preview";
export { previewCommand } from "../../src/lib/preview";

export function previewWorkspace() {
  const workspace = baseWorkspace();
  workspace.members.push({ id: "fac", name: "테스트 진행자", avatar: "", role: "facilitator", projectId: null, active: true });
  const first = workspace.projects[0];
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
