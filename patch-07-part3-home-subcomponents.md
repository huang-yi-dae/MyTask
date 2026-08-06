# patch-07-part3-home-subcomponents.md
# 包含：new-task-input.tsx / subtask-row.tsx / subtask-detail-modal.tsx / congrats-modal.tsx

## src/components/home/new-task-input.tsx

```typescript
"use client";

import { useState, useRef, useEffect } from "react";

const T = {
  surface: "#FFFFFF",
  soft:    "#F1F2EE",
  line:    "#E7E7E2",
  ink:     "#111111",
  muted:   "#777B75",
  accent:  "#3B7AFF",
} as const;

interface Props {
  onClose: () => void;
  onSubmit: (goal: string) => void;
}

export function NewTaskInput({ onClose, onSubmit }: Props) {
  const [goal, setGoal] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  const handleSubmit = () => {
    if (!goal.trim()) return;
    onSubmit(goal.trim());
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(17,17,17,0.25)", zIndex: 100, backdropFilter: "blur(2px)" }}
      />
      {/* Dialog */}
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: T.surface, border: `1px solid ${T.line}`, borderRadius: 18,
        padding: "24px 24px 20px", width: "min(480px, 92vw)",
        zIndex: 101, boxShadow: "0 20px 60px rgba(17,17,17,0.1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ color: T.ink, fontWeight: 700, fontSize: 15, letterSpacing: "-0.03em" }}>新建任务</div>
          <button onClick={onClose} style={{ color: T.muted, background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <textarea
          ref={ref}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder="你想做什么？例如：高考数学"
          rows={3}
          style={{
            width: "100%", background: T.soft, border: `1px solid ${T.line}`, borderRadius: 10,
            padding: "11px 13px", color: T.ink, fontSize: 14, fontWeight: 500,
            outline: "none", resize: "vertical", fontFamily: "inherit",
            boxSizing: "border-box", letterSpacing: "-0.02em",
          }}
        />
        <p style={{ color: T.muted, fontSize: 11, margin: "6px 0 16px" }}>
          按 Enter 或点击开始分析；AI 将在右侧进度视图实时展示结果
        </p>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleSubmit}
            disabled={!goal.trim()}
            style={{
              flex: 1, background: T.accent, color: "#fff", border: "none", borderRadius: 10,
              padding: "10px 0", fontSize: 13, fontWeight: 600, letterSpacing: "-0.02em",
              cursor: goal.trim() ? "pointer" : "not-allowed",
              opacity: goal.trim() ? 1 : 0.5,
            }}
          >
            开始分析 →
          </button>
          <button
            onClick={onClose}
            style={{ background: T.soft, color: T.muted, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 16px", fontSize: 13, cursor: "pointer" }}
          >
            取消
          </button>
        </div>
      </div>
    </>
  );
}
```

---

## src/components/home/subtask-row.tsx

