"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEazo } from "@eazo/sdk/react";
import { auth } from "@eazo/sdk";
import {
  deleteTask, getSubtasksWithTask, getTasksWithSubtasks,
  toggleSubtask, updateTaskStatusApi,
} from "@/lib/api/tasks";
import type { SubtaskWithTask } from "@/lib/api/tasks";
import { StreakBar } from "./streak-bar";
import { RightPanel, useAnalysisPanel } from "./right-panel";
import { NewTaskInput } from "./new-task-input";
import { getSubtaskActualDates } from "./subtask-row";
import { TimelineCard, TimelineSectionHeader } from "./timeline-card";
import { SubtaskDetailModal } from "./subtask-detail-modal";
import { CongratulationsModal, type CongratsData } from "./congrats-modal";

// ─── Design Tokens ────────────────────────────────────────────────────
const T = {
  bg:      "#F9F9F8",
  surface: "#FFFFFF",
  soft:    "#F1F2EE",
  line:    "#E7E7E2",
  ink:     "#111111",
  muted:   "#777B75",
  accent:  "#3B7AFF",
  green:   "#2F5D50",
  sage:    "#A8B5A2",
  paper:   "#F4F1EA",
  error:   "#C0392B",
} as const;

type TimeFilter = "today" | "tomorrow" | "week" | "later" | "all";

// ─── 时间轴分组类型 ────────────────────────────────────────────────────
interface TimelineSection {
  key: TimeFilter;
  label: string;
  sublabel: string;
  accentColor: string;
  rows: SubtaskWithTask[];
}

// ─── Main Dashboard ───────────────────────────────────────────────────

