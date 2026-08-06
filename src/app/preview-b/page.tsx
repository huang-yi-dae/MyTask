"use client";
// ─── 方向 B 预览：时间轴视图（Structured.app 风格）─────────────────────────
// 纯静态 mock 数据，用于效果确认，不连接数据库

import { useState } from "react";

const T = {
  bg: "#F9F9F8", surface: "#FFFFFF", soft: "#F1F2EE", line: "#E7E7E2",
  ink: "#111111", muted: "#777B75", accent: "#3B7AFF",
  green: "#2F5D50", orange: "#E07B2A", purple: "#7C4DFF", yellow: "#F59E0B",
} as const;

// ─── Mock 数据 ─────────────────────────────────────────────────────────
const MOCK_SECTIONS = [
  {
    label: "今天",
    sublabel: "8月6日 周三",
    accentColor: "#3B7AFF",
    items: [
      { id: "1", title: "Python 变量与数据类型", task: "掌握Python基础", taskColor: "#3B7AFF", bloom: 2, bloomLabel: "理解", durationDays: 1, deepHours: 1.5, completed: true,  topic: "编程" },
      { id: "2", title: "条件语句与循环结构",   task: "掌握Python基础", taskColor: "#3B7AFF", bloom: 3, bloomLabel: "应用", durationDays: 2, deepHours: 3.0, completed: false, topic: "编程" },
      { id: "3", title: "线性代数基础概念复习",  task: "攻克线性代数",   taskColor: "#7C4DFF", bloom: 1, bloomLabel: "记忆", durationDays: 1, deepHours: 1.5, completed: false, topic: "数学" },
    ],
  },
  {
    label: "明天",
    sublabel: "8月7日 周四",
    accentColor: "#E07B2A",
    items: [
      { id: "4", title: "函数定义与作用域",      task: "掌握Python基础", taskColor: "#3B7AFF", bloom: 3, bloomLabel: "应用", durationDays: 2, deepHours: 3.0, completed: false, topic: "编程" },
      { id: "5", title: "矩阵乘法与行列式",      task: "攻克线性代数",   taskColor: "#7C4DFF", bloom: 2, bloomLabel: "理解", durationDays: 2, deepHours: 3.0, completed: false, topic: "数学" },
    ],
  },
  {
    label: "本周",
    sublabel: "8月8日 — 8月12日",
    accentColor: "#2F5D50",
    items: [
      { id: "6", title: "列表、字典与元组",      task: "掌握Python基础", taskColor: "#3B7AFF", bloom: 3, bloomLabel: "应用", durationDays: 2, deepHours: 3.0, completed: false, topic: "编程" },
      { id: "7", title: "特征值与特征向量",      task: "攻克线性代数",   taskColor: "#7C4DFF", bloom: 4, bloomLabel: "分析", durationDays: 3, deepHours: 4.5, completed: false, topic: "数学" },
      { id: "8", title: "英语口语练习 — 自我介绍", task: "英语口语提升",   taskColor: "#E07B2A", bloom: 3, bloomLabel: "应用", durationDays: 1, deepHours: 1.5, completed: false, topic: "语言" },
    ],
  },
];

const BLOOM_COLORS: Record<number, string> = { 1: "#94a3b8", 2: "#60a5fa", 3: "#34d399", 4: "#f97316", 5: "#a78bfa", 6: "#f43f5e" };

