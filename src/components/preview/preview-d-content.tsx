"use client";

import { useState } from "react";

const T = {
  bg: "#F9F9F8", surface: "#FFFFFF", soft: "#F1F2EE", line: "#E7E7E2",
  ink: "#111111", muted: "#777B75", accent: "#3B7AFF",
  green: "#2F5D50", orange: "#E07B2A",
} as const;

export const BLOOM_STAGES = [
  { level: 1, label: "记忆", icon: "📖", color: "#94a3b8", desc: "背诵基础概念" },
  { level: 2, label: "理解", icon: "💡", color: "#60a5fa", desc: "理解原理" },
  { level: 3, label: "应用", icon: "🔧", color: "#34d399", desc: "动手实践" },
  { level: 4, label: "分析", icon: "🔍", color: "#f97316", desc: "拆解问题" },
  { level: 5, label: "评估", icon: "⚖️", color: "#a78bfa", desc: "判断优劣" },
  { level: 6, label: "创造", icon: "✨", color: "#f43f5e", desc: "独立设计" },
];

const MOCK_TASKS = [
  {
    id: "t1", title: "掌握Python基础", color: "#3B7AFF", topic: "编程", bloomTarget: 3,
    subtasks: [
      { id: "s1", title: "变量与数据类型",   bloom: 2, deepHours: 1.5, completed: true,  dateLabel: "8/5" },
      { id: "s2", title: "条件语句与循环",   bloom: 3, deepHours: 3.0, completed: true,  dateLabel: "8/6 - 8/7" },
      { id: "s3", title: "函数定义与作用域", bloom: 3, deepHours: 3.0, completed: false, dateLabel: "8/8 - 8/9",   isCurrent: true },
      { id: "s4", title: "列表与字典操作",   bloom: 3, deepHours: 3.0, completed: false, dateLabel: "8/10 - 8/11" },
      { id: "s5", title: "面向对象编程",     bloom: 4, deepHours: 4.5, completed: false, dateLabel: "8/12 - 8/14" },
    ],
  },
  {
    id: "t2", title: "攻克线性代数", color: "#7C4DFF", topic: "数学", bloomTarget: 4,
    subtasks: [
      { id: "s6", title: "向量空间基础",     bloom: 1, deepHours: 1.5, completed: true,  dateLabel: "8/4" },
      { id: "s7", title: "矩阵乘法与行列式", bloom: 2, deepHours: 3.0, completed: false, dateLabel: "8/6 - 8/7",  isCurrent: true },
      { id: "s8", title: "特征值与特征向量", bloom: 4, deepHours: 4.5, completed: false, dateLabel: "8/8 - 8/10" },
    ],
  },
  {
    id: "t3", title: "英语口语提升", color: "#E07B2A", topic: "语言", bloomTarget: 3,
    subtasks: [
      { id: "s9",  title: "自我介绍练习",  bloom: 2, deepHours: 1.5, completed: false, dateLabel: "8/6", isCurrent: true },
      { id: "s10", title: "日常对话情景", bloom: 3, deepHours: 3.0, completed: false, dateLabel: "8/7 - 8/8" },
    ],
  },
];

