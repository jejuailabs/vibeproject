import type { Context } from "./model";
import { workshopCommand } from "./commands";
import { voting } from "./voting";
import { studio } from "./studio";
import { operations } from "./operations";
import { lobby } from "./lobby";
import { fail, optional } from "./core";
export async function applyWorkshop(c: Context, raw: unknown) {
  const command = workshopCommand.parse(raw);
  if (!c.me.active) fail("참여 권한이 중지되었습니다.", 403);
  const settings = await optional(c, "settings", "settings");
  if (
    settings?.data.state === "completed" &&
    ![
      "settings",
      "readNotification",
      "readChannel",
      "redactSource",
      "report",
      "resolveReport",
      "revokeInvite",
      "memberRole",
    ].includes(command.type)
  )
    fail("종료된 기수는 읽기 전용입니다.");
  return (
    (await lobby(c, command)) ||
    (await voting(c, command)) ||
    (await studio(c, command)) ||
    (await operations(c, command)) ||
    fail("지원하지 않는 요청입니다.", 400)
  );
}
