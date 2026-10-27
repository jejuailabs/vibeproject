import { z } from "zod";
import type { Command, Idea } from "./types";

export const ideaAuthorSchema = z.string().trim().max(40);
export function ideaAuthorPatch(authorName: string | undefined) {
  // Omission preserves old clients' attribution; an empty string explicitly restores the account name.
  return authorName === undefined ? {} : { authorName: ideaAuthorSchema.parse(authorName) };
}

export function editedIdea(idea: Idea, command: Extract<Command, { type: "editIdea" }>, now: string): Idea {
  const contentChanged = idea.title !== command.title || idea.body !== command.body;
  return { ...idea, ...ideaAuthorPatch(command.authorName), title: command.title, body: command.body,
    ...(contentChanged && idea.refinement ? { refinement: { ...idea.refinement, ready: false,
      definition: { ...idea.refinement.definition, solutionReviewed: false } } } : {}),
    revision: idea.revision + 1, version: idea.version + 1, updatedAt: now,
  };
}