function BloomAxis({ task, currentBloom, progress }: { task: typeof MOCK_TASKS[0]; currentBloom: number; progress: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 6, position: "relative" }}>
        {BLOOM_STAGES.slice(0, task.bloomTarget).map((stage, idx) => {
          const isActive = stage.level === currentBloom;
          const isPast   = stage.level < currentBloom || progress === 1;
          const isLast   = idx === task.bloomTarget - 1;
          return (
            <div key={stage.level} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
              {/* 左侧连接线 */}
              {idx > 0 && (
                <div style={{ position: "absolute", left: 0, top: isActive ? 9 : 6, width: "50%", height: 2, background: isPast ? stage.color : T.line, transition: "background 0.25s", zIndex: 0 }} />
              )}
              {/* 右侧连接线 */}
              {!isLast && (
                <div style={{ position: "absolute", right: 0, top: isActive ? 9 : 6, width: "50%", height: 2, background: isPast && !isActive ? BLOOM_STAGES[idx + 1]?.color ?? T.line : T.line, transition: "background 0.25s", zIndex: 0 }} />
              )}
              {/* 节点 */}
              <div style={{
                width: isActive ? 20 : 14, height: isActive ? 20 : 14, borderRadius: "50%",
                background: isPast ? stage.color : isActive ? stage.color : T.soft,
                border: `2px solid ${isActive || isPast ? stage.color : T.line}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: isActive ? `0 0 0 4px ${stage.color}25` : "none",
                transition: "all 0.25s", zIndex: 1, position: "relative",
              }}>
                {isPast && !isActive && <span style={{ color: "#fff", fontSize: 8, fontWeight: 700 }}>✓</span>}
                {isActive && <span style={{ fontSize: 9 }}>{stage.icon}</span>}
              </div>
              <span style={{ fontSize: 9, marginTop: 3, color: isActive ? stage.color : isPast ? T.muted : T.line, fontWeight: isActive ? 700 : 400, whiteSpace: "nowrap" }}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
      {/* 当前阶段说明 */}
      {(() => {
        const s = BLOOM_STAGES.find(b => b.level === currentBloom);
        return s ? (
          <div style={{ fontSize: 10, color: s.color, fontWeight: 500 }}>
            {progress === 1 ? "🎉 全部完成！" : `当前：${s.icon} L${s.level} ${s.label} — ${s.desc}`}
          </div>
        ) : null;
      })()}
    </div>
  );
}

function TaskCard({ task, expanded, onToggle, completed, onToggleDone }: {
  task: typeof MOCK_TASKS[0];
  expanded: boolean;
  onToggle: () => void;
  completed: Set<string>;
  onToggleDone: (id: string, e: React.MouseEvent) => void;
}) {
  const completedCount = task.subtasks.filter(s => completed.has(s.id)).length;
  const progress = completedCount / task.subtasks.length;
  const remaining = task.subtasks.filter(s => !completed.has(s.id));
  const currentBloom = remaining.length > 0 ? Math.min(...remaining.map(s => s.bloom)) : task.bloomTarget;

  return (
    <div style={{ marginBottom: 14, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 8px rgba(17,17,17,0.04)" }}>
      {/* 头部 */}
      <div onClick={onToggle} style={{ padding: "14px 16px", cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: task.color, flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: "-0.03em" }}>{task.title}</div>
          <span style={{ fontSize: 10, fontWeight: 600, color: task.color, background: `${task.color}12`, borderRadius: 5, padding: "2px 8px", marginRight: 4 }}>{task.topic}</span>
          <span style={{ color: T.muted, fontSize: 14, display: "inline-block", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
        </div>
        <BloomAxis task={task} currentBloom={currentBloom} progress={progress} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 4, background: T.soft, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: 4, width: `${progress * 100}%`, background: task.color, borderRadius: 2, transition: "width 0.4s" }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>{completedCount}/{task.subtasks.length}</span>
        </div>
      </div>

      {/* 子任务列表 */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${T.line}` }}>
          {task.subtasks.map((s, idx) => {
            const isDone = completed.has(s.id);
            const isCur = !isDone && (s as Record<string, unknown>).isCurrent === true;
            const bs = BLOOM_STAGES[s.bloom - 1];
            return (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 16px",
                borderBottom: idx < task.subtasks.length - 1 ? `1px solid ${T.line}` : "none",
                background: isCur ? `${task.color}06` : isDone ? "#FAFAF9" : T.surface,
                opacity: isDone ? 0.6 : 1, transition: "all 0.2s",
              }}>
                <button onClick={(e) => onToggleDone(s.id, e)} style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${isDone ? task.color : T.line}`,
                  background: isDone ? task.color : "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                }}>
                  {isDone && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
                </button>
                <span style={{ fontSize: 11, color: T.muted, fontWeight: 600, flexShrink: 0, width: 14, textAlign: "center" }}>{idx + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: isCur ? 600 : 400, color: isDone ? T.muted : T.ink, textDecoration: isDone ? "line-through" : "none", letterSpacing: "-0.01em" }}>
                    {s.title}
                  </div>
                  <div style={{ display: "flex", gap: 5, marginTop: 2, alignItems: "center" }}>
                    {isCur && <span style={{ fontSize: 9, fontWeight: 700, color: task.color, background: `${task.color}15`, borderRadius: 4, padding: "1px 6px" }}>▶ 进行中</span>}
                    <span style={{ fontSize: 10, color: T.muted }}>{s.dateLabel}</span>
                  </div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 600, color: bs.color, background: `${bs.color}15`, border: `1px solid ${bs.color}30`, borderRadius: 5, padding: "2px 7px", flexShrink: 0 }}>
                  {bs.icon} {bs.label}
                </span>
                <span style={{ fontSize: 11, color: T.muted, fontWeight: 600, flexShrink: 0, width: 30, textAlign: "right" }}>{s.deepHours}h</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PreviewDContent() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["t1", "t2"]));
  const [completed, setCompleted] = useState<Set<string>>(new Set(["s1", "s2", "s6"]));

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleDone = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompleted(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.04em", color: T.ink }}>AutoTask</div>
          <div style={{ color: T.muted, fontSize: 11 }}>方向 D · 大任务卡片 + Bloom 进度轴</div>
        </div>
        <a href="/preview-b" style={{ fontSize: 12, color: T.accent, textDecoration: "none", background: "rgba(59,122,255,0.08)", border: "1px solid rgba(59,122,255,0.2)", borderRadius: 7, padding: "5px 12px" }}>← 查看方向 B</a>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px 40px" }}>
        <div style={{ margin: "18px 0 14px", padding: "10px 14px", background: "rgba(47,93,80,0.06)", border: "1px solid rgba(47,93,80,0.15)", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: T.green, fontWeight: 600, marginBottom: 3 }}>💡 方向 D · 大任务卡片 + Bloom 认知轴</div>
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>每个学习项目是一张卡片，顶部 Bloom 认知轴实时高亮当前阶段。展开看子步骤，圆圈点击完成，进度条动态更新。</div>
        </div>

        {MOCK_TASKS.map(task => (
          <TaskCard key={task.id} task={task} expanded={expanded.has(task.id)}
            onToggle={() => toggleExpand(task.id)} completed={completed} onToggleDone={toggleDone} />
        ))}

        <div style={{ padding: "14px 16px", background: T.soft, borderRadius: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: T.muted }}><span style={{ fontWeight: 600, color: T.ink }}>Bloom 节点轴</span> = 当前认知阶段高亮</div>
          <div style={{ fontSize: 11, color: T.muted }}><span style={{ fontWeight: 600, color: T.ink }}>点击卡片头部</span> = 展开/收起</div>
          <div style={{ fontSize: 11, color: T.muted }}><span style={{ fontWeight: 600, color: T.ink }}>点击圆圈</span> = 完成子任务</div>
        </div>
      </div>
    </div>
  );
}
