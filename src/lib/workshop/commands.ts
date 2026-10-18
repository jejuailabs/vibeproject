import { z } from "zod";
import { docKeys, stages, readinessItems } from "./model";
import { stepKey } from "../steps";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,240}$/);
const title = z.string().trim().min(1).max(160),
  body = z.string().trim().min(1).max(20000),
  reason = z.string().trim().min(1).max(500);
const revision = z.number().int().min(0),
  scope = z.enum(["owner", "project", "cohort"]);
const url = z
  .string()
  .max(2000)
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "HTTPS 주소를 입력해주세요.");
const date = z
  .string()
  .datetime({ offset: true })
  .transform((v) => new Date(v).toISOString());
const project = { projectId: id };
const joinPolicy = z.enum(["open", "password", "request"]);
const S = <T extends z.ZodRawShape>(fields: T) => z.object(fields).strict();
export const workshopCommand = z.discriminatedUnion("type", [
  S({
    type: z.literal("settings"),
    name: title,
    week: z.number().int().min(1).max(4),
    mode: z.enum(["solo", "team", "mixed"]),
    retentionDays: z.number().int().min(1).max(3650),
    startsAt: z.string().max(40),
    notice: z.string().max(3000),
    state: z.enum(["running", "completed"]),
  }),
  S({
    type: z.literal("invite"),
    email: z.string().email().max(200),
    role: z.enum(["participant", "facilitator", "admin"]),
    days: z.number().int().min(1).max(90),
  }),
  S({ type: z.literal("revokeInvite"), inviteId: id }),
  S({
    type: z.literal("memberRole"),
    memberId: id,
    role: z.enum(["participant", "facilitator", "admin"]),
    active: z.boolean(),
    reason,
  }),
  S({
    type: z.literal("activity"),
    id,
    revision,
    title,
    question: body,
    instructions: z.string().max(5000),
    state: z.enum(["draft", "open", "closed"]),
    week: z.number().int().min(1).max(4),
    closesAt: z.union([date, z.literal("")]),
    reason,
    featured: z.boolean(),
  }),
  S({
    type: z.literal("submitActivity"),
    activityId: id,
    revision,
    body,
    scope: z.enum(["owner", "cohort"]),
  }),
  S({ type: z.literal("submissionIdea"), submissionId: id, title }),
  S({
    type: z.literal("openVote"),
    title,
    candidateIds: z.array(id).min(1).max(30),
    budget: z.number().int().min(1).max(10),
    allowSelfVote: z.boolean(),
    closesAt: date,
  }),
  S({
    type: z.literal("ballot"),
    roundId: id,
    revision,
    candidateIds: z.array(id).max(10),
  }),
  S({ type: z.literal("closeVote"), roundId: id, reason }),
  S({
    type: z.literal("selectVote"),
    roundId: id,
    selected: z
      .array(
        S({
          ideaId: id,
          name: title,
          mode: z.enum(["solo", "team"]),
          capacity: z.number().int().min(1).max(100),
        }),
      )
      .min(1)
      .max(30),
    reason,
  }),
  S({
    type: z.literal("createProject"),
    ideaId: id,
    name: title,
    mode: z.enum(["solo", "team"]),
    capacity: z.number().int().min(1).max(100),
    reason,
  }),
  S({ type: z.literal("reopenIdea"), ideaId: id, reason }),
  S({ type: z.literal("shareIdea"), ideaId: id, revision, scope, reason }),
  S({ type: z.literal("join"), ...project, message: z.string().max(2000) }),
  S({
    type: z.literal("resolveJoin"),
    requestId: id,
    accept: z.boolean(),
    reason,
  }),
  S({ type: z.literal("withdrawJoin"), requestId: id }),
  S({
    type: z.literal("openProject"),
    name: z.string().trim().min(1).max(60),
    intro: z.string().trim().max(300),
    capacity: z.number().int().min(1).max(100),
    joinPolicy,
    password: z.string().max(64).optional(),
  }),
  S({
    type: z.literal("enterProject"),
    ...project,
    password: z.string().max(64).optional(),
    invite: z.string().regex(/^[a-f0-9]{32}$/).optional(),
  }),
  S({
    type: z.literal("confirmProblem"),
    ...project,
    ideaId: id,
    revision,
    reason,
  }),
  S({
    type: z.literal("projectAccess"),
    ...project,
    joinPolicy,
    password: z.string().max(64).optional(),
    resetInvite: z.boolean(),
  }),
  S({ type: z.literal("leaveProject"), ...project, reason }),
  S({ type: z.literal("transferLeader"), ...project, memberId: id, reason }),
  S({
    type: z.literal("projectConfig"),
    ...project,
    mode: z.enum(["solo", "team"]),
    capacity: z.number().int().min(1).max(100),
    repositoryUrl: url,
    deployUrl: url,
    firebaseUrl: url,
  }),
  S({
    type: z.literal("support"),
    ...project,
    memberId: id,
    edit: z.boolean(),
    expiresAt: date,
  }),
  S({ type: z.literal("revokeSupport"), ...project, memberId: id }),
  S({
    type: z.literal("document"),
    ...project,
    key: z.enum(docKeys),
    revision,
    markdown: body,
    reason,
  }),
  S({
    type: z.literal("baseline"),
    ...project,
    title,
    reason,
    revisions: z.record(z.enum(docKeys), revision),
  }),
  S({
    type: z.literal("restoreDocument"),
    ...project,
    versionId: id,
    revision,
    reason,
  }),
  S({
    type: z.literal("task"),
    ...project,
    id,
    revision,
    title,
    body: z.string().max(5000),
    status: z.enum(["todo", "doing", "done"]),
    assigneeId: z.union([id, z.null()]),
    sourceMessageId: z.union([id, z.null()]),
    step: stepKey.optional(),
  }),
  S({
    type: z.literal("decision"),
    ...project,
    title,
    body,
    reason,
    sourceMessageId: z.union([id, z.null()]),
    step: stepKey.optional(),
  }),
  S({
    type: z.literal("readiness"),
    projectId: z.union([id, z.null()]),
    item: z.enum(readinessItems),
    done: z.boolean(),
    exception: z.string().max(500),
  }),
  S({ type: z.literal("advance"), ...project, stage: z.enum(stages), reason }),
  S({
    type: z.literal("release"),
    ...project,
    title,
    demoUrl: url.refine(Boolean),
    summary: body,
    knownIssues: z.string().max(5000),
    baselineId: id,
  }),
  S({ type: z.literal("feedback"), ...project, releaseId: id, body }),
  S({
    type: z.literal("resolveFeedback"),
    feedbackId: id,
    status: z.enum(["accepted", "resolved"]),
    resolution: reason,
  }),
  S({
    type: z.literal("showcase"),
    ...project,
    problem: body,
    solution: body,
    demoUrl: url.refine(Boolean),
    slidesUrl: url,
    retrospective: body,
    constraints: z.string().max(5000),
    milestones: z.array(z.string().trim().min(1).max(1000)).min(1).max(5),
    state: z.enum(["draft", "published"]),
  }),
  S({
    type: z.literal("schedule"),
    startsAt: date,
    totalMinutes: z.number().int().min(30).max(240),
    networkMinutes: z.number().int().min(0).max(120),
    transitionMinutes: z.number().int().min(0).max(60),
    projectIds: z.array(id).min(1).max(50),
  }),
  S({
    type: z.literal("source"),
    id,
    revision,
    title,
    text: z.string().min(1).max(200000),
    sourceType: z.enum(["transcript", "notes"]),
    scope,
    projectId: z.union([id, z.null()]),
    consent: z.boolean(),
    step: stepKey.optional(),
  }),
  S({
    type: z.literal("proposal"),
    sourceId: id,
    sourceRevision: revision,
    proposalType: z.enum([
      "new_idea",
      "question",
      "decision",
      "task",
      "summary",
    ]),
    title,
    body,
    evidence: z.string().min(1).max(1000),
  }),
  S({
    type: z.literal("resolveProposal"),
    proposalId: id,
    accept: z.boolean(),
    title,
    body,
  }),
  S({
    type: z.literal("approveDraft"),
    draftId: id,
    accept: z.boolean(),
    markdown: body,
    reason,
  }),
  S({ type: z.literal("redactSource"), sourceId: id, reason }),
  S({
    type: z.literal("resource"),
    ...project,
    title,
    url: url.refine(Boolean),
  }),
  S({ type: z.literal("help"), title, body }),
  S({ type: z.literal("resolveHelp"), helpId: id, resolution: reason }),
  S({ type: z.literal("reaction"), ideaId: id }),
  S({
    type: z.literal("replyMessage"),
    channel: id,
    replyToId: id,
    body: z.string().trim().min(1).max(2000),
    mentions: z.array(id).max(20),
    step: stepKey.optional(),
  }),
  S({
    type: z.literal("pinMessage"),
    channel: id,
    messageId: id,
    pinned: z.boolean(),
  }),
  S({
    type: z.literal("editMessage"),
    channel: id,
    messageId: id,
    revision,
    body: z.string().trim().min(1).max(2000),
  }),
  S({
    type: z.literal("messageToRecord"),
    channel: id,
    messageId: id,
    target: z.enum(["idea", "task", "decision"]),
    title,
    body,
    step: stepKey.optional(),
  }),
  S({ type: z.literal("readChannel"), channel: id }),
  S({ type: z.literal("readNotification"), notificationId: id }),
  S({
    type: z.literal("report"),
    targetId: id,
    targetKind: z.enum(["idea", "message", "source"]),
    channel: id,
    reason,
  }),
  S({ type: z.literal("resolveReport"), reportId: id, resolution: reason }),
]);
export type WorkshopCommand = z.infer<typeof workshopCommand>;
export const workshopEnvelope = S({
  cohortId: id,
  requestId: z.string().uuid(),
  command: workshopCommand,
});
