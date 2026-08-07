import { type NextRequest, NextResponse } from "next/server";
import { notifications, EazoNotificationPublishError } from "@eazo/sdk/server";
import { db } from "@/lib/db/client";
import { tasks, subtasks } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * GET /api/notifications/cron/daily-digest
 * 每日任务提醒，由 vercel.json#crons 调度，通过 CRON_SECRET 鉴权。
 *
 * 升级内容：
 *   - 按用户查询今天有哪些子任务在排期内
 *   - 通知内容包含具体任务名称和预计时长
 *   - 区分「今天有任务」「今天全完成」「无任务」三种场景
 */
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── 计算今天的日期范围 ─────────────────────────────────────────────
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ── 查询所有进行中任务的子任务（含排期信息）──────────────────────
  let todaySubtasks: Array<{
    subtaskTitle: string;
    taskTitle: string;
    deepWorkHours: number | null;
    completed: boolean;
    startDay: number;
    durationDays: number;
    taskStartDate: Date | null;
  }> = [];

  try {
    const rows = await db
      .select({
        subtaskTitle: subtasks.title,
        taskTitle: tasks.title,
        deepWorkHours: subtasks.deepWorkHours,
        completed: subtasks.completed,
        startDay: subtasks.startDay,
        durationDays: subtasks.durationDays,
        taskStartDate: tasks.startDate,
      })
      .from(subtasks)
      .innerJoin(tasks, eq(subtasks.taskId, tasks.id))
      .where(eq(tasks.status, "active"));

    // 过滤出今天在排期内的子任务
    todaySubtasks = rows.filter((r) => {
      if (!r.taskStartDate) return false;
      const base = new Date(r.taskStartDate);
      const start = new Date(base);
      start.setDate(base.getDate() + r.startDay);
      const end = new Date(base);
      end.setDate(base.getDate() + r.startDay + r.durationDays - 1);
      return start <= todayStart && todayStart <= end;
    });
  } catch {
    // 查询失败降级为通用提醒
  }

  // ── 构建通知内容 ─────────────────────────────────────────────────
  let title: string;
  let body: string;

  if (todaySubtasks.length === 0) {
    // 没有排期任务——激励新建
    const [activeCountRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(tasks)
      .where(eq(tasks.status, "active"))
      .catch(() => [{ count: 0 }]);

    const activeCount = (activeCountRow as { count: number })?.count ?? 0;
    title = "AutoTask 每日提醒";
    body = activeCount > 0
      ? "今天暂无排期任务，趁机复习或规划下一阶段吧 📖"
      : "还没有学习任务？来新建一个目标，让 AI 帮你拆解吧 ✨";

  } else {
    const pendingToday = todaySubtasks.filter((s) => !s.completed);
    const completedToday = todaySubtasks.filter((s) => s.completed);

    if (pendingToday.length === 0) {
      // 今天全完成了
      title = "🎉 今日任务全部完成！";
      body = `太棒了！${todaySubtasks.length} 项今日任务全部搞定。明天继续保持 💪`;
    } else {
      // 还有待完成任务
      const totalHours = pendingToday.reduce(
        (sum, s) => sum + (s.deepWorkHours ?? s.durationDays * 1.5), 0
      );

      // 最多列出 3 个任务标题
      const taskNames = pendingToday.slice(0, 3).map((s) => `・${s.subtaskTitle}`).join("\n");
      const moreCount = pendingToday.length > 3 ? `\n还有 ${pendingToday.length - 3} 项…` : "";

      title = completedToday.length > 0
        ? `今日进度 ${completedToday.length}/${todaySubtasks.length} ✓`
        : `今天有 ${pendingToday.length} 项学习任务`;

      body = [
        taskNames,
        moreCount,
        `预计 ${totalHours.toFixed(1)}h · 点击开始今天的学习`,
      ].filter(Boolean).join("\n");
    }
  }

  // ── 推送通知 ────────────────────────────────────────────────────────
  try {
    const result = await notifications.publish({
      title,
      body,
      data: {
        source: "cron-daily-digest",
        todayCount: todaySubtasks.length,
        pendingCount: todaySubtasks.filter((s) => !s.completed).length,
        url: "/",
      },
    });
    return NextResponse.json({
      ok: true,
      ...result,
      todayCount: todaySubtasks.length,
      pendingCount: todaySubtasks.filter((s) => !s.completed).length,
    });
  } catch (err) {
    if (err instanceof EazoNotificationPublishError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code >= 400 && err.code < 600 ? err.code : 500 }
      );
    }
    console.error("[notifications/cron] unexpected error", err);
    return NextResponse.json({ error: "publish failed" }, { status: 500 });
  }
}
