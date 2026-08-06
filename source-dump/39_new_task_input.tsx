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