export function HomePage() {
  const router = useRouter();
  const user = useEazo((s) => s.auth.user);
  const authLoading = useEazo((s) => s.auth.loading);

  const [subtaskRows, setSubtaskRows] = useState<SubtaskWithTask[]>([]);
  const [fetching, setFetching] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [detailSubtask, setDetailSubtask] = useState<SubtaskWithTask | null>(null);
  const [congrats, setCongrats] = useState<CongratsData | null>(null);
  const [highlightedSubtaskId, setHighlightedSubtaskId] = useState<string | null>(null);
  const [streakTick, setStreakTick] = useState(0);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    entries, focusedId, setFocusedId,
    startAnalysis, regenAnalysis, removeEntry,
    hydrateFromDB, focusTask,
  } = useAnalysisPanel();

  const loadSubtasks = useCallback(async () => {
    setFetching(true);
    try { setSubtaskRows(await getSubtasksWithTask()); }
    finally { setFetching(false); }
  }, []);

  useEffect(() => {
    if (!user) { setSubtaskRows([]); return; }
    loadSubtasks();
  }, [user, loadSubtasks]);

  // Hydrate right panel with historical tasks on login
  useEffect(() => {
    if (!user) return;
    getTasksWithSubtasks().then((tasks) => hydrateFromDB(tasks)).catch(() => {});
  }, [user, hydrateFromDB]);

  // Refresh left list when analysis completes
  useEffect(() => {
    const done = entries.some((e) => e.stream.phase === "done");
    if (done && user) loadSubtasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.map((e) => e.stream.phase).join(",")]);

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteTask(taskId).catch(() => {});
    setSubtaskRows((prev) => prev.filter((s) => s.taskId !== taskId));
    removeEntry(taskId);
  };

  const handleToggleSubtask = useCallback(async (taskId: string, subtaskId: string, current: boolean) => {
    const next = !current;
    setSubtaskRows((prev) => prev.map((s) => s.id === subtaskId ? { ...s, completed: next } : s));
    setDetailSubtask((prev) => prev?.id === subtaskId ? { ...prev, completed: next } : prev);
    await toggleSubtask(taskId, subtaskId, next).catch(() => {});
    // 完成时刷新 streak 统计
    if (next) setStreakTick(t => t + 1);
    setSubtaskRows((prev) => {
      const rows = prev.filter((s) => s.taskId === taskId);
      const allDone = next && rows.length > 0 && rows.every((s) => (s.id === subtaskId ? next : s.completed));
      if (allDone) {
        updateTaskStatusApi(taskId, "done").catch(() => {});
        const taskTitle = rows[0]?.taskTitle ?? "";
        setCongrats({ taskId, taskTitle, subtasks: rows.map((s) => (s.id === subtaskId ? { ...s, completed: true } : s)) });
        return prev.map((s) => s.taskId === taskId ? { ...s, taskStatus: "done" } : s);
      }
      return prev;
    });
  }, []);

  const handleJumpToSubtask = useCallback((
    subtaskId: string, _taskStartDate: string | null, _startDay: number, _durationDays: number,
  ) => {
    // 时间轴视图：只需高亮对应卡片，页面已经按日期分组展示
    setHighlightedSubtaskId(subtaskId);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedSubtaskId(null), 3000);
    // 尝试滚动到高亮卡片
    setTimeout(() => {
      const el = document.getElementById(`subtask-card-${subtaskId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }, []);

  // 时间轴分组
  const sections = buildTimelineSections(subtaskRows);
  const totalPending = subtaskRows.filter(r => !r.completed).length;
  const todayStr = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{ background: T.bg, height: "100%", display: "flex", flexDirection: "column", fontFamily: "var(--font-geist), Geist, system-ui, sans-serif" }}>
      <header style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ color: T.ink, fontWeight: 700, fontSize: 17, letterSpacing: "-0.04em" }}>AutoTask</div>
          <div style={{ color: T.muted, fontSize: 11, marginTop: 1 }}>订单式任务系统原型</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!authLoading && !user && <button onClick={() => auth.login().catch(() => {})} style={{ color: T.muted, fontSize: 13, background: "none", border: `1px solid ${T.line}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>登录</button>}
          {user && <button onClick={() => auth.logout().catch(() => {})} style={{ color: T.muted, fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>退出</button>}
          <button onClick={() => { if (!user) { auth.login().catch(() => {}); return; } setShowInput(true); }}
            style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 400 }}>+</span> 新建任务
          </button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── 左侧：时间轴视图 ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: `1px solid ${T.line}`, overflow: "hidden" }}>
          {/* 工具栏 */}
          <div style={{ padding: "10px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", background: T.surface, flexShrink: 0, gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.ink, letterSpacing: "-0.01em" }}>学习日历</span>
            <div style={{ flex: 1 }} />
            {totalPending > 0 && (
              <span style={{ fontSize: 11, color: T.muted }}>待完成 {totalPending} 项</span>
            )}
          </div>

          {/* 连续学习统计条 */}
          {user && <StreakBar refreshTick={streakTick} />}

          {/* 内容区 */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
            {authLoading || fetching ? (
              <div style={{ color: T.muted, fontSize: 13, padding: "40px 10px", textAlign: "center" }}>加载中…</div>
            ) : !user ? (
              <div style={{ color: T.muted, fontSize: 13, padding: "60px 10px", textAlign: "center" }}>
                <div style={{ marginBottom: 12 }}>登录后可查看和管理任务</div>
                <button onClick={() => auth.login().catch(() => {})} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer" }}>登录</button>
              </div>
            ) : sections.every(s => s.rows.length === 0) ? (
              <div style={{ color: T.muted, fontSize: 13, padding: "60px 10px", textAlign: "center" }}>
                暂无任务，点击右上角「新建任务」开始。
              </div>
            ) : (
              sections.filter(s => s.rows.length > 0).map((section) => (
                <div key={section.key} style={{ marginBottom: 28 }}>
                  <TimelineSectionHeader
                    label={section.label}
                    sublabel={section.sublabel}
                    accentColor={section.accentColor}
                    pendingCount={section.rows.filter(r => !r.completed).length}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {section.rows.map((row) => (
                      <div key={row.id} id={`subtask-card-${row.id}`}>
                        <TimelineCard
                          row={row}
                          isSelected={focusedId === row.taskId}
                          isHighlighted={highlightedSubtaskId === row.id}
                          onOpen={() => setDetailSubtask(row)}
                          onSelect={() => { setFocusedId(row.taskId); focusTask(row.taskId); }}
                          onDeleteTask={handleDeleteTask}
                          onToggle={(e) => { e.stopPropagation(); handleToggleSubtask(row.taskId, row.id, row.completed); }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <RightPanel entries={entries} focusedId={focusedId} setFocusedId={setFocusedId}
          regenAnalysis={regenAnalysis} removeEntry={removeEntry}
          onToggleSubtask={handleToggleSubtask} onJumpToSubtask={handleJumpToSubtask} />
      </div>

      <footer style={{ background: T.surface, borderTop: `1px solid ${T.line}`, padding: "7px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ color: T.muted, fontSize: 12 }}>今天：{todayStr}</span>
        <span style={{ color: T.muted, fontSize: 12 }}>点击任务行查看详情 · 右侧可跳转日期视图</span>
      </footer>

      {showInput && <NewTaskInput onClose={() => setShowInput(false)} onSubmit={(goal) => startAnalysis(goal)} />}
      {detailSubtask && <SubtaskDetailModal row={detailSubtask} onClose={() => setDetailSubtask(null)} onToggle={() => handleToggleSubtask(detailSubtask.taskId, detailSubtask.id, detailSubtask.completed)} onOpenTask={() => { router.push(`/task/${detailSubtask.taskId}`); setDetailSubtask(null); }} />}
      {congrats && <CongratulationsModal data={congrats} onClose={() => setCongrats(null)} onLearnMore={(taskId) => { setFocusedId(taskId); focusTask(taskId); setCongrats(null); }} />}
    </div>
  );
}

// ─── 时间轴分段构建 ───────────────────────────────────────────────────
/**
 * 将所有子任务按时间段分为 4 组：
 *   今天 / 明天 / 本周（后 7 天）/ 更早 or 更晚
 * 每组内：未完成在前（按 sortOrder），已完成在后
 */
function buildTimelineSections(rows: SubtaskWithTask[]): TimelineSection[] {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const weekEnd  = new Date(today.getTime() + 7 * 86400000);

  const fmtDate = (d: Date) => d.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });
  const fmtRange = (s: Date, e: Date) =>
    `${s.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} — ${e.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}`;

  const buckets: Record<string, SubtaskWithTask[]> = {
    today: [], tomorrow: [], week: [], later: [],
  };

  for (const r of rows) {
    const dates = getSubtaskActualDates(r);
    if (!dates) {
      // 没有排期 → 放到今天
      buckets.today.push(r);
      continue;
    }
    const { start, end } = dates;
    if (start <= today && today <= end) {
      buckets.today.push(r);
    } else if (start <= tomorrow && tomorrow <= end) {
      buckets.tomorrow.push(r);
    } else if (start <= weekEnd && end >= today) {
      buckets.week.push(r);
    } else {
      buckets.later.push(r);
    }
  }

  const sort = (arr: SubtaskWithTask[]) =>
    [...arr].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.sortOrder - b.sortOrder;
    });

  return [
    {
      key: "today",
      label: "今天",
      sublabel: fmtDate(today),
      accentColor: "#3B7AFF",
      rows: sort(buckets.today),
    },
    {
      key: "tomorrow",
      label: "明天",
      sublabel: fmtDate(tomorrow),
      accentColor: "#E07B2A",
      rows: sort(buckets.tomorrow),
    },
    {
      key: "week",
      label: "本周",
      sublabel: fmtRange(new Date(today.getTime() + 2 * 86400000), weekEnd),
      accentColor: "#2F5D50",
      rows: sort(buckets.week),
    },
    {
      key: "later",
      label: "更晚",
      sublabel: (() => {
        const laterRows = sort(buckets.later);
        if (laterRows.length === 0) return "7 天之后";
        // 从所有 later 行里找最早和最晚的实际日期
        let minDate: Date | null = null;
        let maxDate: Date | null = null;
        for (const r of laterRows) {
          const d = getSubtaskActualDates(r);
          if (!d) continue;
          if (!minDate || d.start < minDate) minDate = d.start;
          if (!maxDate || d.end > maxDate) maxDate = d.end;
        }
        if (!minDate || !maxDate) return "7 天之后";
        const diffDays = Math.round((minDate.getTime() - today.getTime()) / 86400000);
        const dayHint = diffDays > 0 ? `（${diffDays} 天后开始）` : "";
        return `${fmtRange(minDate, maxDate)}${dayHint}`;
      })(),
      accentColor: "#94a3b8",
      rows: sort(buckets.later),
    },
  ];
}


