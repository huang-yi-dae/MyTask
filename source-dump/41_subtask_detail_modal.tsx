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
