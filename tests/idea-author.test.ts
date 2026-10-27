import test from "node:test";
import assert from "node:assert/strict";
import { previewCommand, previewWorkspace } from "../src/lib/preview";
import { editedIdea } from "../src/lib/idea-edit";
import { emptyRefinement, problemCardText } from "../src/lib/refinement";
import type { Command, Idea } from "../src/lib/types";

const edit = (idea: Idea, authorName?: string): Extract<Command, {type:"editIdea"}> => ({
  type: "editIdea", id: idea.id, revision: idea.revision, title: idea.title, body: idea.body, reason: "작성자 이름 수정",
  ...(authorName !== undefined ? { authorName } : {}),
});

test("a proposed author's name can change at experience and finished problem-card stages and keeps its history", () => {
  let w = previewWorkspace();
  w = previewCommand(w, { type: "createIdea", title: "새 경험", body: "다른 사람이 제안한 문제", kind: "thought", scope: "cohort", authorName: "첫 제안자" });
  const id = w.ideas[0].id;
  const original = structuredClone(w.events[0]);
  const input = structuredClone(previewWorkspace().ideas[0].refinement!);
  w = previewCommand(w, {type:"refineIdea",id,revision:1,phase:"questions",input,reason:"경험 답변",scope:"cohort",authorName:"  경험 제안자  "});
  assert.equal(w.ideas[0].authorName,"경험 제안자");
  w = previewCommand(w, {type:"refineIdea",id,revision:2,phase:"definition",input,reason:"카드 완성",scope:"cohort",authorName:"문제 제안자"});
  assert.equal(w.ideas[0].authorName,"문제 제안자");
  assert.equal(w.ideas[0].refinement?.ready,true);
  assert.equal(w.events[0].snapshot.authorName,"문제 제안자");
  assert.deepEqual(w.events.find(e=>e.id===original.id),original);
  assert.equal(original.snapshot.authorName,"첫 제안자");
  assert.match(problemCardText(w.ideas[0].refinement!,w.ideas[0].title,w.ideas[0].authorName),/작성자: 문제 제안자/);
});

test("author-only edits preserve the completed refinement, ownership, privacy and all answers; clearing restores the account name", () => {
  let w = previewWorkspace(), idea = w.ideas[0];
  const before = structuredClone(idea);
  const command = edit(idea,"  바뀐 제안자  ");
  // The live server uses this same edit function after its permission and revision checks.
  const live = editedIdea(idea,command,"2026-10-27T00:00:00.000Z");
  assert.deepEqual(live.refinement,before.refinement);
  w = previewCommand(w,command);idea=w.ideas[0];
  assert.equal(idea.authorName,"바뀐 제안자");assert.equal(idea.ownerId,before.ownerId);
  assert.equal(idea.scope,before.scope);assert.equal(idea.projectId,before.projectId);
  assert.deepEqual(idea.refinement,before.refinement);assert.equal(idea.refinement?.ready,true);
  assert.equal(idea.revision,before.revision+1);assert.equal(idea.version,before.version+1);
  assert.equal(w.events[0].title,"작성자 이름 수정");assert.equal(w.events[0].snapshot.authorName,"바뀐 제안자");
  // Older clients omit the field and must not clear an existing attribution.
  w = previewCommand(w,edit(idea));assert.equal(w.ideas[0].authorName,"바뀐 제안자");
  w = previewCommand(w,edit(w.ideas[0],"   "));
  assert.equal(w.ideas[0].authorName,"");assert.equal(w.events[0].snapshot.authorName,"");
  assert.equal(w.ideas[0].refinement?.ready,true);
  assert.equal(w.ideas[0].ownerId,before.ownerId);
});

test("attribution obeys existing edit permissions, revision conflicts, read-only states and the 40-character limit", () => {
  const w=previewWorkspace(), idea=w.ideas[0], cmd=edit(idea,"다른 제안자");
  assert.throws(()=>previewCommand({...w,me:w.members[2]},cmd),/작성자/);
  assert.throws(()=>previewCommand(previewCommand(w,cmd),cmd),/다른 변경/);
  for(const state of ["candidate","selected","closed_unselected"] as const) {
    const frozen=structuredClone(w);frozen.ideas[0].state=state;
    assert.throws(()=>previewCommand(frozen,cmd),/원본/);
  }
  assert.throws(()=>previewCommand(w,edit(idea,"가".repeat(41))));
  assert.throws(()=>previewCommand(w,{type:"refineIdea",id:idea.id,revision:idea.revision,phase:"questions",input:emptyRefinement(),reason:"저장",scope:idea.scope,authorName:"가".repeat(41)}));
  const next=previewCommand(w,{...edit(idea),title:"바뀐 내용",authorName:"고친 제안자"});
  assert.equal(next.ideas[0].refinement?.ready,false);
  assert.equal(next.ideas[0].refinement?.definition.solutionReviewed,false);
  assert.equal(next.ideas[0].authorName,"고친 제안자");
});
