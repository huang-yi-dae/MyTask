"use client";

import { useState, useEffect, useCallback } from "react";
import { request } from "@/lib/api/request";
import { getLevel, getNextLevel, getLevelProgress } from "@/lib/growth";

const T = {
  surface: "#FFFFFF", soft: "#F1F2EE", line: "#E7E7E2",
  ink: "#111111", muted: "#777B75", accent: "#3B7AFF",
} as const;

interface Stats {
  streak: number;
  totalCompleted: number;
  learnDays: number;
  totalGoals: number;
}

interface Props {
  /** 外部触发刷新（每次完成子任务 +1）*/
  refreshTick?: number;
}

/** 方向A：累计成就面板 —— 让用户看到“我走了多远” */
export function AchievementPanel({ refreshTick = 0 }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await request("/api/user/stats");
      if (res.ok) setStats(await res.json() as Stats);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats, refreshTick]);

  if (!stats) return null;

  const { totalCompleted, learnDays, totalGoals } = stats;
  const level = getLevel(totalCompleted);
  const next = getNextLevel(totalCompleted);
  const prog = getLevelProgress(totalCompleted);

  const metrics = [
    { label: "累计完成", value: totalCompleted, unit: "步", icon: "✅" },
    { label: "学习天数", value: learnDays, unit: "天", icon: "📆" },
    { label: "学习目标", value: totalGoals, unit: "个", icon: "🎯" },
  ];

  return (
    <div style={{
      margin: "12px 14px 0", padding: "14px 16px",
      background: `linear-gradient(135deg, ${level.color}0D, ${T.surface})`,
      border: `1px solid ${level.color}33`, borderRadius: 14,
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      {/* 等级 + 进度 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: `${level.color}1A`, border: `1px solid ${level.color}40`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        }}>{level.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: level.color, letterSpacing: "-0.02em" }}>Lv · {level.name}</span>
            {next && <span style={{ fontSize: 11, color: T.muted }}>再完成 {prog.need - prog.done} 步升级「{next.name}」</span>}
            {!next && <span style={{ fontSize: 11, color: level.color }}>已达最高等级 👑</span>}
          </div>
          {/* 进度条 */}
          <div style={{ marginTop: 6, height: 6, background: T.soft, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${Math.round(prog.pct * 100)}%`, height: "100%", background: level.color, borderRadius: 4, transition: "width 0.5s ease" }} />
          </div>
        </div>
      </div>

      {/* 累计三项指标 */}
      <div style={{ display: "flex", gap: 8 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{
            flex: 1, background: T.surface, border: `1px solid ${T.line}`,
            borderRadius: 10, padding: "9px 8px", textAlign: "center",
          }}>
            <div style={{ fontSize: 15, marginBottom: 2 }}>{m.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.ink, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              {m.value}<span style={{ fontSize: 10, fontWeight: 500, color: T.muted, marginLeft: 1 }}>{m.unit}</span>
            </div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