export default function PreviewB() {
  const [completed, setCompleted] = useState<Set<string>>(new Set(["1"]));

  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.04em", color: T.ink }}>AutoTask</div>
          <div style={{ color: T.muted, fontSize: 11 }}>方向 B · 时间轴视图</div>
        </div>
        <a href="/preview-d" style={{ fontSize: 12, color: T.accent, textDecoration: "none", background: "rgba(59,122,255,0.08)", border: "1px solid rgba(59,122,255,0.2)", borderRadius: 7, padding: "5px 12px" }}>
          → 查看方向 D
        </a>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px 40px" }}>

        {/* 说明标签 */}
        <div style={{ margin: "18px 0 14px", padding: "10px 14px", background: "rgba(59,122,255,0.06)", border: "1px solid rgba(59,122,255,0.15)", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: T.accent, fontWeight: 600, marginBottom: 3 }}>💡 方向 B · 时间轴视图</div>
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
            按今天 / 明天 / 本周三段组织任务。每张卡片有时长指示条（深色宽度 = 预计学习时长），对齐日历思维。参考：Structured.app
          </div>
        </div>

        {MOCK_SECTIONS.map((section) => (
          <div key={section.label} style={{ marginBottom: 28 }}>
            {/* 时段标题 */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 3, height: 28, borderRadius: 2, background: section.accentColor, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: T.ink, letterSpacing: "-0.03em" }}>{section.label}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{section.sublabel}</div>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 11, color: T.muted, fontVariantNumeric: "tabular-nums" }}>
                {section.items.filter(i => !completed.has(i.id)).length} 项待完成
              </div>
            </div>

            {/* 任务卡片 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {section.items.map((item) => {
                const isDone = completed.has(item.id);
                // 时长指示条宽度：1.5h=33%, 3h=66%, 4.5h=100%
                const barWidth = Math.min(100, (item.deepHours / 4.5) * 100);

                return (
                  <div
                    key={item.id}
                    style={{
                      background: isDone ? "#FAFAF9" : T.surface,
                      border: `1px solid ${isDone ? T.line : T.line}`,
                      borderRadius: 12,
                      overflow: "hidden",
                      opacity: isDone ? 0.6 : 1,
                      transition: "all 0.2s",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setCompleted(prev => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                        return next;
                      });
                    }}
                  >
                    {/* 时长指示条（顶部彩色细条） */}
                    <div style={{ height: 3, background: T.soft }}>
                      <div style={{ height: 3, width: `${barWidth}%`, background: item.taskColor, borderRadius: "0 2px 0 0", transition: "width 0.3s" }} />
                    </div>

                    <div style={{ padding: "10px 14px 12px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        {/* 完成圆圈 */}
                        <div style={{
                          width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                          border: `2px solid ${isDone ? item.taskColor : T.line}`,
                          background: isDone ? item.taskColor : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.2s",
                        }}>
                          {isDone && <span style={{ color: "#fff", fontSize: 10, lineHeight: 1 }}>✓</span>}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* 标题 */}
                          <div style={{
                            fontSize: 14, fontWeight: 500, color: isDone ? T.muted : T.ink,
                            textDecoration: isDone ? "line-through" : "none",
                            letterSpacing: "-0.02em", marginBottom: 4,
                          }}>
                            {item.title}
                          </div>

                          {/* 元信息行 */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {/* 大任务标签 */}
                            <span style={{ fontSize: 10, fontWeight: 600, color: item.taskColor, background: `${item.taskColor}12`, border: `1px solid ${item.taskColor}25`, borderRadius: 5, padding: "1px 7px" }}>
                              {item.task}
                            </span>
                            {/* Bloom 层级 */}
                            <span style={{ fontSize: 10, fontWeight: 600, color: BLOOM_COLORS[item.bloom], background: `${BLOOM_COLORS[item.bloom]}15`, border: `1px solid ${BLOOM_COLORS[item.bloom]}30`, borderRadius: 5, padding: "1px 7px" }}>
                              Bloom L{item.bloom} · {item.bloomLabel}
                            </span>
                          </div>
                        </div>

                        {/* 右侧：时长 */}
                        <div style={{ flexShrink: 0, textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: item.taskColor, letterSpacing: "-0.02em" }}>{item.deepHours}h</div>
                          <div style={{ fontSize: 9, color: T.muted }}>{item.durationDays}天</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* 底部说明 */}
        <div style={{ padding: "14px 16px", background: T.soft, borderRadius: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, color: T.muted }}>
            <span style={{ fontWeight: 600, color: T.ink }}>顶部色条</span> = 预计学习时长（越长越宽）
          </div>
          <div style={{ fontSize: 11, color: T.muted }}>
            <span style={{ fontWeight: 600, color: T.ink }}>点击卡片</span> = 切换完成状态
          </div>
          <div style={{ fontSize: 11, color: T.muted }}>
            <span style={{ fontWeight: 600, color: T.ink }}>三段分区</span> = 今天 / 明天 / 本周
          </div>
        </div>
      </div>
    </div>
  );
}
