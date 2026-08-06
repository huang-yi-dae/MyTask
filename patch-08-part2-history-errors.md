# patch-08-part2-history-errors.md
# 包含：history-page.tsx + error-fallback-page.tsx + error-page-shell.tsx + not-found-page.tsx

## src/components/history/history-page.tsx

```typescript
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useEazo } from "@eazo/sdk/react";
import { auth } from "@eazo/sdk";
import { getTasks, deleteTask } from "@/lib/api/tasks";
import type { TaskWithProgress } from "@/lib/api/tasks";

export function HistoryPage() {
  const user = useEazo((s) => s.auth.user);
  const loading = useEazo((s) => s.auth.loading);
  const [tasks, setTasks] = useState<TaskWithProgress[]>([]);
  // fetching 初始 false，等用户已登录再置 true，避免闪烁
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setFetching(true);
      try {
        const data = await getTasks();
        if (!cancelled) { setFetching(false); setTasks(data); }
      } catch {
        if (!cancelled) setFetching(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await deleteTask(id).catch(() => {});
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <PageShell>
      {loading || fetching ? (
        <LoadingState />
      ) : !user ? (
        <div className="flex flex-col items-center gap-4 py-20">
          <p className="text-[14px]" style={{ color: "#777B75" }}>
            登录后可查看历史任务
          </p>
          <button
            onClick={() => auth.login().catch(() => {})}
            className="px-6 py-[10px] rounded-full text-[14px] font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: "#111111" }}
          >
            登录
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-[14px]" style={{ color: "#777B75" }}>
          还没有任务记录，回首页创建第一个吧 →
        </p>
      ) : (
        <>
          <h2
            className="text-[28px] font-semibold tracking-[-0.05em] mb-5"
            style={{ color: "#111111" }}
          >
            最近任务
          </h2>

          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
          >
            {tasks.map((task) => {
              const pct =
                task.subtaskCount > 0
                  ? Math.round((task.completedCount / task.subtaskCount) * 100)
                  : 0;

              return (
                <Link key={task.id} href={`/task/${task.id}`} className="block group">
                  <article
                    className="rounded-[18px] p-[18px] border transition-shadow hover:shadow-md"
                    style={{ background: "#F4F1EA", borderColor: "#E7E7E2" }}
                  >
                    <b className="block text-[15px] font-semibold leading-snug truncate">
                      {task.title}
                    </b>

                    {/* 进度条 */}
                    {task.subtaskCount > 0 && (
                      <div className="mt-3 mb-1">
                        <div
                          className="h-[3px] rounded-full overflow-hidden"
                          style={{ background: "#E7E7E2" }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: pct === 100 ? "#2F5D50" : "#3B7AFF",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <span
                        className="text-[12px]"
                        style={{
                          fontFamily: "var(--font-geist-mono), monospace",
                          color: "#777B75",
                        }}
                      >
                        {task.subtaskCount > 0
                          ? `${task.completedCount}/${task.subtaskCount} 已完成`
                          : task.totalDays > 0
                          ? `${task.totalDays}天`
                          : "—"}{" "}
                        · {new Date(task.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                      <button
                        onClick={(e) => handleDelete(task.id, e)}
                        className="text-[13px] opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                        style={{ color: "#777B75" }}
                        title="删除"
                      >
                        ×
                      </button>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative z-10"
      style={{
        paddingTop: "var(--safe-top)",
        paddingBottom: "var(--safe-bottom)",
        minHeight: "100vh",
      }}
    >
      <div className="mx-auto px-4" style={{ width: "min(100% - 32px, 760px)" }}>
        <nav
          className="flex items-center justify-between"
          style={{ height: 64, fontSize: 14, color: "#777B75" }}
        >
          <Link
            href="/"
            className="font-[650] tracking-[-0.03em] hover:opacity-70 transition-opacity"
            style={{ color: "#111111" }}
          >
            ← AutoTask
          </Link>
          <span
            className="text-[12px] tracking-[0.06em] uppercase"
            style={{
              color: "#777B75",
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          >
            History
          </span>
        </nav>
        <div className="pt-4 pb-14">{children}</div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <p className="text-[14px] py-10" style={{ color: "#777B75" }}>
      加载中…
    </p>
  );
}
```

---

## src/components/errors/error-fallback-page.tsx

```typescript
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircle, Home, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorPageShell } from "@/components/errors/error-page-shell";
import { cn } from "@/utils/utils";

type ErrorFallbackPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export function ErrorFallbackPage({ error, reset }: ErrorFallbackPageProps) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  const showDetails =
    process.env.NODE_ENV === "development" && Boolean(error.message);

  return (
    <ErrorPageShell>
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm">
          <AlertCircle
            className="size-8 text-destructive"
            strokeWidth={1.5}
          />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("errors.generic.title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("errors.generic.description")}
        </p>

        {showDetails ? (
          <p className="mt-4 max-w-full rounded-lg border border-border/80 bg-muted/50 px-3 py-2 text-left font-mono text-xs text-muted-foreground break-all">
            {error.message}
            {error.digest ? (
              <span className="mt-1 block text-[0.65rem] opacity-70">
                digest: {error.digest}
              </span>
            ) : null}
          </p>
        ) : null}

        <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button size="lg" className="gap-2" onClick={() => reset()}>
            <RotateCcw className="size-4" />
            {t("errors.generic.tryAgain")}
          </Button>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2")}
          >
            <Home className="size-4" />
            {t("errors.generic.backHome")}
          </Link>
        </div>
      </div>
    </ErrorPageShell>
  );
}
```

---

## src/components/errors/error-page-shell.tsx

```typescript
import type { ReactNode } from "react";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { cn } from "@/utils/utils";

type ErrorPageShellProps = {
  children: ReactNode;
  className?: string;
};

export function ErrorPageShell({ children, className }: ErrorPageShellProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background px-6 py-16",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.92_0.02_250/0.45),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,oklch(0.85_0_0/0.12)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.85_0_0/0.12)_1px,transparent_1px)] [background-size:3rem_3rem]"
      />

      <header className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <LanguageSwitcher />
      </header>

      <div className="relative z-[1] w-full max-w-md">{children}</div>
    </div>
  );
}
```

---

## src/components/errors/not-found-page.tsx

```typescript
"use client";

import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { useTranslation } from "react-i18next";

import { buttonVariants } from "@/components/ui/button";
import { ErrorPageShell } from "@/components/errors/error-page-shell";
import { cn } from "@/utils/utils";

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <ErrorPageShell>
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl border border-border/80 bg-card shadow-sm">
          <FileQuestion className="size-8 text-muted-foreground" strokeWidth={1.5} />
        </div>

        <p className="text-[5rem] font-semibold leading-none tracking-tighter text-foreground/10 select-none">
          {t("errors.notFound.code")}
        </p>

        <h1 className="-mt-10 text-2xl font-semibold tracking-tight text-foreground">
          {t("errors.notFound.title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("errors.notFound.description")}
        </p>

        <Link
          href="/"
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-8 min-w-[10rem] gap-2",
          )}
        >
          <Home className="size-4" />
          {t("errors.notFound.backHome")}
        </Link>
      </div>
    </ErrorPageShell>
  );
}
```