```typescript
"use client";

import type { SubtaskWithTask } from "@/lib/api/tasks";

const T = {
  surface: "#FFFFFF", soft: "#F1F2EE", line: "#E7E7E2",
  ink: "#111111", muted: "#777B75", accent: "#3B7AFF",
  green: "#2F5D50", orange: "#E07B2A", highlight: "#FFF9E6",
} as const;

// Priority label helpers
const URGENCY_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];
const URGENCY_LABELS = ["", "极紧急", "较紧急", "一般", "较宽松", "不紧急"];
const IMPORTANCE_LABELS = ["", "极重要", "较重要", "一般", "较次要", "参考"];

interface Props {
  row: SubtaskWithTask;
  isSelected: boolean;
  isHighlighted: boolean;
  onOpen: () => void;                                        // 单击打开详情
  onSelect: () => void;                                      // 选中（聚焦右侧面板）
  onDeleteTask: (taskId: string, e: React.MouseEvent) => void;
  onToggle: (e: React.MouseEvent) => void;
}

export function SubtaskRow({ row, isSelected, isHighlighted, onOpen, onSelect, onDeleteTask, onToggle }: Props) {
  const dateRange = getSubtaskDateRange(row);

  // Parse keywords
  let kwArr: string[] = [];
  if (row.keywords) {
    try { kwArr = JSON.parse(row.keywords) as string[]; } catch { /* ignore */ }
  }

  return (
    <div
      onClick={() => { onOpen(); onSelect(); }}
      style={{
        padding: "10px 14px 10px 18px",
        cursor: "pointer",
        borderBottom: `1px solid ${T.line}`,
        background: isHighlighted
          ? T.highlight
          : row.completed
            ? "#FAFAF9"
            : isSelected
              ? "rgba(59,122,255,0.04)"
              : T.surface,
        borderLeft: isHighlighted
          ? `3px solid #F59E0B`
          : isSelected
            ? `3px solid ${T.accent}`
            : `3px solid transparent`,
        transition: "background 0.2s, border-left 0.2s",
        opacity: row.completed ? 0.65 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
        {/* Status dot */}
        <div style={{
          width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginTop: 5,
          background: row.completed ? T.green : T.accent,
          boxShadow: row.completed
            ? `0 0 0 3px rgba(47,93,80,0.12)`
            : `0 0 0 3px rgba(59,122,255,0.1)`,
        }} />

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <div style={{
            color: row.completed ? T.muted : T.ink, fontSize: 14, fontWeight: 500,
            letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            textDecoration: row.completed ? "line-through" : "none",
          }}>
            {row.title}
          </div>

          {/* Meta row: task + date */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <span style={{
              color: row.taskStatus === "done" ? T.green : T.accent,
              fontSize: 11, fontWeight: 500,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {row.taskTitle}
            </span>
            <span style={{ color: T.line, flexShrink: 0 }}>·</span>
            <span style={{ color: T.muted, fontSize: 11, fontFamily: "var(--font-geist-mono), monospace", flexShrink: 0 }}>
              {dateRange ?? `${row.durationDays}天`}
            </span>
          </div>

          {/* Attribute badges: topic, urgency, importance, keywords */}
          {(row.topic || row.urgency || row.importance || kwArr.length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
              {row.topic && (
                <AttrBadge label={row.topic} color={T.accent} bg="rgba(59,122,255,0.07)" />
              )}
              {row.urgency && row.urgency >= 1 && row.urgency <= 5 && (
                <AttrBadge
                  label={`⚡${URGENCY_LABELS[row.urgency]}`}
                  color={URGENCY_COLORS[row.urgency]}
                  bg={`${URGENCY_COLORS[row.urgency]}15`}
                />
              )}
              {row.importance && row.importance >= 1 && row.importance <= 5 && (
                <AttrBadge
                  label={`★${IMPORTANCE_LABELS[row.importance]}`}
                  color="#7C4DFF"
                  bg="rgba(124,77,255,0.07)"
                />
              )}
              {kwArr.slice(0, 2).map((kw, i) => (
                <AttrBadge key={i} label={kw} color={T.orange} bg="rgba(224,123,42,0.08)" />
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, marginTop: 1 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(e); }}
            title={row.completed ? "取消完成" : "标记已完成"}
            style={{
              width: 26, height: 26, borderRadius: 6,
              border: `1px solid ${row.completed ? T.green : T.line}`,
              background: row.completed ? "rgba(47,93,80,0.08)" : "transparent",
              color: row.completed ? T.green : T.muted,
              fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✓</button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteTask(row.taskId, e); }}
            title="删除大任务"
            style={{
              width: 26, height: 26, borderRadius: 6, border: "none",
              background: "transparent", color: T.muted, fontSize: 16,
              cursor: "pointer", opacity: 0.4,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >×</button>
        </div>
      </div>
    </div>
  );
}

function AttrBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: 9, padding: "2px 6px", borderRadius: 4,
      color, background: bg,
      border: `1px solid ${color}25`,
      whiteSpace: "nowrap", maxWidth: 80,
      overflow: "hidden", textOverflow: "ellipsis",
      fontWeight: 500, letterSpacing: "0.01em",
    }}>
      {label}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function getSubtaskDateRange(row: SubtaskWithTask): string | null {
  if (!row.taskStartDate) return null;
  const base = new Date(row.taskStartDate);
  if (isNaN(base.getTime())) return null;
  const start = new Date(base);
  start.setDate(base.getDate() + row.startDay);
  const end = new Date(base);
  end.setDate(base.getDate() + row.startDay + row.durationDays - 1);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return start.getTime() === end.getTime() ? fmt(start) : `${fmt(start)} - ${fmt(end)}`;
}

export function getSubtaskActualDates(row: SubtaskWithTask): { start: Date; end: Date } | null {
  if (!row.taskStartDate) return null;
  const base = new Date(row.taskStartDate);
  if (isNaN(base.getTime())) return null;
  const baseDay = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const start = new Date(baseDay);
  start.setDate(baseDay.getDate() + row.startDay);
  const end = new Date(baseDay);
  end.setDate(baseDay.getDate() + row.startDay + row.durationDays - 1);
  return { start, end };
}
```

---

## src/components/home/subtask-detail-modal.tsx

```typescript
"use client";

import type { SubtaskWithTask } from "@/lib/api/tasks";
import { getSubtaskDateRange } from "./subtask-row";

const T = {
  surface: "#FFFFFF", soft: "#F1F2EE", line: "#E7E7E2",
  ink: "#111111", muted: "#777B75", accent: "#3B7AFF",
  green: "#2F5D50", paper: "#F4F1EA", orange: "#E07B2A", purple: "#7C4DFF",
} as const;

interface Props {
  row: SubtaskWithTask;
  onClose: () => void;
  onToggle: () => void;
  onOpenTask: () => void;
}

export function SubtaskDetailModal({ row, onClose, onToggle, onOpenTask }: Props) {
  const dateRange = getSubtaskDateRange(row);

  // Parse resources
  type ResItem = { type: string; title: string; url?: string; searchQuery?: string; author?: string; platform?: string };
  let resources: ResItem[] = [];
  if (row.resources) {
    try { resources = JSON.parse(row.resources) as ResItem[]; } catch { /* ignore */ }
  }

  // Parse keywords
  let keywords: string[] = [];
  if (row.keywords) {
    try { keywords = JSON.parse(row.keywords) as string[]; } catch { /* ignore */ }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(17,17,17,0.22)", zIndex: 200, backdropFilter: "blur(2px)" }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: T.surface, border: `1px solid ${T.line}`, borderRadius: 18,
        padding: "22px 22px 18px", width: "min(460px, 92vw)", maxHeight: "88vh",
        overflowY: "auto", zIndex: 201, boxShadow: "0 20px 60px rgba(17,17,17,0.12)",
        display: "flex", flexDirection: "column", gap: 14,
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: row.taskStatus === "done" ? T.green : T.accent, flexShrink: 0 }} />
              <span style={{ color: row.taskStatus === "done" ? T.green : T.accent, fontSize: 11, fontWeight: 600 }}>{row.taskTitle}</span>
            </div>
            <div style={{ color: row.completed ? T.muted : T.ink, fontWeight: 700, fontSize: 17, lineHeight: 1.3, letterSpacing: "-0.03em", textDecoration: row.completed ? "line-through" : "none", wordBreak: "break-all" }}>
              {row.title}
            </div>
          </div>
          <button onClick={onClose} style={{ color: T.muted, background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>

        {/* Attributes strip */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {row.topic && <AttrPill icon="🏷" label={`主题：${row.topic}`} color={T.accent} />}
          {row.urgency && <AttrPill icon="⚡" label={`紧急度 ${row.urgency}/5`} color="#f97316" />}
          {row.importance && <AttrPill icon="★" label={`重要度 ${row.importance}/5`} color={T.purple} />}
          {keywords.slice(0, 3).map((k, i) => <AttrPill key={i} icon="🔑" label={k} color={T.orange} />)}
          <MetaTag label="工期" value={`${row.durationDays} 天`} />
          {dateRange && <MetaTag label="日期" value={dateRange} />}
          <MetaTag label="状态" value={row.completed ? "已完成" : "进行中"} color={row.completed ? T.green : T.accent} />
        </div>

        {/* Description */}
        <div style={{ background: T.soft, borderRadius: 10, padding: "12px 14px", color: row.description ? T.ink : T.muted, fontSize: 13, lineHeight: 1.65 }}>
          {row.description || "暂无详细说明"}
        </div>

        {/* Resources */}
        {resources.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ color: T.muted, fontSize: 11, fontWeight: 600, letterSpacing: "0.03em" }}>📚 推荐资源</div>
            {resources.map((r, i) => {
              const icon = r.type === "link" ? "🔗" : r.type === "search" ? "🔎" : r.type === "person" ? "👤" : "📚";
              const clickable = !!(r.url || r.searchQuery);
              return (
                <div key={i}
                  onClick={clickable ? () => {
                    if (r.url) window.open(r.url, "_blank", "noopener");
                    else if (r.searchQuery) window.open(`https://www.google.com/search?q=${encodeURIComponent(r.searchQuery)}`, "_blank", "noopener");
                  } : undefined}
                  style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 11px", background: T.soft, borderRadius: 9, cursor: clickable ? "pointer" : "default" }}>
                  <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: T.ink, fontSize: 12, fontWeight: 500 }}>{r.title}</div>
                    {r.author && <div style={{ color: T.muted, fontSize: 11, marginTop: 1 }}>👤 {r.author}{r.platform ? ` · ${r.platform}` : ""}</div>}
                    {r.searchQuery && !r.url && <div style={{ color: T.accent, fontSize: 11, marginTop: 2, fontFamily: "var(--font-geist-mono), monospace" }}>搜：{r.searchQuery}</div>}
                    {r.url && <div style={{ color: T.accent, fontSize: 10, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.url}</div>}
                  </div>
                  {clickable && <span style={{ color: T.accent, fontSize: 12, flexShrink: 0 }}>→</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, paddingTop: 2 }}>
          <button
            onClick={() => { onToggle(); onClose(); }}
            style={{
              flex: 1, border: `1px solid ${row.completed ? T.line : T.accent}`,
              background: row.completed ? T.soft : T.accent,
              color: row.completed ? T.muted : "#fff",
              borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {row.completed ? "↩ 取消完成" : "✓ 标记已完成"}
          </button>
          <button onClick={onOpenTask} style={{ background: T.soft, color: T.muted, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, cursor: "pointer" }}>
            大任务 →
          </button>
        </div>
      </div>
    </>
  );
}

function AttrPill({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600, color, background: `${color}14`, border: `1px solid ${color}28`, borderRadius: 6, padding: "3px 8px" }}>
      {icon} {label}
    </span>
  );
}

function MetaTag({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#F1F2EE", borderRadius: 6, padding: "4px 9px" }}>
      <span style={{ color: "#777B75", fontSize: 11 }}>{label}</span>
      <span style={{ color: color ?? "#111111", fontSize: 11, fontWeight: 600, fontFamily: "var(--font-geist-mono), monospace" }}>{value}</span>
    </div>
  );
}
```

---

## src/components/home/congrats-modal.tsx

```typescript
"use client";

// ─── CongratulationsModal ─────────────────────────────────────────────
// 弹出时机：某个大任务下所有子任务全部勾选完成

import type { SubtaskWithTask } from "@/lib/api/tasks";

const T = {
  surface: "#FFFFFF", soft: "#F1F2EE", line: "#E7E7E2",
  ink: "#111111", muted: "#777B75", accent: "#3B7AFF",
  green: "#2F5D50", paper: "#F4F1EA",
} as const;

export interface CongratsData {
  taskTitle: string;
  taskId: string;
  subtasks: SubtaskWithTask[];
}

interface Props {
  data: CongratsData;
  onClose: () => void;
  onLearnMore: (taskId: string) => void;
}

export function CongratulationsModal({ data, onClose, onLearnMore }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(17,17,17,0.35)", backdropFilter: "blur(4px)",
        }}
      />
      {/* Card */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        background: T.surface, border: `1px solid ${T.line}`,
        borderRadius: 20, padding: "28px 28px 22px",
        width: "min(460px, 93vw)", maxHeight: "85vh",
        overflowY: "auto", zIndex: 301,
        boxShadow: "0 24px 80px rgba(17,17,17,0.14)",
        display: "flex", flexDirection: "column", gap: 18,
      }}>

        {/* Trophy + Title */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 12 }}>🎉</div>
          <div style={{ color: T.ink, fontWeight: 800, fontSize: 20, letterSpacing: "-0.04em", lineHeight: 1.2 }}>
            恭喜你完成了
          </div>
          <div style={{ color: T.accent, fontWeight: 700, fontSize: 16, marginTop: 6, letterSpacing: "-0.03em" }}>
            「{data.taskTitle}」
          </div>
        </div>

        {/* Achievement summary */}
        <div style={{ background: "linear-gradient(135deg, #f0f9f4, #e8f4fd)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ color: T.green, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            🌱 恭喜你对以下内容有了进一步的了解：
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.subtasks.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ color: T.green, fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: T.ink, fontSize: 13, fontWeight: 500 }}>{s.title}</span>
                  {s.description && (
                    <div style={{ color: T.muted, fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>{s.description}</div>
                  )}
                </div>
                <span style={{ color: T.green, fontSize: 10, fontFamily: "monospace", flexShrink: 0 }}>
                  {s.durationDays}天
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Topic badge if available */}
        {data.subtasks[0]?.topic && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span style={{
              background: "rgba(59,122,255,0.08)", color: T.accent,
              border: "1px solid rgba(59,122,255,0.2)",
              fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20,
            }}>
              主题：{data.subtasks[0].topic}
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => onLearnMore(data.taskId)}
            style={{
              background: T.accent, color: "#fff", border: "none",
              borderRadius: 12, padding: "11px 0", fontSize: 14, fontWeight: 600,
              cursor: "pointer", letterSpacing: "-0.02em",
            }}
          >
            📖 进一步学习
          </button>
          <button
            onClick={onClose}
            style={{
              background: "none", color: T.muted, border: "none",
              fontSize: 12, cursor: "pointer", padding: "4px 0",
              letterSpacing: "-0.01em",
            }}
          >
            关闭，查看其他任务
          </button>
        </div>
      </div>
    </>
  );
}
```
