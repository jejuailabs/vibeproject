import "server-only";
import { db } from "../src/server/firebase";
async function main() {
  const cohortId = process.env.NEXT_PUBLIC_COHORT_ID;
  if (!cohortId || !/^vibe-[a-zA-Z0-9_-]+$/.test(cohortId))
    throw new Error("Configured Vibe cohort ID required.");
  const c = db().collection("cohorts").doc(cohortId),
    now = new Date().toISOString();
  await db().runTransaction(async (tx) => {
    const [cohort, activity, settings, linked, admins] = await Promise.all([
      tx.get(c),
      tx.get(c.collection("activities").doc("discovery")),
      tx.get(c.collection("workshop").doc("settings")),
      tx.get(c.collection("workshop").doc("activity-discovery")),
      tx.get(c.collection("members").where("role", "==", "admin").limit(1)),
    ]);
    if (!cohort.exists)
      throw new Error(
        "Existing cohort required; migration will not create a cohort.",
      );
    const ownerId = admins.docs[0]?.id || "system",
      base = {
        ownerId,
        scope: "cohort",
        projectId: null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      };
    if (!settings.exists)
      tx.create(settings.ref, {
        ...base,
        id: "settings",
        kind: "settings",
        data: {
          name: cohort.data()?.name || "바이브코딩",
          week: cohort.data()?.week || 1,
          mode: "mixed",
          retentionDays: 365,
          startsAt: "",
          notice: "",
          state:
            cohort.data()?.status === "completed" ? "completed" : "running",
        },
      });
    if (activity.exists && !linked.exists) {
      const a = activity.data()!;
      tx.create(linked.ref, {
        ...base,
        id: "activity-discovery",
        kind: "activity",
        data: {
          title: a.title || "문제 발견",
          question: a.question || "해결하고 싶은 문제를 나눠주세요.",
          instructions: a.description || "",
          state: a.state === "open" ? "open" : "closed",
          week: a.week || 1,
          closesAt: a.closesAt || "",
          reason: "기존 현재 활동 연결",
          featured: true,
        },
      });
      tx.update(activity.ref, { activityId: "activity-discovery" });
      tx.update(c, { featuredActivityId: "activity-discovery" });
    }
  });
  console.log(
    "Existing Vibe activity connected; settings added only when missing.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
