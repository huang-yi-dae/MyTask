import { type NextRequest, NextResponse } from "next/server";
import { notifications, EazoNotificationPublishError } from "@eazo/sdk/server";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

/** 每日任务提醒，由 vercel.json#crons 调度，通过 CRON_SECRET 鉴权。 */
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 统计进行中的任务数量
  let activeCount = 0;
  try {
    const rows = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(tasks)
      .where(eq(tasks.status, "active"));
    activeCount = rows[0]?.count ?? 0;
  } catch {
    // 查询失败不影响推送
  }

  const title = "AutoTask 每日提醒";
  const body =
    activeCount > 0
      ? `你有 ${activeCount} 个进行中的任务，今天继续加油完成吧！`
      : "今日计划完成得不错！来新建一个目标，让 AI 帮你拆解吧 ✨";

  try {
    const result = await notifications.publish({
      title,
      body,
      data: {
        source: "cron-daily-digest",
        activeCount,
        url: "/history",
      },
    });
    return NextResponse.json({ ok: true, ...result, activeCount });
  } catch (err) {
    if (err instanceof EazoNotificationPublishError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code >= 400 && err.code < 600 ? err.code : 500 },
      );
    }
    console.error("[notifications/cron] unexpected error", err);
    return NextResponse.json({ error: "publish failed" }, { status: 500 });
  }
}
