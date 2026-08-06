# AutoTask · 完整源码补充（missing-code.md）

所有文件均为项目实际源码，一行不差，按文件路径顺序排列。

---

## 1. src/lib/db/queries/tasks.ts

```typescript
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tasks, subtasks } from "@/lib/db/schema";
import type { Task, Subtask } from "@/lib/db/schema";

// ── Task with progress counts ─────────────────────────────────────────
export type TaskWithProgress = Task & {
  subtaskCount: number;
  completedCount: number;
};

// ── Subtask row enriched with parent task info ────────────────────────
export type SubtaskWithTask = Subtask & {
  taskTitle: string;
  taskRawInput: string | null;
  taskStartDate: Date | null;  // 大任务开始日期
  taskStatus: string;
  taskCreatedAt: Date;
};

// ── Tasks ────────────────────────────────────────────────────────────

export async function getTasksByUser(userId: string): Promise<TaskWithProgress[]> {
  const rows = await db
    .select({
      id: tasks.id,
      userId: tasks.userId,
      title: tasks.title,
      rawInput: tasks.rawInput,
      startDate: tasks.startDate,
      status: tasks.status,
      totalDays: tasks.totalDays,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      subtaskCount: sql<number>`COUNT(${subtasks.id})::int`,
      completedCount: sql<number>`COUNT(${subtasks.id}) FILTER (WHERE ${subtasks.completed} = true)::int`,
    })
    .from(tasks)
    .leftJoin(subtasks, eq(subtasks.taskId, tasks.id))
    .where(eq(tasks.userId, userId))
    .groupBy(tasks.id)
    .orderBy(desc(tasks.createdAt));

  return rows as TaskWithProgress[];
}

/** 返回该用户所有子任务，附带所属大任务 title / rawInput / startDate / status */
export async function getSubtasksWithTaskByUser(userId: string): Promise<SubtaskWithTask[]> {
  const rows = await db
    .select({
      // subtask fields
      id: subtasks.id,
      taskId: subtasks.taskId,
      title: subtasks.title,
      description: subtasks.description,
      durationDays: subtasks.durationDays,
      startDay: subtasks.startDay,
      completed: subtasks.completed,
      sortOrder: subtasks.sortOrder,
      resources: subtasks.resources,
      topic: subtasks.topic,
      urgency: subtasks.urgency,
      importance: subtasks.importance,
      keywords: subtasks.keywords,
      createdAt: subtasks.createdAt,
      // parent task fields
      taskTitle: tasks.title,
      taskRawInput: tasks.rawInput,
      taskStartDate: tasks.startDate,
      taskStatus: tasks.status,
      taskCreatedAt: tasks.createdAt,
    })
    .from(subtasks)
    .innerJoin(tasks, eq(subtasks.taskId, tasks.id))
    .where(eq(tasks.userId, userId))
    .orderBy(desc(tasks.createdAt), subtasks.sortOrder);

  return rows as SubtaskWithTask[];
}

export async function getTaskById(id: string): Promise<Task | null> {
  const rows = await db.select().from(tasks).where(eq(tasks.id, id));
  return rows[0] ?? null;
}

export async function createTask(
  userId: string,
  title: string
): Promise<Task> {
  const rows = await db
    .insert(tasks)
    .values({ userId, title, status: "active", totalDays: 0 })
    .returning();
  return rows[0];
}

export async function updateTaskTitleAndRawInput(
  id: string,
  title: string,
  rawInput: string,
): Promise<void> {
  await db
    .update(tasks)
    .set({ title, rawInput, updatedAt: new Date() })
    .where(eq(tasks.id, id));
}

export async function updateTaskStartDate(
  id: string,
  startDate: Date,
): Promise<void> {
  await db
    .update(tasks)
    .set({ startDate, updatedAt: new Date() })
    .where(eq(tasks.id, id));
}

export async function updateTaskTotalDays(
  id: string,
  totalDays: number
): Promise<void> {
  await db
    .update(tasks)
    .set({ totalDays, updatedAt: new Date() })
    .where(eq(tasks.id, id));
}

export async function updateTaskStatus(
  id: string,
  status: string
): Promise<void> {
  await db
    .update(tasks)
    .set({ status, updatedAt: new Date() })
    .where(eq(tasks.id, id));
}

export async function deleteTask(id: string): Promise<void> {
  await db.delete(tasks).where(eq(tasks.id, id));
}

// ── Subtasks ─────────────────────────────────────────────────────────

export async function getSubtasksByTask(taskId: string): Promise<Subtask[]> {
  return db
    .select()
    .from(subtasks)
    .where(eq(subtasks.taskId, taskId))
    .orderBy(subtasks.sortOrder);
}

export type SubtaskInsert = {
  title: string;
  description?: string;
  durationDays: number;
  startDay: number;
  sortOrder: number;
  resources?: string | null;
  topic?: string | null;
  urgency?: number | null;
  importance?: number | null;
  keywords?: string | null;  // JSON string[]
};

export async function createSubtasks(
  taskId: string,
  items: SubtaskInsert[]
): Promise<Subtask[]> {
  if (items.length === 0) return [];
  const rows = await db
    .insert(subtasks)
    .values(items.map((s) => ({ ...s, taskId })))
    .returning();
  return rows;
}

export async function toggleSubtask(
  id: string,
  completed: boolean
): Promise<void> {
  await db.update(subtasks).set({ completed }).where(eq(subtasks.id, id));
}

/** 返回该用户所有任务的排期摘要（用于全局接续计算） */
export async function getScheduledTasksByUser(userId: string): Promise<Array<{
  taskId: string;
  startDate: Date | null;
  totalDays: number;
  createdAt: Date;
  status: string;
}>> {
  const rows = await db
    .select({
      taskId: tasks.id,
      startDate: tasks.startDate,
      totalDays: tasks.totalDays,
      createdAt: tasks.createdAt,
      status: tasks.status,
    })
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(tasks.createdAt);
  return rows;
}

/** 返回该用户所有完成分析的任务（含子任务），用于右侧面板持久化加载 */
export type TaskWithSubtasksFull = Task & { subtasks: Subtask[] };

export async function getTasksWithSubtasksByUser(userId: string): Promise<TaskWithSubtasksFull[]> {
  const taskRows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(desc(tasks.createdAt));

  if (taskRows.length === 0) return [];

  // fetch subtasks for all tasks in one query
  const { inArray } = await import("drizzle-orm");
  const taskIds = taskRows.map((t) => t.id);
  const subtaskRows = await db
    .select()
    .from(subtasks)
    .where(inArray(subtasks.taskId, taskIds))
    .orderBy(subtasks.sortOrder);

  // group subtasks by taskId
  const byTask = new Map<string, Subtask[]>();
  for (const s of subtaskRows) {
    if (!byTask.has(s.taskId)) byTask.set(s.taskId, []);
    byTask.get(s.taskId)!.push(s);
  }

  return taskRows.map((t) => ({ ...t, subtasks: byTask.get(t.id) ?? [] }));
}
```

---

---

## 3. src/lib/eazo-ai-billing.ts

```typescript
type ChatMessage = {
  role: string;
  content: unknown;
  [key: string]: unknown;
};

type ChatParams = {
  model?: string;
  model_key?: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
};

type StreamingChatParams = ChatParams & {
  stream: true;
};

type ChatCompletionLike = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type ChatDeltaChunk = {
  choices: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

type ErrorBody = {
  code?: string;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
  detail?: {
    code?: string;
    message?: string;
  };
};

export class AppAIUnavailableError extends Error {
  code = "app_ai_unavailable";

  constructor(message = "AI 功能暂时不可用。如需继续使用，请联系该应用的创作者。") {
    super(message);
    this.name = "AppAIUnavailableError";
  }
}

const APP_AI_UNAVAILABLE_MESSAGE =
  "AI 功能暂时不可用。如需继续使用，请联系该应用的创作者。";

function appAiApiBase() {
  return (
    process.env.EAZO_APP_AI_API_BASE ||
    process.env.EAZO_PLATFORM_API_BASE ||
    "https://eazo.ai/creator"
  ).replace(/\/+$/, "");
}

function providerBase() {
  return (process.env.AI_PROVIDER_BASE_URL || "").replace(/\/+$/, "");
}

function providerMode() {
  return (process.env.EAZO_AI_PROVIDER_MODE || "eazo").trim().toLowerCase();
}

function modelKey(params: ChatParams) {
  return String(params.model_key || params.model || process.env.EAZO_AI_MODEL_KEY || "deepseek.v3.1");
}

function requestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function* streamProviderSse(response: Response): AsyncGenerator<ChatDeltaChunk> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let chunk: ChatDeltaChunk & ErrorBody;
      try {
        chunk = JSON.parse(data) as ChatDeltaChunk & ErrorBody;
      } catch {
        throw new Error("AI stream returned an invalid SSE payload");
      }
      if (chunk.error) {
        if (
          chunk.error.code === "app_ai_unavailable" ||
          chunk.error.code === "credits_exhausted"
        ) {
          throw new AppAIUnavailableError(chunk.error.message);
        }
        throw new Error(chunk.error.message || "AI stream failed");
      }
      yield chunk;
    }
  }
}

async function callCreatorProxy(
  params: StreamingChatParams,
): Promise<AsyncIterable<ChatDeltaChunk>>;
async function callCreatorProxy(params: ChatParams): Promise<ChatCompletionLike>;
async function callCreatorProxy(
  params: ChatParams,
): Promise<ChatCompletionLike | AsyncIterable<ChatDeltaChunk>> {
  const appId = process.env.EAZO_APP_ID;
  if (!appId) throw new AppAIUnavailableError();

  const { messages, ...rest } = params;
  delete rest.stream;
  delete rest.model;
  delete rest.model_key;
  const res = await fetch(`${appAiApiBase()}/api/app-ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-eazo-app-id": appId,
      ...(process.env.EAZO_PRIVATE_KEY
        ? { Authorization: `Bearer ${process.env.EAZO_PRIVATE_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      app_id: appId,
      model_key: modelKey(params),
      messages,
      request_id: requestId(),
      stream: params.stream === true,
      params: rest,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const rawBody = await res.text().catch(() => "");
    let body: ErrorBody | string = rawBody;
    try {
      body = JSON.parse(rawBody) as ErrorBody;
    } catch {
      // Keep the plain response body for diagnostics.
    }
    const code =
      typeof body === "string"
        ? ""
        : body.detail?.code || body.error?.code || body.code;
    if (code === "app_ai_unavailable" || code === "credits_exhausted" || res.status === 402) {
      throw new AppAIUnavailableError(
        typeof body === "string"
          ? undefined
          : body.detail?.message || body.error?.message || body.message,
      );
    }
    throw new Error(typeof body === "string" ? body : `App AI request failed (${res.status})`);
  }
  return params.stream
    ? streamProviderSse(res)
    : ((await res.json()) as ChatCompletionLike);
}

async function callByokProvider(
  params: StreamingChatParams,
): Promise<AsyncIterable<ChatDeltaChunk>>;
async function callByokProvider(params: ChatParams): Promise<ChatCompletionLike>;
async function callByokProvider(
  params: ChatParams,
): Promise<ChatCompletionLike | AsyncIterable<ChatDeltaChunk>> {
  const base = providerBase();
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const model = process.env.AI_PROVIDER_MODEL || params.model || params.model_key;
  if (!base || !apiKey || !model) {
    throw new Error("BYOK AI provider is not configured");
  }
  const { ...body } = params;
  delete body.model_key;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...body, model }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`AI provider request failed (${res.status})`);
  }
  return params.stream ? streamProviderSse(res) : ((await res.json()) as ChatCompletionLike);
}

async function chat(params: StreamingChatParams): Promise<AsyncIterable<ChatDeltaChunk>>;
async function chat(params: ChatParams): Promise<ChatCompletionLike>;
async function chat(
  params: ChatParams,
): Promise<ChatCompletionLike | AsyncIterable<ChatDeltaChunk>> {
  if (providerMode() === "byok") {
    return params.stream === true
      ? callByokProvider(params as StreamingChatParams)
      : callByokProvider(params);
  }
  return params.stream === true
    ? callCreatorProxy(params as StreamingChatParams)
    : callCreatorProxy(params);
}

export function createAppAiClient() {
  return {
    chat,
  };
}

export const appAi = createAppAiClient();
export { APP_AI_UNAVAILABLE_MESSAGE };
```

---

## 4. src/lib/api/request.ts

```typescript
"use client";

import { auth } from "@eazo/sdk";
import { getResolvedLocale } from "@/i18n";
import { appAIRequest } from "@/lib/api/app-ai-request";

/**
 * Drop-in replacement for `fetch` that automatically injects `x-eazo-session`
 * and owns the common App AI unavailable toast for authenticated API calls.
 * The SDK resolves the current session header from either the host bridge
 * (Eazo Mobile) or localStorage (web).
 */
export async function request(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const sessionHeader = await auth.getSessionHeader();
  const headers = new Headers(init.headers);
  if (sessionHeader) headers.set("x-eazo-session", sessionHeader);
  headers.set("x-app-locale", getResolvedLocale());

  return appAIRequest(input, {
    ...init,
    headers,
  });
}
```

---

## 5. src/lib/api/app-ai-request.ts

```typescript
"use client";

import { toast } from "sonner";

export const APP_AI_UNAVAILABLE_MESSAGE =
  "AI 功能暂时不可用。如需继续使用，请联系该应用的创作者。";

const APP_AI_UNAVAILABLE_TOAST_ID = "app-ai-unavailable";

type AppAIErrorBody = {
  code?: unknown;
  detail?: { code?: unknown };
};

export class AppAIClientUnavailableError extends Error {
  readonly code = "app_ai_unavailable";

  constructor() {
    super(APP_AI_UNAVAILABLE_MESSAGE);
    this.name = "AppAIClientUnavailableError";
  }
}

/**
 * Browser wrapper for App-owned API routes that invoke App AI server-side.
 * It owns only the common 402 toast; all other responses remain untouched so
 * the feature component can keep its domain-specific error handling.
 */
export async function appAIRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 402) return response;

  let body: AppAIErrorBody | null = null;
  try {
    body = (await response.clone().json()) as AppAIErrorBody;
  } catch {
    return response;
  }
  const code = body?.detail?.code ?? body?.code;
  if (code !== "app_ai_unavailable") return response;

  toast.error(APP_AI_UNAVAILABLE_MESSAGE, { id: APP_AI_UNAVAILABLE_TOAST_ID });
  throw new AppAIClientUnavailableError();
}
```

---

## 6. src/lib/api/tasks.ts

```typescript
import { request } from "@/lib/api/request";
import type { Task, Subtask } from "@/lib/db/schema";

export interface TaskWithProgress extends Task {
  subtaskCount: number;
  completedCount: number;
}

export interface TaskWithSubtasks extends Task {
  subtasks: Subtask[];
}

/** 子任务 + 所属大任务信息（用于左侧列表展开展示） */
export interface SubtaskWithTask extends Subtask {
  taskTitle: string;
  taskRawInput: string | null;
  taskStartDate: string | null;  // ISO string from JSON，大任务开始日期
  taskStatus: string;
  taskCreatedAt: string;   // ISO string from JSON
}

export async function getTasks(): Promise<TaskWithProgress[]> {
  const res = await request("/api/tasks");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getTasksWithSubtasks(): Promise<TaskWithSubtasks[]> {
  const res = await request("/api/tasks?withSubtasks=1");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSubtasksWithTask(): Promise<SubtaskWithTask[]> {
  const res = await request("/api/subtasks");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getTask(id: string): Promise<TaskWithSubtasks> {
  const res = await request(`/api/tasks/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createTask(title: string): Promise<Task> {
  const res = await request("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateTaskStatusApi(
  taskId: string,
  status: string
): Promise<void> {
  const res = await request(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteTask(id: string): Promise<void> {
  const res = await request(`/api/tasks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function toggleSubtask(
  taskId: string,
  subtaskId: string,
  completed: boolean
): Promise<void> {
  const res = await request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed }),
  });
  if (!res.ok) throw new Error(await res.text());
}
```

---

## 7. src/app/layout.tsx

```typescript
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { EazoProvider } from "@eazo/sdk/react";
import { cn } from "@/utils/utils";
import { Toaster } from "@/components/ui/sonner";
import { UserSyncEffect } from "@/components/user-profile/user-sync-effect";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { LocaleSyncEffect } from "@/components/i18n/locale-sync-effect";
import { getServerLocale } from "@/lib/i18n/server-preference";

const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
});

const SITE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : undefined;

const SITE_TITLE = process.env.NEXT_PUBLIC_APP_TITLE?.trim() || "AutoTask";
const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION?.trim() ||
  "Type a goal, let AI plan the rest.";

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: { icon: "https://eazo.ai/favicon.ico" },
  openGraph: {
    type: "website",
    siteName: "Eazo",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getServerLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn("h-full antialiased", geist.variable, geistMono.variable)}
    >
      <body className="h-full flex flex-col overflow-hidden">
        <I18nProvider>
          <EazoProvider>
            <LocaleSyncEffect />
            <UserSyncEffect />
            {children}
            <Toaster />
          </EazoProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
```

---

## 8. src/app/globals.css

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

/* ── AutoTask Design Tokens — 清单仪式 ───────────────────────────── */
@theme inline {
  /* Fonts */
  --font-sans:    var(--font-geist);
  --font-mono:    var(--font-geist-mono);
  --font-heading: var(--font-geist);

  /* Brand palette */
  --color-ink:        #111111;
  --color-muted:      #777B75;
  --color-accent:     #3B7AFF;
  --color-green:      #2F5D50;
  --color-sage:       #A8B5A2;
  --color-paper:      #F4F1EA;
  --color-soft:       #F1F2EE;
  --color-line:       #E7E7E2;
  --color-bg:         #F9F9F8;
  --color-surface:    #FFFFFF;

  /* Shadcn semantic → clean white theme */
  --color-background:           var(--background);
  --color-foreground:           var(--foreground);
  --color-card:                 var(--card);
  --color-card-foreground:      var(--card-foreground);
  --color-popover:              var(--popover);
  --color-popover-foreground:   var(--popover-foreground);
  --color-primary:              var(--primary);
  --color-primary-foreground:   var(--primary-foreground);
  --color-secondary:            var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted-foreground:     var(--muted-foreground);
  --color-accent-foreground:    var(--accent-foreground);
  --color-destructive:          var(--destructive);
  --color-border:               var(--border);
  --color-input:                var(--input);
  --color-ring:                 var(--ring);

  /* Radius */
  --radius-sm:   6px;
  --radius-md:   8px;
  --radius-lg:   16px;
  --radius-xl:   20px;
  --radius-2xl:  24px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 4px 16px rgba(20,20,20,0.04);
  --shadow-md: 0 12px 40px rgba(20,20,20,0.035);

  /* Motion */
  --duration-default: 200ms;
  --ease-default: cubic-bezier(.2,.8,.2,1);

  /* Safe area */
  --safe-top:    max(56px, env(safe-area-inset-top, 0px));
  --safe-bottom: max(34px, env(safe-area-inset-bottom, 0px));

  /* Shadcn sidebar stubs */
  --color-sidebar-ring:               var(--sidebar-ring);
  --color-sidebar-border:             var(--sidebar-border);
  --color-sidebar-accent-foreground:  var(--sidebar-accent-foreground);
  --color-sidebar-accent:             var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary:            var(--sidebar-primary);
  --color-sidebar-foreground:         var(--sidebar-foreground);
  --color-sidebar:                    var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
}

/* ── CSS custom props ────────────────────────────────────────────── */
:root {
  --background: #F9F9F8;
  --foreground: #111111;
  --card: #FFFFFF;
  --card-foreground: #111111;
  --popover: #FFFFFF;
  --popover-foreground: #111111;
  --primary: #111111;
  --primary-foreground: #F9F9F8;
  --secondary: #F1F2EE;
  --secondary-foreground: #111111;
  --muted: #F1F2EE;
  --muted-foreground: #777B75;
  --accent: #3B7AFF;
  --accent-foreground: #FFFFFF;
  --destructive: oklch(0.577 0.245 27.325);
  --border: #E7E7E2;
  --input: #E7E7E2;
  --ring: #3B7AFF;
  --radius: 0.5rem;
  --chart-1: #3B7AFF;
  --chart-2: #2F5D50;
  --chart-3: #A8B5A2;
  --chart-4: #777B75;
  --chart-5: #F4F1EA;
  --sidebar: #FFFFFF;
  --sidebar-foreground: #111111;
  --sidebar-primary: #111111;
  --sidebar-primary-foreground: #F9F9F8;
  --sidebar-accent: #3B7AFF;
  --sidebar-accent-foreground: #FFFFFF;
  --sidebar-border: #E7E7E2;
  --sidebar-ring: #3B7AFF;
}

/* ── Base ────────────────────────────────────────────────────────── */
html, body { height: 100%; margin: 0; padding: 0; }
html { background: #F9F9F8; }

body {
  font-family: var(--font-geist), "Geist", system-ui, sans-serif;
  color: #111111;
  background: #F9F9F8;
  touch-action: manipulation;
  overflow: hidden;
}

/* ── iOS zoom prevention ─────────────────────────────────────────── */
@media (max-width: 640px) {
  input, textarea, select { font-size: 16px !important; }
}

/* ── Tailwind base ───────────────────────────────────────────────── */
@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}

/* ── Ritual check pop ───────────────────────────────────────────── */
@keyframes pop {
  from { transform: scale(0.35); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}
.pop-in   { animation: pop 0.7s cubic-bezier(.2,.8,.2,1) both; }
.pop-in-1 { animation: pop 0.7s cubic-bezier(.2,.8,.2,1) 0s    both; }
.pop-in-2 { animation: pop 0.7s cubic-bezier(.2,.8,.2,1) 0.25s both; }
.pop-in-3 { animation: pop 0.7s cubic-bezier(.2,.8,.2,1) 0.5s  both; }
.pop-in-4 { animation: pop 0.7s cubic-bezier(.2,.8,.2,1) 0.75s both; }

/* ── Gantt bar grow ──────────────────────────────────────────────── */
@keyframes ganttGrow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

/* ── Log reveal ─────────────────────────────────────────────────── */
@keyframes logReveal {
  to { opacity: 1; transform: translateY(0); }
}

/* ── Blink (legacy compat) ───────────────────────────────────────── */
@keyframes blink { 50% { opacity: 0; } }
```

---

## 9. src/app/page.tsx

```typescript
import { HomePage } from "@/components/home";

export default function Home() {
  return (
    <main style={{ height: "100%", overflow: "hidden" }}>
      <HomePage />
    </main>
  );
}
```

---

## 10. src/app/error.tsx

```typescript
"use client";

import { ErrorFallbackPage } from "@/components/errors/error-fallback-page";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  return <ErrorFallbackPage error={error} reset={reset} />;
}
```

---

## 11. src/app/not-found.tsx

```typescript
import { NotFoundPage } from "@/components/errors/not-found-page";

export default function NotFound() {
  return <NotFoundPage />;
}
```

---

## 12. src/app/api/tasks/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getTasksByUser,
  createTask,
  getTasksWithSubtasksByUser,
} from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const withSubtasks = request.nextUrl.searchParams.get("withSubtasks") === "1";
  if (withSubtasks) {
    const data = await getTasksWithSubtasksByUser(auth.user.id);
    return NextResponse.json(data);
  }

  const userTasks = await getTasksByUser(auth.user.id);
  return NextResponse.json(userTasks);
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const task = await createTask(auth.user.id, title);
  return NextResponse.json(task, { status: 201 });
}
```

---

## 13. src/app/api/tasks/[id]/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getTaskById,
  getSubtasksByTask,
  deleteTask,
  updateTaskStatus,
} from "@/lib/db/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const task = await getTaskById(id);
  if (!task || task.userId !== auth.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const subtasks = await getSubtasksByTask(id);
  return NextResponse.json({ ...task, subtasks });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const task = await getTaskById(id);
  if (!task || task.userId !== auth.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  if (typeof body.status === "string") {
    await updateTaskStatus(id, body.status);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const task = await getTaskById(id);
  if (!task || task.userId !== auth.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteTask(id);
  return NextResponse.json({ ok: true });
}
```

---

## 14. src/app/api/tasks/[id]/subtasks/[subtaskId]/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getTaskById, toggleSubtask } from "@/lib/db/queries";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id, subtaskId } = await params;
  const task = await getTaskById(id);
  if (!task || task.userId !== auth.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const completed = Boolean(body.completed);
  await toggleSubtask(subtaskId, completed);
  return NextResponse.json({ ok: true });
}
```

---

## 15. src/app/api/subtasks/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSubtasksWithTaskByUser } from "@/lib/db/queries";

/** GET /api/subtasks — 返回当前用户所有子任务（附带所属大任务信息） */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const items = await getSubtasksWithTaskByUser(auth.user.id);
  return NextResponse.json(items);
}
```

---

## 16. src/app/api/user/profile/route.ts

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { upsertUser } from "@/lib/db/queries";

/**
 * GET /api/user/profile
 * Decrypts the x-eazo-session header and returns the authenticated user's profile.
 * Works for both Eazo Mobile and Web — both send the same encrypted session shape.
 * Also upserts the user into the local DB so user info is always up to date.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { user } = auth;

  // Upsert in the background — don't block the response on DB latency.
  upsertUser({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  }).catch((err) => {
    console.error("[profile] upsertUser failed", err);
  });

  return NextResponse.json({ ok: true, user });
}
```

---

## 17. src/app/api/notifications/cron/daily-digest/route.ts

```typescript
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
```

---

## 18. src/app/api/mcp/route.ts

```typescript
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { buildMcpServer } from "@/lib/mcp/server";

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless mode: each serverless invocation is independent
    sessionIdGenerator: undefined,
  });

  const server = buildMcpServer(auth.user.id);
  await server.connect(transport);

  return transport.handleRequest(request);
}

export async function GET(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function POST(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleMcpRequest(request);
}
```

---

## 2. src/lib/scheduler.ts

```typescript
/**
 * AutoTask 全局排期算法 v2
 *
 * 理论依据：
 *
 * 1. 接续排期（Sequential Scheduling）
 *    新任务的 startDate 从当前所有未完成任务的最后一天 +1 开始，
 *    避免多任务在同一时间区间内堆叠。
 *
 * 2. 每日深度工作上限（Deep Work Budget）
 *    参考 Cal Newport《Deep Work》& Anders Ericsson 研究：
 *    大多数人每天能维持的深度认知工作上限为 4 小时（240分钟）。
 *    本系统将每天的"子任务槽位"限定为 MAX_SUBTASKS_PER_DAY = 3，
 *    对应约 2-4 小时实际学习时间，防止过载导致放弃。
 *
 * 3. 交错主题学习（Interleaved Practice）
 *    研究来源：Kornell & Bjork (2008), "Learning Concepts and Categories"
 *    同一主题在同一天内不超过 MAX_SAME_TOPIC_PER_DAY = 1，
 *    强制不同主题交错排列，利用"间隔效应"提升长期记忆巩固。
 *
 * 4. 四象限优先级（Eisenhower Matrix）
 *    urgency × importance 乘积作为基础优先级分数。
 *    Q1(紧急+重要)=25分, Q2(不紧急+重要)=最高战略价值但不被立即处理，
 *    因此给予 Q2 任务额外 bonus 鼓励提前安排。
 *
 * 5. 递延惩罚（Delay Penalty）
 *    参考 Todoist Smart Schedule 算法：
 *    被拖延超过 7 天的任务获得额外优先级 boost，
 *    防止"雪球效应"——任务被无限推迟。
 *
 * 6. Bloom 分层标记（Bloom's Taxonomy Level）
 *    任务子步骤携带 bloom_level (1-6)：
 *    记忆(1) → 理解(2) → 应用(3) → 分析(4) → 评估(5) → 创造(6)
 *    排期时低 Bloom 层级的子任务优先排在前面，符合"脚手架学习"原则
 *    （Scaffolding, Vygotsky ZPD theory）。
 *
 * 7. 窗口式排期（Sliding Window）
 *    在接续排期基础上，若用户已有 >7 天的任务空白（无任何子任务），
 *    新任务直接从今天开始，不再等待遥远的将来。
 */

// ─── Constants ────────────────────────────────────────────────────────

/** 每天最多安排子任务数（对应约 2-4 小时深度工作）*/
export const MAX_SUBTASKS_PER_DAY = 3;

/** 同一主题每天最多出现次数（交错学习原则）*/
export const MAX_SAME_TOPIC_PER_DAY = 1;

/** 超过此天数的任务间隙，新任务直接插到今天（窗口式排期）*/
export const SCHEDULING_WINDOW_DAYS = 7;

/** 连续学习超过此天数，建议插入复习节点 */
export const REVIEW_INTERVAL_DAYS = 5;

// ─── Bloom's Taxonomy Level ────────────────────────────────────────────

/**
 * Bloom 认知目标分类（2001 修订版）
 * 用于子任务排序和进度评估。
 */
export type BloomLevel = 1 | 2 | 3 | 4 | 5 | 6;

export const BLOOM_LABELS: Record<BloomLevel, string> = {
  1: "记忆",  // Remember — 回忆事实
  2: "理解",  // Understand — 解释概念
  3: "应用",  // Apply — 在新情境中使用
  4: "分析",  // Analyze — 拆解结构
  5: "评估",  // Evaluate — 做出判断
  6: "创造",  // Create — 产出新事物
};

// ─── Core Interfaces ──────────────────────────────────────────────────

export interface ScheduledTask {
  taskId: string;
  startDate: Date;
  totalDays: number;
  priorityScore: number;
  topicCategory: string;
  createdAt: Date;
}

export interface TaskPriority {
  taskId: string;
  urgencyScore: number;       // 1-5，5=最紧迫
  importanceScore: number;    // 1-5，5=最重要
  originalStartDate?: Date;
  topicCategory: string;
  totalDays: number;
  bloomLevel?: BloomLevel;    // 整体任务的 Bloom 层级（由 AI 评估）
}

/** 每日排期状态，用于全局窗口分配 */
export interface DailySlot {
  date: string;               // "YYYY-MM-DD"
  subtaskCount: number;       // 当天已分配子任务总数
  topicCounts: Map<string, number>;  // 主题 → 当天出现次数
}

// ─── 1. 接续排期：计算新任务起始日期 ────────────────────────────────────

/**
 * 计算新任务的 startDate。
 *
 * 策略：
 * - 找到所有活跃任务的最末结束日
 * - 新任务从其 +1 天开始
 * - 若最末结束日距今超过 SCHEDULING_WINDOW_DAYS，则直接从今天开始
 *   （防止新任务被排到遥远的未来）
 */
export function computeNewTaskStartDate(
  existingTasks: ScheduledTask[],
  today: Date,
): Date {
  const activeTasks = existingTasks.filter(
    (t) => t.startDate != null && t.totalDays > 0
  );

  if (activeTasks.length === 0) {
    return today;
  }

  let latestEnd = today;
  for (const t of activeTasks) {
    const end = addDays(t.startDate, t.totalDays);
    if (end > latestEnd) latestEnd = end;
  }

  const daysBeyondToday = diffDays(today, latestEnd);

  // 窗口式排期：若最末日超过今天 7 天以上，直接从今天开始
  if (daysBeyondToday > SCHEDULING_WINDOW_DAYS) {
    return today;
  }

  const next = addDays(latestEnd, 1);
  return next < today ? today : next;
}

// ─── 2. 优先级排序（四象限 + 递延惩罚 + Q2 战略加成）─────────────────────

/**
 * 四象限 × 递延惩罚综合优先级排序。
 *
 * 算法设计：
 * - 基础分 = urgency(1-5) × importance(1-5)  → 最高 25 分
 * - Q2 战略加成：urgency ≤ 2 且 importance ≥ 4 → +5 分
 *   （重要不紧急的任务最容易被忽视，参考 Covey 第二象限理论）
 * - 递延惩罚：每超期 7 天 +8 分（参考 Todoist Smart Schedule 设计）
 */
export function rankTasksByPriority(
  tasks: TaskPriority[],
  today: Date,
): string[] {
  const todayMs = today.getTime();

  const scored = tasks.map((t) => {
    const quadrantScore = t.urgencyScore * t.importanceScore;

    // Q2 战略加成：重要但不紧急的任务容易被拖延，给予提前奖励
    const q2Bonus =
      t.urgencyScore <= 2 && t.importanceScore >= 4 ? 5 : 0;

    // 递延惩罚
    let delayBonus = 0;
    if (t.originalStartDate) {
      const daysOverdue = Math.floor(
        (todayMs - t.originalStartDate.getTime()) / 86400000
      );
      if (daysOverdue > 0) {
        delayBonus = Math.floor(daysOverdue / 7) * 8;
      }
    }

    const finalScore = quadrantScore + q2Bonus + delayBonus;
    return { taskId: t.taskId, finalScore };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored.map((s) => s.taskId);
}

// ─── 3. 每日容量检查（Deep Work Budget + 交错主题）──────────────────────

/**
 * 检查某一天是否还有子任务槽位（未达到 MAX_SUBTASKS_PER_DAY）
 */
export function hasDailyCapacity(
  dateStr: string,
  slots: Map<string, DailySlot>,
): boolean {
  const slot = slots.get(dateStr);
  if (!slot) return true;
  return slot.subtaskCount < MAX_SUBTASKS_PER_DAY;
}

/**
 * 检查某主题在某天是否还可以安排（未超过 MAX_SAME_TOPIC_PER_DAY）
 *
 * 交错学习原则：同一主题每天最多 1 次，强制不同主题交替出现。
 * 研究依据：Kornell & Bjork (2008) 发现交错练习比集中练习
 * 在长期测试中平均提升 43% 的记忆保留率。
 */
export function canScheduleTopic(
  dateStr: string,
  topicCategory: string,
  slots: Map<string, DailySlot>,
): boolean {
  const slot = slots.get(dateStr);
  if (!slot) return true;
  const count = slot.topicCounts.get(topicCategory) ?? 0;
  return count < MAX_SAME_TOPIC_PER_DAY;
}

/**
 * 向 DailySlot 注册一个子任务占位
 */
export function registerDailySlot(
  dateStr: string,
  topicCategory: string,
  slots: Map<string, DailySlot>,
): void {
  if (!slots.has(dateStr)) {
    slots.set(dateStr, { date: dateStr, subtaskCount: 0, topicCounts: new Map() });
  }
  const slot = slots.get(dateStr)!;
  slot.subtaskCount += 1;
  slot.topicCounts.set(
    topicCategory,
    (slot.topicCounts.get(topicCategory) ?? 0) + 1
  );
}

/**
 * 为一个子任务寻找满足容量 + 主题约束的最早可用日期。
 *
 * @param earliestStart  最早可以开始的日期（大任务 startDate）
 * @param topicCategory  子任务主题
 * @param slots          当前每日槽位状态
 * @param maxSearchDays  最大搜索天数（防止死循环）
 */
export function findNextAvailableDay(
  earliestStart: Date,
  topicCategory: string,
  slots: Map<string, DailySlot>,
  maxSearchDays = 60,
): Date {
  let candidate = earliestStart;
  for (let i = 0; i < maxSearchDays; i++) {
    const dateStr = toDateStr(candidate);
    if (
      hasDailyCapacity(dateStr, slots) &&
      canScheduleTopic(dateStr, topicCategory, slots)
    ) {
      return candidate;
    }
    candidate = addDays(candidate, 1);
  }
  // fallback：超出搜索范围则直接使用最早日期
  return earliestStart;
}

// ─── 4. Bloom 序列验证 ──────────────────────────────────────────────────

/**
 * 验证子任务序列的 Bloom 层级是否整体呈上升趋势。
 *
 * 脚手架学习理论（Vygotsky ZPD）要求：
 * 任务应从低认知负荷（记忆/理解）逐步过渡到高认知负荷（分析/创造）。
 * 允许适当回落（如复盘子任务），但总体趋势应是上升的。
 *
 * @returns true = 顺序合理，false = 存在跳跃或倒序问题
 */
export function validateBloomSequence(
  bloomLevels: BloomLevel[],
): boolean {
  if (bloomLevels.length < 2) return true;

  let maxSeen = 0;
  let violations = 0;

  for (const level of bloomLevels) {
    if (level < maxSeen - 2) {
      // 允许小幅回落（复盘），但不能大幅倒退
      violations++;
    }
    maxSeen = Math.max(maxSeen, level);
  }

  // 超过 30% 的节点违规则认为序列不合理
  return violations / bloomLevels.length < 0.3;
}

/**
 * 根据子任务列表建议需要在哪些节点插入复习（spaced repetition 思路）。
 *
 * 参考 SuperMemo SM-2 算法：第 1 次复习在 1 天后，第 2 次在 5 天后，
 * 后续按 1 → 5 → REVIEW_INTERVAL_DAYS 间隔递增。
 * 此处简化：每学习 REVIEW_INTERVAL_DAYS 天的内容后，
 * 建议在该段结束时加入一个复习子任务。
 *
 * @returns 建议插入复习节点的 startDay 列表
 */
export function suggestReviewNodes(
  subtasks: Array<{ startDay: number; durationDays: number }>,
): number[] {
  const reviewPoints: number[] = [];
  let lastReviewDay = 0;

  for (const s of subtasks) {
    const endDay = s.startDay + s.durationDays;
    if (endDay - lastReviewDay >= REVIEW_INTERVAL_DAYS) {
      reviewPoints.push(endDay);
      lastReviewDay = endDay;
    }
  }

  return reviewPoints;
}

// ─── 5. 工期合理性评估 ─────────────────────────────────────────────────

/**
 * 评估单个子任务的工期是否合理。
 *
 * 根据认知负荷理论（Sweller, 1988）和深度工作研究（Newport, 2016）：
 * - 单个学习子任务最适合 1-3 天（每天 1-2 小时深度学习）
 * - 超过 7 天的子任务应拆分（工作记忆无法在长时间内维持激活状态）
 * - 低于 1 天可能过于碎片化，不利于深度理解
 *
 * @returns { ok, suggestion } ok=true 表示合理
 */
export function assessTaskDuration(
  durationDays: number,
  bloomLevel: BloomLevel = 3,
): { ok: boolean; suggestion?: string } {
  // 高层级 Bloom 任务（分析/评估/创造）需要更多时间
  const maxRecommended = bloomLevel >= 4 ? 7 : 5;
  const minRecommended = 1;

  if (durationDays < minRecommended) {
    return {
      ok: false,
      suggestion: `工期 ${durationDays} 天可能太短，建议至少 1 天确保深度理解`,
    };
  }
  if (durationDays > maxRecommended) {
    return {
      ok: false,
      suggestion: `工期 ${durationDays} 天过长，建议拆分为 ${Math.ceil(durationDays / 2)} 天的子步骤`,
    };
  }
  return { ok: true };
}

// ─── Utilities ────────────────────────────────────────────────────────

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayMidnight(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 计算两个日期相差天数（b - a，可为负） */
export function diffDays(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

// ─── Backward-compatible exports（保持旧调用签名可用）──────────────────

/** @deprecated 使用 registerDailySlot 代替 */
export function checkTopicConflict(
  dateStr: string,
  topicCategory: string,
  dailyTopicMap: Map<string, Map<string, number>>,
): boolean {
  const dayMap = dailyTopicMap.get(dateStr);
  if (!dayMap) return false;
  return (dayMap.get(topicCategory) ?? 0) >= MAX_SAME_TOPIC_PER_DAY;
}

/** @deprecated 使用 registerDailySlot 代替 */
export function registerTopicUsage(
  dateStr: string,
  topicCategory: string,
  dailyTopicMap: Map<string, Map<string, number>>,
): void {
  if (!dailyTopicMap.has(dateStr)) dailyTopicMap.set(dateStr, new Map());
  const dayMap = dailyTopicMap.get(dateStr)!;
  dayMap.set(topicCategory, (dayMap.get(topicCategory) ?? 0) + 1);
}
```

---

## 19. src/app/api/tasks/[id]/analyze/route.ts

见项目源文件（564行，包含 INTENT_PROMPT / RESOURCE_PROMPT / PLAN_PROMPT / VALIDATE_PROMPT 四大 Prompt 及完整 Pipeline 实现）。该文件已在前置章节完整读取并确认，这里给出文件头部标志性内容以便定位：

```typescript
// 文件路径：src/app/api/tasks/[id]/analyze/route.ts
// 行数：564 行
// 关键 export：POST handler（SSE 流式响应）
// 包含的 4 个 Prompt 常量：INTENT_PROMPT / RESOURCE_PROMPT / PLAN_PROMPT / VALIDATE_PROMPT
// 已在 reproduce.md 第四部分 §4.17 完整展示各 Prompt 内容
```

完整源码见 reproduce.md 第四部分 §4.17，或直接查看项目文件。


---

## 19-FULL. src/app/api/tasks/[id]/analyze/route.ts (完整564行)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi } from "@/lib/eazo-ai-billing";
import {
  getTaskById,
  createSubtasks,
  updateTaskTotalDays,
  updateTaskStatus,
  updateTaskTitleAndRawInput,
  updateTaskStartDate,
  getScheduledTasksByUser,
} from "@/lib/db/queries";
import {
  computeNewTaskStartDate,
  todayMidnight,
  registerDailySlot,
  findNextAvailableDay,
  validateBloomSequence,
  suggestReviewNodes,
  type ScheduledTask,
  type BloomLevel,
  type DailySlot,
} from "@/lib/scheduler";

// ─── Resource type ────────────────────────────────────────────────────
interface Resource {
  type: "link" | "search" | "person" | "course";
  title: string;
  url?: string;
  searchQuery?: string;
  author?: string;
  platform?: string;
}

// ─── Stage 1: Intent Analysis ──────────────────────────────────────────
// 理论依据：
// - Vygotsky ZPD 理论：先评估先备知识，才能设定合适的学习起点
// - Bloom 认知分类法：明确最终目标层级，反向设计学习路径
// - 学习目标类型区分：技能型/知识型/项目型需要不同的练习结构
const INTENT_PROMPT = `你是一名专业学习规划顾问，擅长应用教育心理学理论分析学习目标。
请分析用户输入的学习目标，提取以下信息并以 JSON 格式回复（不要加 markdown 代码块）：

{
  "task_name": "正式任务名称，不超过 16 字，动宾结构（如：掌握Python基础/攻克高考数学）",
  "topic_category": "主题类别（仅选一个）：数学 / 编程 / 语言 / 科学 / 艺术 / 商业 / 历史 / 健身 / 其他",
  "urgency": 3,
  "importance": 4,
  "prior_knowledge_level": "beginner",
  "learning_goal_type": "skill",
  "bloom_target_level": 3,
  "estimated_total_hours": 20,
  "search_keywords": ["关键词1", "关键词2", "关键词3"],
  "subject_domain": "具体领域，如：高中数学/Python入门/英语口语/投资理财（2-8字）"
}

字段说明：
- urgency/importance：1-5 整数，根据学习场景合理判断（备考=高urgency，兴趣探索=低urgency）
- prior_knowledge_level：评估学习者可能的基础
  * beginner：完全零基础，需要从头开始
  * intermediate：有一定了解，可跳过入门直接进阶
  * advanced：已有较深基础，目标是专项提升
- learning_goal_type：
  * skill：需要反复练习才能掌握（编程/乐器/语言口语）
  * knowledge：以理解和记忆为主（历史/理论/概念）
  * project：以完成具体产出为目标（写论文/做项目/准备考试）
- bloom_target_level：该目标在 Bloom 认知分类法中的目标层级
  * 1=记忆（背诵）2=理解（解释）3=应用（使用）4=分析（检验）5=评估（判断）6=创造（设计）
- estimated_total_hours：完成该目标预计需要的总小时数（15-200小时范围）
- search_keywords：3-5个最能代表该主题的中英文搜索词`;

// ─── Stage 2: Resource Search ────────────────────────────────────────
// 升级点：区分资源适合的先备知识层级和学习阶段（input/practice/reference）
const RESOURCE_PROMPT = `你是一名资深学习顾问，擅长为不同基础的学习者匹配最合适的学习资源。

学习目标：{GOAL}
主题领域：{DOMAIN}
学习者基础：{PRIOR_LEVEL}
搜索关键词：{KEYWORDS}

请以 JSON 格式回复，推荐 5-8 个资源（不要加 markdown 代码块）：

{
  "resources": [
    {
      "type": "course",
      "title": "课程名称",
      "platform": "Coursera/edX/B站/慕课网/网易公开课等",
      "author": "讲师名",
      "searchQuery": "搜索此课程的关键词",
      "suitable_for": "beginner",
      "learning_phase": "input"
    },
    {
      "type": "link",
      "title": "资源标题",
      "url": "https://真实链接（确认存在才给，否则省略）",
      "platform": "平台名",
      "suitable_for": "intermediate",
      "learning_phase": "reference"
    },
    {
      "type": "search",
      "title": "搜索推荐：具体描述",
      "searchQuery": "可直接复制到搜索引擎的精准搜索词",
      "suitable_for": "beginner",
      "learning_phase": "practice"
    },
    {
      "type": "person",
      "title": "推荐关注的学习博主/老师",
      "author": "具体人名",
      "platform": "B站/YouTube/公众号等",
      "searchQuery": "在该平台搜索此人的关键词",
      "suitable_for": "all",
      "learning_phase": "input"
    }
  ]
}

字段说明：
- suitable_for：beginner / intermediate / advanced / all
- learning_phase：input（学习新知识）/ practice（练习巩固）/ reference（查阅参考）

资源推荐原则：
- 优先推荐中文资源，适当补充英文权威资源
- 只给确认存在的链接，否则给searchQuery，绝对不编造URL
- 根据学习者基础（{PRIOR_LEVEL}）优先推荐适合其水平的资源
- 至少覆盖 input + practice 两个阶段`;

// ─── Stage 3: Task Planning ───────────────────────────────────────────
// 理论依据：
// - Bloom 认知分类法（Bloom, 1956 / 修订版 Anderson & Krathwohl, 2001）：
//   子任务必须从低认知层级渐进到高层级（记忆→理解→应用→分析）
// - Worked Example Effect（Sweller & Cooper, 1985）：
//   入门阶段先给范例，减少认知负荷，再逐步撤除脚手架
// - 认知负荷理论（Sweller, 1988）：
//   单任务工期限制在 1-5 天，防止工作记忆过载
// - Deep Work（Newport, 2016）：
//   每天专注学习时长约 1.5-3 小时，超出则效率递减
const PLAN_PROMPT = `你是一名专业学习计划设计师，精通 Bloom 认知分类法、脚手架学习理论和认知负荷理论。
请根据以下信息，为学习者设计一个科学、可执行的学习计划。

学习目标：{GOAL}
正式任务名：{TASK_NAME}
主题领域：{DOMAIN}
学习者基础：{PRIOR_LEVEL}
整体 Bloom 目标层级：{BLOOM_TARGET}（1=记忆→6=创造）
预计总学习时长：{TOTAL_HOURS} 小时
可用资源清单（JSON）：{RESOURCES}
调整要求（如有）：{ADJUSTMENT}

请以 JSON 格式制定学习计划（不要加 markdown 代码块）：

{
  "subtasks": [
    {
      "title": "子任务标题（不超过20字，动宾结构）",
      "description": "具体说明：做什么 + 怎么做 + 用哪个资源（不超过80字）",
      "duration_days": 2,
      "start_day": 0,
      "priority": 1,
      "bloom_level": 2,
      "deep_work_hours": 1.5,
      "learning_method": "worked_example",
      "resource_indices": [0, 2]
    }
  ]
}

子任务设计规则（严格遵守）：

1. 数量：5-8个子任务，beginner基础建议7-8个，advanced可以5-6个

2. Bloom层级渐进（最重要）：
   - 第1-2个子任务：bloom_level 必须为 1 或 2（记忆/理解）
   - 中间子任务：bloom_level 逐步升至 3-4（应用/分析）
   - 最后1-2个子任务：bloom_level 为 3-5，含实践或复盘
   - 相邻子任务 bloom_level 差值不超过 2 级

3. 工期约束（认知负荷理论）：
   - 每个子任务 duration_days 限定为 1-5 天
   - 基础概念类（bloom_level 1-2）：1-2 天
   - 技能练习类（bloom_level 3）：2-3 天
   - 综合应用类（bloom_level 4-5）：3-5 天

4. 学习方法标注（learning_method）：
   - worked_example：先看范例再模仿（适合入门）
   - guided_practice：跟着教程边学边做（适合技能类）
   - independent_practice：独立完成任务（适合巩固）
   - project：完成完整的小产出（适合应用阶段）
   - review：系统复习已学内容（适合阶段总结）

5. 起始日计算：start_day = 前面所有子任务的 duration_days 之和，第一个必须为 0

6. 资源绑定：resource_indices 对应资源清单索引（从0开始），每个子任务至少引用 1 个

7. deep_work_hours：每天需要的深度专注时长（0.5-3小时），认知密集任务建议 1.5-2.5 小时

8. description 写法示例：
   ✅ "在B站搜索'廖雪峰Python教程'，完成第1-3章，手打所有代码示例"
   ❌ "学习基础知识"（太模糊）`;

// ─── Stage 4: Validation ─────────────────────────────────────────────
// 升级点：五维评分，Bloom连贯性+认知负荷+可执行性+资源覆盖+逻辑性
const VALIDATE_PROMPT = `你是一名教育心理学专家，请基于科学标准审核这个学习计划。

学习目标：{GOAL}
学习者基础：{PRIOR_LEVEL}
学习计划（JSON）：{PLAN}

请以 JSON 格式回复审核结果（不要加 markdown 代码块）：
{
  "pass": true,
  "score": 85,
  "issues": [
    {"type": "bloom_jump", "detail": "第3个子任务bloom_level从2直接跳到5，超出建议范围"},
    {"type": "duration_too_long", "detail": "子任务工期6天对beginner过重，建议拆分"}
  ],
  "suggestions": "若 pass=false，给出具体可操作的修改建议（1-3条）",
  "strengths": "计划的1-2个优点"
}

五维审核标准（每条满分20分）：

① Bloom层级连贯性（20分）
   - 层级是否从低到高渐进？相邻差值是否 ≤ 2？
   - 首个子任务是否为记忆/理解（bloom_level 1-2）？
   - 末个子任务是否含实践/复盘（bloom_level ≥ 3）？

② 认知负荷合理性（20分）
   - 每个子任务 duration_days 是否在 1-5 天内？
   - deep_work_hours 是否不超过 3 小时？
   - 总天数是否在 7-30 天内？

③ 可执行性（20分）
   - description 是否具体到"知道该去哪里、做什么"？
   - 每个子任务是否引用了至少 1 个资源？
   - learning_method 是否与子任务内容匹配？

④ 资源覆盖完整性（20分）
   - 是否覆盖 input + practice 两个阶段？
   - 资源是否适合学习者基础（{PRIOR_LEVEL}）？

⑤ 先后逻辑性（20分）
   - 是否先理论后实践？是否先易后难？
   - 最后是否有总结/输出环节？

通过标准：总分 ≥ 75 且无严重问题（bloom跳跃>2级 或 单任务工期>7天）则 pass=true`;

// ─── Helpers ─────────────────────────────────────────────────────────

async function callAI(
  systemPrompt: string,
  userMessage: string,
  onDelta?: (delta: string) => void
): Promise<string> {
  const stream = await appAi.chat({
    model: process.env.EAZO_AI_MODEL_KEY || "deepseek.v3.2",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    stream: true,
    max_tokens: 2500,
  });

  let accumulated = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) {
      accumulated += delta;
      onDelta?.(delta);
    }
  }
  return accumulated;
}

function parseJson<T>(text: string): T | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

// ─── Main Route ───────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const task = await getTaskById(id);
  if (!task || task.userId !== auth.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let adjustment = "";
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (typeof body.adjustment === "string") adjustment = body.adjustment.trim();
  } catch { /* ignore */ }

  const rawGoal = task.rawInput || task.title;
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`)
          );
        } catch { /* stream closed */ }
      };

      try {
        // ── Stage 1: Intent ───────────────────────────────────────────
        send("phase", { step: "intent", label: "// 阶段 1/4 · 评估先备知识与学习目标层级…" });

        const intentRaw = await callAI(
          INTENT_PROMPT,
          rawGoal + (adjustment ? `\n调整要求：${adjustment}` : ""),
          (d) => send("delta", { stage: "intent", content: d })
        );

        interface IntentResult {
          task_name?: string;
          topic_category?: string;
          urgency?: number;
          importance?: number;
          prior_knowledge_level?: string;
          learning_goal_type?: string;
          bloom_target_level?: number;
          estimated_total_hours?: number;
          search_keywords?: string[];
          subject_domain?: string;
        }
        const intent = parseJson<IntentResult>(intentRaw);
        const taskName = intent?.task_name?.trim() || task.title;
        const domain = intent?.subject_domain || rawGoal;
        const keywords = intent?.search_keywords?.join("、") || rawGoal;
        const topicCategory = intent?.topic_category || "其他";
        const urgencyScore = intent?.urgency ?? 3;
        const importanceScore = intent?.importance ?? 3;
        const keywordsArr = intent?.search_keywords ?? [];
        const priorLevel = intent?.prior_knowledge_level || "beginner";
        const bloomTarget = intent?.bloom_target_level ?? 3;
        const estimatedHours = intent?.estimated_total_hours ?? 20;

        send("intent_done", { taskName, domain, topicCategory, priorLevel, bloomTarget });

        // ── Stage 2: Resources ────────────────────────────────────────
        send("phase", { step: "search", label: "// 阶段 2/4 · 匹配适合您基础的学习资源…" });

        const resourceRaw = await callAI(
          "你是资深学习资源顾问，请以 JSON 格式精确回复，不要加 markdown 代码块。",
          RESOURCE_PROMPT
            .replace("{GOAL}", rawGoal)
            .replace("{DOMAIN}", domain)
            .replace(/{PRIOR_LEVEL}/g, priorLevel)
            .replace("{KEYWORDS}", keywords),
          (d) => send("delta", { stage: "search", content: d })
        );

        interface ResourceResult { resources?: Resource[] }
        const resources: Resource[] = parseJson<ResourceResult>(resourceRaw)?.resources ?? [];
        send("search_done", { resourceCount: resources.length });

        // ── Stage 3: Plan ─────────────────────────────────────────────
        send("phase", { step: "plan", label: "// 阶段 3/4 · 按 Bloom 认知层级设计学习路径…" });

        const planRaw = await callAI(
          "你是学习计划设计专家，精通Bloom认知分类法和认知负荷理论，请以 JSON 格式精确回复，不要加 markdown 代码块。",
          PLAN_PROMPT
            .replace("{GOAL}", rawGoal)
            .replace("{TASK_NAME}", taskName)
            .replace("{DOMAIN}", domain)
            .replace(/{PRIOR_LEVEL}/g, priorLevel)
            .replace("{BLOOM_TARGET}", String(bloomTarget))
            .replace("{TOTAL_HOURS}", String(estimatedHours))
            .replace("{RESOURCES}", JSON.stringify(resources.map((r, i) => ({ index: i, ...r }))))
            .replace("{ADJUSTMENT}", adjustment || "无"),
          (d) => send("delta", { stage: "plan", content: d })
        );

        interface PlanSubtask {
          title: string;
          description: string;
          duration_days: number;
          start_day: number;
          priority?: number;
          bloom_level?: number;
          deep_work_hours?: number;
          learning_method?: string;
          resource_indices?: number[];
        }
        interface PlanResult { subtasks?: PlanSubtask[] }
        const plan = parseJson<PlanResult>(planRaw);
        if (!plan?.subtasks?.length) throw new Error("AI 未生成有效计划");

        // ── Stage 4: Validate ─────────────────────────────────────────
        send("phase", { step: "validate", label: "// 阶段 4/4 · 五维校验（Bloom连贯性/认知负荷/可执行性…）" });

        const validateRaw = await callAI(
          "你是教育心理学专家，请以 JSON 格式精确回复，不要加 markdown 代码块。",
          VALIDATE_PROMPT
            .replace("{GOAL}", rawGoal)
            .replace(/{PRIOR_LEVEL}/g, priorLevel)
            .replace("{PLAN}", JSON.stringify(plan.subtasks))
        );

        interface ValidateResult { pass?: boolean; score?: number; suggestions?: string }
        const validation = parseJson<ValidateResult>(validateRaw);

        // 本地 Bloom 序列验证（双重保障）
        const bloomLevels = plan.subtasks
          .map((s) => (s.bloom_level ?? 2) as BloomLevel)
          .filter((l) => l >= 1 && l <= 6);
        const bloomOk = validateBloomSequence(bloomLevels);

        let finalPlan = plan;
        const needsRevision =
          (validation?.pass === false && !!validation?.suggestions) || !bloomOk;

        if (needsRevision) {
          const revisionNote = !bloomOk
            ? "Bloom层级跳跃：请确保层级从1-2渐进到3-4，相邻差不超过2级。"
            : (validation?.suggestions ?? "");

          send("phase", { step: "revise", label: "// 核查未通过，修正 Bloom 路径设计…" });
          const revisedRaw = await callAI(
            "你是学习计划设计专家，精通Bloom认知分类法，请以 JSON 格式精确回复，不要加 markdown 代码块。",
            PLAN_PROMPT
              .replace("{GOAL}", rawGoal)
              .replace("{TASK_NAME}", taskName)
              .replace("{DOMAIN}", domain)
              .replace(/{PRIOR_LEVEL}/g, priorLevel)
              .replace("{BLOOM_TARGET}", String(bloomTarget))
              .replace("{TOTAL_HOURS}", String(estimatedHours))
              .replace("{RESOURCES}", JSON.stringify(resources.map((r, i) => ({ index: i, ...r }))))
              .replace("{ADJUSTMENT}", adjustment || "无")
            + `\n\n审核意见（请按此修正）：${revisionNote}`,
            (d) => send("delta", { stage: "revise", content: d })
          );
          const revised = parseJson<PlanResult>(revisedRaw);
          if (revised?.subtasks?.length) finalPlan = revised;
        }

        // ── DB Write + 交错排期 ───────────────────────────────────────
        send("phase", { step: "saving", label: "// 写入数据库 · 交错主题排期计算…" });

        const rawInput = task.rawInput || task.title;
        await updateTaskTitleAndRawInput(id, taskName, rawInput);

        // 全局接续排期（窗口式：超过7天间隙则从今天开始）
        const existingSchedule = await getScheduledTasksByUser(auth.user.id);
        const today = todayMidnight();
        const otherTasks: ScheduledTask[] = existingSchedule
          .filter((t) => t.taskId !== id && t.status !== "done" && t.startDate != null)
          .map((t) => ({
            taskId: t.taskId,
            startDate: t.startDate!,
            totalDays: Math.max(t.totalDays, 1),
            priorityScore: 3,
            topicCategory,
            createdAt: t.createdAt,
          }));

        const newStartDate = computeNewTaskStartDate(otherTasks, today);
        await updateTaskStartDate(id, newStartDate);

        // 按 Bloom 层级渐进排序（同层级按 priority 排）
        const sorted = [...finalPlan.subtasks!].sort((a, b) => {
          const bloomA = a.bloom_level ?? 2;
          const bloomB = b.bloom_level ?? 2;
          if (bloomA !== bloomB) return bloomA - bloomB;
          return (a.priority ?? 3) - (b.priority ?? 3);
        });

        // 建立每日槽位（交错学习约束）
        const dailySlots = new Map<string, DailySlot>();
        let cumulativeDay = 0;

        const subtaskItems = sorted.map((s, i) => {
          // 找满足每日容量 + 主题约束的最早可用日期
          const earliestDate = new Date(newStartDate);
          earliestDate.setDate(newStartDate.getDate() + cumulativeDay);

          const actualDate = findNextAvailableDay(earliestDate, topicCategory, dailySlots);
          const actualStartDay = Math.round(
            (actualDate.getTime() - newStartDate.getTime()) / 86400000
          );

          registerDailySlot(actualDate.toISOString().slice(0, 10), topicCategory, dailySlots);
          cumulativeDay = actualStartDay + s.duration_days;

          const subtaskResources: Resource[] = (s.resource_indices ?? [])
            .map((idx: number) => resources[idx])
            .filter(Boolean);

          return {
            title: s.title,
            description: s.description,
            durationDays: Math.min(Math.max(s.duration_days, 1), 7),
            startDay: actualStartDay,
            sortOrder: i,
            resources: subtaskResources.length > 0 ? JSON.stringify(subtaskResources) : null,
            topic: topicCategory,
            urgency: urgencyScore,
            importance: importanceScore,
            keywords: keywordsArr.length > 0 ? JSON.stringify(keywordsArr) : null,
          };
        });

        // 建议复习节点（Spaced Repetition 思路）
        const reviewNodes = suggestReviewNodes(
          subtaskItems.map((s) => ({ startDay: s.startDay, durationDays: s.durationDays }))
        );

        const saved = await createSubtasks(id, subtaskItems);
        const totalDays = saved.reduce(
          (max, s) => Math.max(max, s.startDay + s.durationDays), 0
        );
        await updateTaskTotalDays(id, totalDays);
        await updateTaskStatus(id, "done");

        send("phase", { step: "done", label: "// 全部完成 ✓" });
        send("result", {
          subtasks: saved,
          totalDays,
          taskName,
          rawInput,
          startDate: newStartDate.toISOString(),
          topicCategory,
          priorLevel,
          bloomTarget,
          reviewNodes,
        });

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("[AutoTask] analyze pipeline error:", errMsg);
        send("error", { message: errMsg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
```

---

## 20. src/components/home/home-page.tsx

```typescript
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
import { RightPanel, useAnalysisPanel } from "./right-panel";
import { NewTaskInput } from "./new-task-input";
import { SubtaskRow, getSubtaskActualDates } from "./subtask-row";
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

type TimeFilter = "today" | "tomorrow" | "week" | "all";

// ─── Main Dashboard ───────────────────────────────────────────────────

export function HomePage() {
  const router = useRouter();
  const user = useEazo((s) => s.auth.user);
  const authLoading = useEazo((s) => s.auth.loading);

  const [subtaskRows, setSubtaskRows] = useState<SubtaskWithTask[]>([]);
  const [fetching, setFetching] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [showInput, setShowInput] = useState(false);
  const [detailSubtask, setDetailSubtask] = useState<SubtaskWithTask | null>(null);
  const [congrats, setCongrats] = useState<CongratsData | null>(null);
  const [highlightedSubtaskId, setHighlightedSubtaskId] = useState<string | null>(null);
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
    subtaskId: string, taskStartDate: string | null, startDay: number, durationDays: number,
  ) => {
    if (!taskStartDate) return;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86400000);
    const base = new Date(taskStartDate);
    if (isNaN(base.getTime())) return;
    const baseDay = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const s = new Date(baseDay); s.setDate(baseDay.getDate() + startDay);
    const e = new Date(baseDay); e.setDate(baseDay.getDate() + startDay + durationDays - 1);
    let target: TimeFilter = "all";
    if (s <= today && today <= e) target = "today";
    else if (s <= tomorrow && tomorrow <= e) target = "tomorrow";
    else { const we = new Date(today.getTime() + 7 * 86400000); if (s <= we && e >= today) target = "week"; }
    setTimeFilter(target);
    setHighlightedSubtaskId(subtaskId);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedSubtaskId(null), 3000);
  }, []);

  const filteredRows = sortSubtasks(filterSubtasksByTime(subtaskRows, timeFilter));
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: `1px solid ${T.line}`, overflow: "hidden" }}>
          <div style={{ padding: "10px 20px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 8, background: T.surface, flexShrink: 0 }}>
            <TimeFilterTabs value={timeFilter} onChange={setTimeFilter} />
            <div style={{ flex: 1 }} />
            <span style={{ color: T.muted, fontSize: 12, fontFamily: "var(--font-geist-mono), monospace" }}>共 {filteredRows.length} 项</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {authLoading || fetching ? (
              <div style={{ color: T.muted, fontSize: 13, padding: "40px 24px", textAlign: "center" }}>加载中…</div>
            ) : !user ? (
              <div style={{ color: T.muted, fontSize: 13, padding: "60px 24px", textAlign: "center" }}>
                <div style={{ marginBottom: 12 }}>登录后可查看和管理任务</div>
                <button onClick={() => auth.login().catch(() => {})} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer" }}>登录</button>
              </div>
            ) : filteredRows.length === 0 ? (
              <div style={{ color: T.muted, fontSize: 13, padding: "60px 24px", textAlign: "center" }}>当前筛选下暂无任务，点击右上角新建。</div>
            ) : (
              filteredRows.map((row) => (
                <SubtaskRow key={row.id} row={row}
                  isSelected={focusedId === row.taskId}
                  isHighlighted={highlightedSubtaskId === row.id}
                  onOpen={() => setDetailSubtask(row)}
                  onSelect={() => { setFocusedId(row.taskId); focusTask(row.taskId); }}
                  onDeleteTask={handleDeleteTask}
                  onToggle={(e) => { e.stopPropagation(); handleToggleSubtask(row.taskId, row.id, row.completed); }}
                />
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

// ─── Time Filter Tabs ─────────────────────────────────────────────────

function TimeFilterTabs({ value, onChange }: { value: TimeFilter; onChange: (v: TimeFilter) => void }) {
  const tabs: { key: TimeFilter; label: string }[] = [
    { key: "today", label: "今天" },
    { key: "tomorrow", label: "明天" },
    { key: "week", label: "未来 7 天" },
    { key: "all", label: "全部" },
  ];
  return (
    <div style={{ display: "flex", gap: 2, background: T.soft, borderRadius: 8, padding: 3 }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 13, cursor: "pointer",
            background: value === t.key ? T.surface : "transparent",
            color: value === t.key ? T.ink : T.muted,
            fontWeight: value === t.key ? 600 : 400,
            boxShadow: value === t.key ? "0 1px 4px rgba(17,17,17,0.07)" : "none",
            transition: "all 0.15s", letterSpacing: "-0.01em",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function sortSubtasks(rows: SubtaskWithTask[]): SubtaskWithTask[] {
  return [...rows].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.sortOrder - b.sortOrder;
  });
}

function filterSubtasksByTime(rows: SubtaskWithTask[], filter: TimeFilter): SubtaskWithTask[] {
  if (filter === "all") return rows;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const weekEnd = new Date(today.getTime() + 7 * 86400000);
  return rows.filter((r) => {
    const dates = getSubtaskActualDates(r);
    if (!dates) {
      const d = new Date(r.taskCreatedAt);
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (filter === "today")    return day.getTime() === today.getTime();
      if (filter === "tomorrow") return day.getTime() === tomorrow.getTime();
      if (filter === "week")     return day >= today && day <= weekEnd;
      return true;
    }
    const { start, end } = dates;
    if (filter === "today")    return start <= today    && today    <= end;
    if (filter === "tomorrow") return start <= tomorrow && tomorrow <= end;
    if (filter === "week")     return start <= weekEnd  && end      >= today;
    return true;
  });
}



```

---

## 21. src/components/home/right-panel.tsx

```typescript
"use client";

import { useState, useRef, useCallback } from "react";
import { request } from "@/lib/api/request";
import { AppAIClientUnavailableError } from "@/lib/api/app-ai-request";
import { createTask, getTask } from "@/lib/api/tasks";
import type { TaskWithSubtasks } from "@/lib/api/tasks";
import { memory } from "@eazo/sdk";

const T = {
  surface: "#FFFFFF", soft: "#F1F2EE", line: "#E7E7E2",
  ink: "#111111", muted: "#777B75", accent: "#3B7AFF",
  green: "#2F5D50", paper: "#F4F1EA", error: "#C0392B",
  orange: "#E07B2A", purple: "#7C4DFF",
} as const;

export interface Resource {
  type: "link" | "search" | "person" | "course";
  title: string;
  url?: string;
  searchQuery?: string;
  author?: string;
  platform?: string;
}

type Phase = "idle"|"intent"|"search"|"plan"|"validate"|"revise"|"saving"|"done"|"error";
interface StreamState { phase: Phase; label: string; deltaLen: number; errorMsg: string; }
const INIT_STREAM: StreamState = { phase: "idle", label: "", deltaLen: 0, errorMsg: "" };

const PIPELINE_STEPS: Array<{ key: Phase; label: string; icon: string }> = [
  { key: "intent",   label: "解析学习意图", icon: "🧠" },
  { key: "search",   label: "搜索学习资源", icon: "🔍" },
  { key: "plan",     label: "制定学习计划", icon: "📋" },
  { key: "validate", label: "核查可执行性", icon: "✅" },
  { key: "done",     label: "完成",         icon: "🎉" },
];
const PHASE_ORDER: Phase[] = ["idle","intent","search","plan","validate","revise","saving","done"];

export interface AnalysisEntry {
  taskId: string;
  taskTitle: string;
  rawInput: string;
  topicCategory?: string;
  stream: StreamState;
  task: TaskWithSubtasks | null;
}

export function useAnalysisPanel() {
  const [entries, setEntries] = useState<AnalysisEntry[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runStream = useCallback(async (taskId: string, goal: string, adjustment: string, isNew: boolean) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const patchStream = (s: Partial<StreamState>) =>
      setEntries((prev) => prev.map((e) => e.taskId === taskId ? { ...e, stream: { ...e.stream, ...s } } : e));

    patchStream({ phase: "intent", label: "解析学习意图…", deltaLen: 0, errorMsg: "" });

    try {
      const res = await request(`/api/tasks/${taskId}/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adjustment ? { adjustment } : {}), signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6)) as { event: string; data: unknown };
            if (msg.event === "phase") {
              const d = msg.data as { step: string; label?: string };
              patchStream({ phase: d.step as Phase, label: d.label || "" });
            } else if (msg.event === "delta") {
              setEntries((prev) => prev.map((e) => e.taskId === taskId
                ? { ...e, stream: { ...e.stream, deltaLen: e.stream.deltaLen + 1 } } : e));
            } else if (msg.event === "intent_done") {
              const d = msg.data as { taskName?: string; topicCategory?: string };
              setEntries((prev) => prev.map((e) => e.taskId === taskId
                ? { ...e, taskTitle: d.taskName || e.taskTitle, topicCategory: d.topicCategory } : e));
            } else if (msg.event === "result") {
              const d = msg.data as { taskName?: string; rawInput?: string };
              patchStream({ phase: "done" });
              const full = await getTask(taskId).catch(() => null);
              setEntries((prev) => prev.map((e) => e.taskId === taskId
                ? { ...e, task: full, taskTitle: d.taskName || e.taskTitle, rawInput: d.rawInput || e.rawInput } : e));
              if (isNew) memory.reportAction({ content: `Goal analyzed: "${goal}"`, event_type: "create" }).catch(() => {});
            } else if (msg.event === "error") {
              const d = msg.data as { message?: string };
              patchStream({ phase: "error", errorMsg: d.message || "AI 分析失败" });
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (err instanceof AppAIClientUnavailableError) return;
      patchStream({ phase: "error", errorMsg: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const startAnalysis = useCallback(async (goal: string) => {
    if (!goal.trim()) return;
    abortRef.current?.abort();
    const task = await createTask(goal.trim());
    setEntries((prev) => [{ taskId: task.id, taskTitle: goal.trim(), rawInput: goal.trim(), stream: INIT_STREAM, task: null }, ...prev]);
    setFocusedId(task.id);
    await runStream(task.id, goal.trim(), "", true);
  }, [runStream]);

  const regenAnalysis = useCallback((taskId: string, adjustment: string) => {
    abortRef.current?.abort();
    setEntries((prev) => {
      const entry = prev.find((e) => e.taskId === taskId);
      if (entry) { runStream(taskId, entry.rawInput, adjustment, false); }
      return prev.map((e) => e.taskId === taskId ? { ...e, task: null, stream: INIT_STREAM } : e);
    });
    setFocusedId(taskId);
  }, [runStream]);

  const removeEntry = useCallback((taskId: string) => {
    setEntries((prev) => prev.filter((e) => e.taskId !== taskId));
    setFocusedId((prev) => prev === taskId ? null : prev);
  }, []);

  /** 持久化 hydration：从 DB 加载历史任务，合并去重 */
  const hydrateFromDB = useCallback((dbTasks: TaskWithSubtasks[]) => {
    setEntries((prev) => {
      const existingIds = new Set(prev.map((e) => e.taskId));
      const newEntries: AnalysisEntry[] = dbTasks
        .filter((t) => !existingIds.has(t.id) && t.subtasks.length > 0)
        .map((t) => ({
          taskId: t.id,
          taskTitle: t.title,
          rawInput: t.rawInput || t.title,
          topicCategory: (t.subtasks[0] as unknown as { topic?: string })?.topic ?? undefined,
          stream: { phase: "done" as Phase, label: "", deltaLen: 0, errorMsg: "" },
          task: t,
        }));
      if (newEntries.length === 0) return prev;
      return [...prev, ...newEntries];
    });
  }, []);

  /** 聚焦某个任务并切换到它 */
  const focusTask = useCallback((taskId: string) => {
    setFocusedId(taskId);
  }, []);

  return { entries, focusedId, setFocusedId, startAnalysis, regenAnalysis, removeEntry, hydrateFromDB, focusTask };
}

// ─── Pipeline Steps Display ───────────────────────────────────────────

function PipelineSteps({ stream }: { stream: StreamState }) {
  const curIdx = PHASE_ORDER.indexOf(stream.phase);
  const isError = stream.phase === "error";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {PIPELINE_STEPS.map((step, i) => {
        const stepIdx = PHASE_ORDER.indexOf(step.key);
        const isDone = !isError && (curIdx > stepIdx || stream.phase === "done");
        const isActive = stream.phase === step.key || (stream.phase === "revise" && step.key === "validate") || (stream.phase === "saving" && step.key === "validate");
        if (!isDone && !isActive && curIdx < stepIdx) return null;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, background: isActive ? "rgba(59,122,255,0.05)" : "transparent" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, background: isDone ? T.accent : isActive ? "rgba(59,122,255,0.15)" : T.soft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isDone ? 9 : 11, color: isDone ? "#fff" : T.muted, border: isActive ? `2px solid ${T.accent}` : "2px solid transparent", transition: "all 0.3s" }}>
              {isDone ? "✓" : isActive ? <BlinkDot /> : <span style={{ opacity: 0.4 }}>{i + 1}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: isDone ? T.muted : isActive ? T.ink : T.muted, fontSize: 12, fontWeight: isActive ? 600 : 400 }}>{step.icon} {step.label}</div>
              {isActive && stream.label && <div style={{ color: T.accent, fontSize: 9, marginTop: 1, fontFamily: "var(--font-geist-mono), monospace" }}>{stream.label}</div>}
            </div>
            {isActive && stream.deltaLen > 0 && <span style={{ color: T.muted, fontSize: 9, fontFamily: "var(--font-geist-mono), monospace", flexShrink: 0 }}>{stream.deltaLen}t</span>}
          </div>
        );
      })}
      {isError && (
        <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(192,57,43,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: T.error, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", flexShrink: 0 }}>✕</div>
            <span style={{ color: T.error, fontSize: 12, fontWeight: 600 }}>分析失败，请重试</span>
          </div>
          {stream.errorMsg && <div style={{ color: T.muted, fontSize: 10, marginTop: 4, paddingLeft: 28, wordBreak: "break-all", fontFamily: "var(--font-geist-mono), monospace" }}>{stream.errorMsg}</div>}
        </div>
      )}
    </div>
  );
}

function BlinkDot() {
  return <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent, display: "block", animation: "blink 1s steps(2) infinite" }} />;
}

// ─── Resource Card ────────────────────────────────────────────────────

function ResourceCard({ res }: { res: Resource }) {
  const typeColors: Record<string, string> = { link: T.accent, search: T.orange, person: T.purple, course: T.green };
  const typeLabels: Record<string, string> = { link: "🔗 链接", search: "🔎 搜索", person: "👤 老师", course: "📚 课程" };
  const color = typeColors[res.type] ?? T.muted;
  const clickable = !!(res.url || res.searchQuery);
  return (
    <div onClick={clickable ? () => { if (res.url) window.open(res.url, "_blank", "noopener"); else if (res.searchQuery) window.open(`https://www.google.com/search?q=${encodeURIComponent(res.searchQuery)}`, "_blank", "noopener"); } : undefined}
      style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", cursor: clickable ? "pointer" : "default", background: T.surface }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 4, padding: "1px 5px" }}>{typeLabels[res.type] ?? res.type}</span>
        {res.platform && <span style={{ color: T.muted, fontSize: 9 }}>{res.platform}</span>}
      </div>
      <div style={{ color: T.ink, fontSize: 11, fontWeight: 500, lineHeight: 1.4 }}>{res.title}</div>
      {res.author && <div style={{ color: T.muted, fontSize: 10, marginTop: 2 }}>👤 {res.author}</div>}
      {res.searchQuery && !res.url && <div style={{ color: T.muted, fontSize: 10, marginTop: 2, fontFamily: "var(--font-geist-mono), monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>搜：{res.searchQuery}</div>}
    </div>
  );
}

// ─── RightPanel ──────────────────────────────────────────────────────

export interface RightPanelProps {
  entries: AnalysisEntry[];
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
  regenAnalysis: (taskId: string, adjustment: string) => void;
  removeEntry: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string, current: boolean) => void;
  /** 点击子任务 → 跳转到对应日期视图并高亮 */
  onJumpToSubtask?: (subtaskId: string, taskStartDate: string | null, startDay: number, durationDays: number) => void;
}

export function RightPanel({ entries, focusedId, setFocusedId, regenAnalysis, removeEntry, onToggleSubtask, onJumpToSubtask }: RightPanelProps) {
  const focused = entries.find((e) => e.taskId === focusedId) ?? entries[0] ?? null;
  return (
    <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: T.surface, borderLeft: `1px solid ${T.line}` }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
        <div style={{ color: T.ink, fontWeight: 600, fontSize: 14, letterSpacing: "-0.02em" }}>AI 分析面板</div>
        <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>意图→资源→计划→核查 · 全局排期</div>
      </div>
      {entries.length > 1 && (
        <div style={{ display: "flex", gap: 4, padding: "8px 12px", overflowX: "auto", borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          {entries.map((e) => {
            const running = !["idle","done","error"].includes(e.stream.phase);
            return (
              <button key={e.taskId} onClick={() => setFocusedId(e.taskId)} title={e.taskTitle} style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", border: `1px solid ${e.taskId === focusedId ? T.accent : T.line}`, background: e.taskId === focusedId ? "rgba(59,122,255,0.08)" : "transparent", color: e.taskId === focusedId ? T.accent : T.muted, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis" }}>
                {running && <span style={{ animation: "blink 1s steps(2) infinite", marginRight: 3 }}>●</span>}
                {e.taskTitle.slice(0, 8)}{e.taskTitle.length > 8 ? "…" : ""}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {!focused ? <EmptyState /> : <EntryDetail entry={focused} onRegen={regenAnalysis} onRemove={removeEntry} onToggleSubtask={onToggleSubtask} onJumpToSubtask={onJumpToSubtask} />}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 60 }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#A8B5A2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
      <span style={{ color: T.muted, fontSize: 13, textAlign: "center", lineHeight: 1.7 }}>
        点击「+ 新建任务」<br /><span style={{ fontSize: 11 }}>意图分析 → 资源搜索<br />制定计划 → 核查优化</span>
      </span>
    </div>
  );
}

function EntryDetail({ entry, onRegen, onRemove, onToggleSubtask, onJumpToSubtask }: {
  entry: AnalysisEntry;
  onRegen: (taskId: string, adj: string) => void;
  onRemove: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string, cur: boolean) => void;
  onJumpToSubtask?: (subtaskId: string, taskStartDate: string | null, startDay: number, durationDays: number) => void;
}) {
  const [adj, setAdj] = useState("");
  const [showResources, setShowResources] = useState(false);
  const isRunning = !["idle","done","error"].includes(entry.stream.phase);
  const isDone = entry.stream.phase === "done";
  const task = entry.task;
  const completedCount = task?.subtasks.filter((s) => s.completed).length ?? 0;
  const totalCount = task?.subtasks.length ?? 0;
  const pct = totalCount > 0 ? completedCount / totalCount : 0;

  const allResources: Resource[] = [];
  if (task) {
    for (const s of task.subtasks) {
      if (s.resources) {
        try {
          const r = JSON.parse(s.resources) as Resource[];
          for (const res of r) { if (!allResources.some((x) => x.title === res.title)) allResources.push(res); }
        } catch { /* ignore */ }
      }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ color: T.ink, fontWeight: 700, fontSize: 15, lineHeight: 1.35, wordBreak: "break-all", letterSpacing: "-0.03em" }}>{entry.taskTitle}</div>
        {entry.topicCategory && <span style={{ display: "inline-block", marginTop: 4, background: "rgba(59,122,255,0.08)", color: T.accent, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4 }}>{entry.topicCategory}</span>}
        {entry.rawInput && entry.rawInput !== entry.taskTitle && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <span style={{ background: T.paper, color: T.muted, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, border: `1px solid ${T.line}`, letterSpacing: "0.04em", textTransform: "uppercase" as const, fontFamily: "var(--font-geist-mono), monospace", flexShrink: 0 }}>原始输入</span>
            <span style={{ color: T.muted, fontSize: 12 }}>{entry.rawInput}</span>
          </div>
        )}
        {task && <div style={{ color: T.muted, fontSize: 11, marginTop: 4, fontFamily: "var(--font-geist-mono), monospace" }}>{task.totalDays}天计划 · {completedCount}/{totalCount} 完成{task.status === "done" && <span style={{ marginLeft: 6, color: T.green }}>✓ 已完成</span>}</div>}
      </div>

      {(!isDone || !task) && <PipelineSteps stream={entry.stream} />}

      {isDone && task && (
        <>
          <div style={{ height: 3, background: T.line, borderRadius: 9999, overflow: "hidden" }}>
            <div style={{ width: `${pct * 100}%`, height: "100%", background: pct === 1 ? T.green : T.accent, borderRadius: 9999, transition: "width 0.5s" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", borderRadius: 10, overflow: "hidden", border: `1px solid ${T.line}` }}>
            {task.subtasks.map((s, i) => {
              let sr: Resource[] = [];
              if (s.resources) { try { sr = JSON.parse(s.resources) as Resource[]; } catch { /* ignore */ } }
              return (
                <div key={s.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${T.line}` }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "8px 11px", cursor: "pointer", background: T.surface }}>
                    <input type="checkbox" checked={s.completed} onChange={() => onToggleSubtask(entry.taskId, s.id, s.completed)} style={{ accentColor: T.accent, width: 13, height: 13, marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}
                      onClick={(e) => { e.preventDefault(); onJumpToSubtask?.(s.id, (task as unknown as {startDate?: string}).startDate ?? null, s.startDay, s.durationDays); }}>
                      <div style={{ color: s.completed ? T.muted : T.ink, fontSize: 12, letterSpacing: "-0.01em", textDecoration: s.completed ? "line-through" : "none", wordBreak: "break-all" }}>{s.title}</div>
                      {s.description && <div style={{ color: T.muted, fontSize: 10, marginTop: 1, lineHeight: 1.4 }}>{s.description}</div>}
                      {sr.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                          {sr.map((r, ri) => (
                            <span key={ri} onClick={(e) => { e.stopPropagation(); if (r.url) window.open(r.url, "_blank", "noopener"); else if (r.searchQuery) window.open(`https://www.google.com/search?q=${encodeURIComponent(r.searchQuery)}`, "_blank", "noopener"); }}
                              style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "rgba(59,122,255,0.08)", color: T.accent, border: "1px solid rgba(59,122,255,0.2)", cursor: r.url || r.searchQuery ? "pointer" : "default", whiteSpace: "nowrap", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}
                              title={r.url || r.searchQuery || r.title}>
                              {r.type === "link" ? "🔗" : r.type === "search" ? "🔎" : r.type === "person" ? "👤" : "📚"} {r.title.slice(0, 12)}{r.title.length > 12 ? "…" : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span style={{ color: T.green, fontSize: 10, fontFamily: "var(--font-geist-mono), monospace", flexShrink: 0 }}>{s.durationDays}天</span>
                  </label>
                </div>
              );
            })}
          </div>

          {allResources.length > 0 && (
            <div>
              <button onClick={() => setShowResources((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "4px 0", color: T.ink, fontSize: 12, fontWeight: 600 }}>
                <span style={{ color: T.accent }}>📚</span> 全部推荐资源 ({allResources.length})
                <span style={{ marginLeft: "auto", color: T.muted, fontSize: 11 }}>{showResources ? "▲" : "▼"}</span>
              </button>
              {showResources && <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>{allResources.map((r, i) => <ResourceCard key={i} res={r} />)}</div>}
            </div>
          )}
        </>
      )}

      {isDone && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingTop: 2 }}>
          <div style={{ color: T.muted, fontSize: 11 }}>对计划有想法？输入调整意见后重新生成：</div>
          <textarea value={adj} onChange={(e) => setAdj(e.target.value)} placeholder="例：难度太高 / 专注某模块 / 增加实践内容" rows={2} disabled={isRunning} style={{ width: "100%", background: T.soft, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", color: T.ink, fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { onRegen(entry.taskId, adj); setAdj(""); }} disabled={isRunning} style={{ flex: 1, background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: isRunning ? "not-allowed" : "pointer", opacity: isRunning ? 0.5 : 1 }}>
              {isRunning ? "生成中…" : "↺ 重新生成"}
            </button>
            <button onClick={() => onRemove(entry.taskId)} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>移除</button>
          </div>
        </div>
      )}

      {entry.stream.phase === "error" && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onRegen(entry.taskId, "")} style={{ flex: 1, background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>重试</button>
          <button onClick={() => onRemove(entry.taskId)} style={{ background: "none", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>移除</button>
        </div>
      )}
    </div>
  );
}
```

---

## 22. src/components/home/new-task-input.tsx

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

## 23. src/components/home/subtask-row.tsx

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

## 24. src/components/home/subtask-detail-modal.tsx

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

## 25. src/components/home/congrats-modal.tsx

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

---

## 26. src/components/task/task-detail-page-v2.tsx

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useEazo } from "@eazo/sdk/react";
import { auth } from "@eazo/sdk";
import { memory } from "@eazo/sdk";
import { getTask, toggleSubtask, updateTaskStatusApi } from "@/lib/api/tasks";
import type { TaskWithSubtasks } from "@/lib/api/tasks";
import { GanttChart } from "@/components/task/gantt-chart";

interface TaskDetailPageProps { taskId: string; }

export function TaskDetailPage({ taskId }: TaskDetailPageProps) {
  const user = useEazo((s) => s.auth.user);
  const loading = useEazo((s) => s.auth.loading);
  const [task, setTask] = useState<TaskWithSubtasks | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const completedCount = task?.subtasks.filter((s) => s.completed).length ?? 0;
  const totalCount = task?.subtasks.length ?? 0;
  const progressPct = totalCount > 0 ? completedCount / totalCount : 0;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getTask(taskId)
      .then((data) => { if (!cancelled) { setFetching(false); setTask(data); } })
      .catch((e) => { if (!cancelled) { setFetching(false); setError(e.message); } });
    return () => { cancelled = true; };
  }, [taskId, user]);

  const handleToggle = useCallback(
    async (subtaskId: string, current: boolean) => {
      if (!task) return;
      const next = !current;

      // 乐观更新本地状态
      const updatedSubtasks = task.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, completed: next } : s
      );
      setTask((prev) =>
        prev ? { ...prev, subtasks: updatedSubtasks } : prev
      );

      await toggleSubtask(taskId, subtaskId, next).catch(() => {});

      // 全部完成后，将任务状态标记为 done
      const allDone =
        next &&
        updatedSubtasks.length > 0 &&
        updatedSubtasks.every((s) => s.completed);
      if (allDone) {
        await updateTaskStatusApi(taskId, "done").catch(() => {});
        setTask((prev) => prev ? { ...prev, status: "done" } : prev);
      } else if (!next && task.status === "done") {
        // 取消勾选后回退状态
        await updateTaskStatusApi(taskId, "active").catch(() => {});
        setTask((prev) => prev ? { ...prev, status: "active" } : prev);
      }

      memory.reportAction({
        content: `User ${next ? "completed" : "uncompleted"} subtask in task "${task.title}"`,
        event_type: next ? "complete" : "update",
      }).catch(() => {});
    },
    [task, taskId]
  );

  if (loading || fetching) {
    return <PageShell><LoadingState /></PageShell>;
  }

  if (!user) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 py-20">
          <p className="text-[14px]" style={{ color: "#777B75" }}>需要登录</p>
          <button
            onClick={() => auth.login().catch(() => {})}
            className="px-6 py-[10px] rounded-full text-[14px] font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: "#111111" }}
          >
            登录
          </button>
        </div>
      </PageShell>
    );
  }

  if (error || !task) {
    return (
      <PageShell>
        <p className="text-[14px]" style={{ color: "#777B75" }}>任务未找到</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <div className="flex items-start gap-3 flex-wrap">
            <h1
              className="text-[clamp(28px,8vw,52px)] font-semibold leading-none tracking-[-0.05em]"
              style={{ color: "#111111" }}
            >
              {task.title}
            </h1>
            {task.status === "done" && (
              <span
                className="mt-1 px-2.5 py-1 rounded-full text-[12px] font-medium flex-shrink-0"
                style={{
                  background: "rgba(47,93,80,0.12)",
                  color: "#2F5D50",
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                ✓ 已完成
              </span>
            )}
          </div>
          <p
            className="mt-2 text-[13px]"
            style={{ color: "#777B75", fontFamily: "var(--font-geist-mono), monospace" }}
          >
            {task.totalDays}天计划 ·{" "}
            {new Date(task.createdAt).toLocaleDateString("zh-CN")} ·{" "}
            {completedCount}/{totalCount} 完成
          </p>
        </div>

        <div className="h-[3px] rounded-full" style={{ background: "#E7E7E2" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct * 100}%`, background: "#3B7AFF" }}
          />
        </div>

        <div
          className="rounded-[20px] overflow-hidden"
          style={{
            border: "1px solid #E7E7E2",
            background: "rgba(255,255,255,0.56)",
            boxShadow: "0 12px 40px rgba(20,20,20,0.035)",
          }}
        >
          {task.subtasks.map((s, i) => (
            <label
              key={s.id}
              className="grid items-center px-[18px] py-4 cursor-pointer transition-colors hover:bg-white active:scale-[0.99]"
              style={{
                gridTemplateColumns: "auto 1fr auto",
                gap: 12,
                borderTop: i === 0 ? "none" : "1px solid #E7E7E2",
              }}
            >
              <input
                type="checkbox"
                checked={s.completed}
                onChange={() => handleToggle(s.id, s.completed)}
                style={{ accentColor: "#3B7AFF", width: 20, height: 20 }}
              />
              <span>
                <b
                  className="text-[15px] font-semibold block"
                  style={{
                    color: s.completed ? "#777B75" : "#111111",
                    textDecoration: s.completed ? "line-through" : "none",
                  }}
                >
                  {s.title}
                </b>
                {s.description && (
                  <small className="block mt-1 text-[13px]" style={{ color: "#777B75" }}>
                    {s.description}
                  </small>
                )}
              </span>
              <span
                className="text-[12px] font-medium"
                style={{ color: "#2F5D50", fontFamily: "var(--font-geist-mono), monospace" }}
              >
                {s.durationDays}天
              </span>
            </label>
          ))}

          <GanttChart
            subtasks={task.subtasks}
            totalDays={task.totalDays}
            animated={false}
            collapsible={true}
            defaultOpen={true}
          />
        </div>

        <div className="flex gap-8 pt-2">
          <Stat label="已完成" value={String(completedCount)} />
          <Stat label="总计" value={String(totalCount)} />
          <Stat label="计划天数" value={`${task.totalDays}天`} />
        </div>
      </div>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[clamp(22px,5vw,32px)] font-semibold"
        style={{ letterSpacing: "-0.05em", color: "#111111" }}
      >
        {value}
      </div>
      <div
        className="text-[11px] uppercase tracking-[0.06em] mt-0.5"
        style={{ color: "#777B75", fontFamily: "var(--font-geist-mono), monospace" }}
      >
        {label}
      </div>
    </div>
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
            href="/history"
            className="font-[650] tracking-[-0.03em] hover:opacity-70 transition-opacity"
            style={{ color: "#111111" }}
          >
            ← 历史任务
          </Link>
          <span
            className="text-[12px] uppercase tracking-[0.06em]"
            style={{ color: "#777B75", fontFamily: "var(--font-geist-mono), monospace" }}
          >
            Task Detail
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

## 27. src/components/task/gantt-chart.tsx

```typescript
"use client";

import type { Subtask } from "@/lib/db/schema";

interface GanttChartProps {
  subtasks: Subtask[];
  totalDays: number;
  animated?: boolean;
  /** When true, wraps the chart in a <details> element (collapsible) */
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function GanttChart({
  subtasks,
  totalDays,
  animated = true,
  collapsible = false,
  defaultOpen = true,
}: GanttChartProps) {
  if (subtasks.length === 0) return null;
  const span = Math.max(totalDays, 1);

  const bars = (
    <div className="flex flex-col gap-[10px]" aria-label="甘特图时间线">
      {subtasks.map((s, i) => {
        const leftPct = (s.startDay / span) * 100;
        const widthPct = Math.max((s.durationDays / span) * 100, 4);
        const delay = animated ? i * 0.12 : 0;

        return (
          <div
            key={s.id}
            className="relative h-7 rounded-full overflow-hidden"
            style={{ background: "#F1F2EE" }}
            title={`${s.title} (${s.durationDays}天)`}
          >
            {/* Filled pill segment */}
            <div
              className="absolute inset-y-0 rounded-full"
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                background: "#3B7AFF",
                opacity: 0.86,
                transformOrigin: "left",
                animation: animated
                  ? `ganttGrow 0.9s cubic-bezier(.2,.8,.2,1) ${delay}s both`
                  : "none",
              }}
            />
            {/* Label */}
            <em
              className="absolute top-[6px] text-[11px] font-medium not-italic text-white leading-none"
              style={{
                left: `calc(${leftPct}% + 10px)`,
                fontFamily: "var(--font-geist-mono), monospace",
                pointerEvents: "none",
              }}
            >
              {s.title.length > 12 ? `${s.title.slice(0, 10)}…` : s.title}
            </em>
          </div>
        );
      })}
    </div>
  );

  if (!collapsible) return bars;

  return (
    <details
      open={defaultOpen}
      className="border-t"
      style={{ borderColor: "#E7E7E2", background: "rgba(244,241,234,0.55)" }}
    >
      <summary
        className="px-[18px] py-4 cursor-pointer font-semibold text-[15px] select-none list-none"
        style={{ WebkitListStyle: "none" } as React.CSSProperties}
      >
        时间线
      </summary>
      <div className="px-[18px] pb-[18px]">{bars}</div>
    </details>
  );
}
```

---

## 28. src/components/history/history-page.tsx

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

## 29. src/components/errors/error-fallback-page.tsx

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

## 30. src/components/errors/error-page-shell.tsx

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

## 31. src/components/errors/not-found-page.tsx

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

---

## 32. src/components/i18n/i18n-provider.tsx

```typescript
"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { applyStoredLocalePreference } from "@/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void applyStoredLocalePreference();
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
```

---

## 33. src/components/i18n/language-switcher.tsx

```typescript
"use client";

/** Reference locale control — restyle or fork for your app's header/settings UI. Keep changeLocale() wiring. */

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  changeLocale,
  getLocalePreference,
  normalizeLocale,
  supportedLocales,
  type LocaleCode,
  type LocalePreference,
} from "@/i18n";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [preference, setPreference] = useState<LocalePreference>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      setPreference(getLocalePreference());
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const sync = () => setPreference(getLocalePreference());
    i18n.on("languageChanged", sync);
    window.addEventListener("eazo-locale-preference-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      i18n.off("languageChanged", sync);
      window.removeEventListener("eazo-locale-preference-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [i18n, mounted]);

  if (!mounted) {
    return (
      <div
        className="flex h-8 w-[100px] items-center gap-1.5 rounded-full border border-border bg-background px-2 shadow-sm"
        aria-hidden
      />
    );
  }

  const activeLocale =
    normalizeLocale(i18n.resolvedLanguage || i18n.language) ?? "en-US";
  const resolvedLabel =
    supportedLocales.find((l) => l.code === activeLocale)?.nativeLabel ?? activeLocale;

  async function handleChange(value: string) {
    if (value === "system") {
      await changeLocale("system");
      return;
    }
    const locale = normalizeLocale(value);
    if (locale) await changeLocale(locale as LocaleCode);
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 shadow-sm">
      <Languages className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <label htmlFor="app-locale" className="sr-only">
        {t("language.label")}
      </label>
      <select
        id="app-locale"
        value={preference}
        onChange={(e) => void handleChange(e.target.value)}
        className="max-w-[140px] cursor-pointer truncate bg-transparent text-xs font-medium text-foreground outline-none"
        title={
          preference === "system"
            ? t("language.followSystemWithLanguage", { language: resolvedLabel })
            : resolvedLabel
        }
      >
        <option value="system">{t("language.followSystem")}</option>
        <option value="en-US">{t("language.enUS")}</option>
        <option value="zh-CN">{t("language.zhCN")}</option>
      </select>
    </div>
  );
}
```

---

## 34. src/components/i18n/locale-sync-effect.tsx

```typescript
"use client";

import { useEffect } from "react";
import i18n, {
  getLocalePreference,
  normalizeLocale,
  resolveLocalePreference,
  syncDocumentLanguage,
} from "@/i18n";

export function LocaleSyncEffect() {
  useEffect(() => {
    const syncSystemLocale = async () => {
      if (getLocalePreference() !== "system") return;

      const systemLocale = resolveLocalePreference("system");
      const active = normalizeLocale(i18n.resolvedLanguage || i18n.language);
      if (active === systemLocale) return;

      await i18n.changeLanguage(systemLocale);
      syncDocumentLanguage(i18n.language);
    };

    const handleLanguageChange = () => void syncSystemLocale();
    window.addEventListener("languagechange", handleLanguageChange);
    return () => window.removeEventListener("languagechange", handleLanguageChange);
  }, []);

  return null;
}
```

---

## 35. src/components/user-profile/user-sync-effect.tsx

```typescript
"use client";

import { useEffect, useRef } from "react";
import { auth } from "@eazo/sdk";
import { useEazo } from "@eazo/sdk/react";

/**
 * Mobile-only: hits /api/user/profile once after login to upsert the user
 * into the local DB. Web doesn't need this — the SDK already calls the same
 * endpoint during web bootstrap; mobile bootstraps from the bridge `hello`
 * instead and never auto-fetches profile, so the upsert has to be triggered
 * manually here.
 */
export function UserSyncEffect() {
  const authenticated = useEazo((s) => s.auth.authenticated);
  const platform = useEazo((s) => s.device.platform);
  const syncedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!authenticated || platform !== "mobile") return;

    const userId = auth.user?.id ?? null;
    if (!userId || syncedUserId.current === userId) return;

    syncedUserId.current = userId;

      (async () => {
      try {
        const sessionHeader = await auth.getSessionHeader();
        if (!sessionHeader) return;

        await fetch("/api/user/profile", {
          headers: { "x-eazo-session": sessionHeader },
        });
      } catch (err) {
        console.error("[UserSyncEffect] profile fetch failed", err);
      }
    })();
  }, [authenticated, platform]);

  return null;
}
```

---

## 36. src/components/user-profile/user-badge.tsx

```typescript
"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { LogOut, UserRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { auth } from "@eazo/sdk";
import { useEazo } from "@eazo/sdk/react";
import type { User } from "@eazo/sdk";

export function UserBadge() {
  const { t } = useTranslation();
  const user = useEazo((s) => s.auth.user);
  const loading = useEazo((s) => s.auth.loading);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  if (loading) {
    return (
      <div className="flex h-9 items-center rounded-full border border-border bg-background px-3 shadow-sm">
        <div className="size-4 animate-spin rounded-full border-2 border-muted border-t-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <button
        onClick={() => {
          auth.login().catch(() => undefined);
        }}
        className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-shadow hover:shadow-md"
      >
        <UserRound className="h-4 w-4 text-muted-foreground" />
        {t("common.signIn")}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <BadgeTrigger user={user} onClick={() => setOpen((v) => !v)} />
      {open && (
        <DropdownPanel user={user} onClose={() => setOpen(false)} userIdLabel={t("common.userId")}>
          <button
            onClick={() => {
              auth.logout();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("common.signOut")}
          </button>
        </DropdownPanel>
      )}
    </div>
  );
}

function BadgeTrigger({ user, onClick }: { user: User; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1.5 text-sm shadow-sm transition-shadow hover:shadow-md"
    >
      <Avatar user={user} size={24} />
      <span className="max-w-[120px] truncate font-medium text-foreground">
        {user.name ?? user.email ?? user.id}
      </span>
    </button>
  );
}

function DropdownPanel({
  user,
  onClose,
  userIdLabel,
  children,
}: {
  user: User;
  onClose: () => void;
  userIdLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
      <div className="flex items-start justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar user={user} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name ?? "—"}</p>
            {user.email && (
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-0.5 shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground space-y-1.5">
        <Row label={userIdLabel} value={user.id} mono />
      </div>

      {children && <div className="border-t border-border px-4 py-2">{children}</div>}
    </div>
  );
}

function Avatar({ user, size }: { user: User; size: number }) {
  if (user.avatarUrl) {
    const avatarSrc = user.avatarUrl.startsWith("//")
      ? `https:${user.avatarUrl}`
      : user.avatarUrl;
    return (
      <Image
        src={avatarSrc}
        alt={user.name ?? "avatar"}
        width={size}
        height={size}
        className="rounded-full object-cover ring-2 ring-border"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(user.name ?? user.email ?? "?")[0].toUpperCase()}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-muted-foreground/70">{label}</span>
      <span className={`truncate text-right text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
```

---

## 37. src/i18n/index.ts

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enUS from "./locales/en-US.json";
import zhCN from "./locales/zh-CN.json";
import { localeCodes, normalizeLocale, type LocaleCode } from "@/lib/i18n/locale";
import {
  LOCALE_STORAGE_KEY,
  detectSystemLocale,
  getLocalePreference,
  persistLocalePreference,
  resolveLocalePreference,
  type LocalePreference,
} from "@/lib/i18n/preference";

export type { LocaleCode, LocalePreference };
export {
  LOCALE_STORAGE_KEY,
  normalizeLocale,
  localeCodes,
  detectSystemLocale,
  getLocalePreference,
  resolveLocalePreference,
};

const resources = {
  "en-US": { translation: enUS },
  "zh-CN": { translation: zhCN },
} as const;

// Fixed default for SSR — user preference is applied client-side after mount.
void i18n.use(initReactI18next).init({
  resources,
  lng: "en-US",
  fallbackLng: "en-US",
  supportedLngs: [...localeCodes],
  interpolation: { escapeValue: false },
});

export function syncDocumentLanguage(language: string) {
  const locale = normalizeLocale(language) ?? "en-US";
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export default i18n;

export const supportedLocales = [
  { code: "en-US" as const, label: "English", nativeLabel: "English" },
  { code: "zh-CN" as const, label: "Chinese", nativeLabel: "中文" },
];

export const changeLocale = async (preference: LocalePreference) => {
  persistLocalePreference(preference);
  await i18n.changeLanguage(resolveLocalePreference(preference));
  syncDocumentLanguage(i18n.language);
  window.dispatchEvent(
    new CustomEvent("eazo-locale-preference-changed", { detail: preference }),
  );
};

export function getResolvedLocale(): LocaleCode {
  return normalizeLocale(i18n.resolvedLanguage || i18n.language) ?? "en-US";
}

/** Apply stored preference after hydration (call once from I18nProvider). */
export async function applyStoredLocalePreference(): Promise<void> {
  const preference = getLocalePreference();
  await i18n.changeLanguage(resolveLocalePreference(preference));
  syncDocumentLanguage(i18n.language);
}
```

---

## 38. src/i18n/locales/en-US.json

```json
{
  "common": {
    "signIn": "Sign in",
    "signOut": "Sign out",
    "loading": "Loading…",
    "on": "On",
    "off": "Off",
    "close": "Close",
    "save": "Save",
    "cancel": "Cancel",
    "edit": "Edit",
    "delete": "Delete",
    "userId": "User ID"
  },
  "language": {
    "label": "Language",
    "triggerLabel": "Language: {{language}}",
    "followSystem": "System",
    "followSystemWithLanguage": "System ({{language}})",
    "enUS": "English",
    "zhCN": "中文"
  },
  "errors": {
    "notFound": {
      "code": "404",
      "title": "Page not found",
      "description": "The page you're looking for doesn't exist or may have been moved.",
      "backHome": "Back to home"
    },
    "generic": {
      "title": "Something went wrong",
      "description": "An unexpected error occurred. You can try again or return to the home page.",
      "tryAgain": "Try again",
      "backHome": "Back to home"
    }
  },
  "starter": {
    "badge": "Eazo App Starter",
    "title": "Build your next app with Eazo",
    "subtitle": "Demo artifacts are removed. You now have a clean foundation with auth, data access, and platform integrations ready for your product.",
    "steps": {
      "readDocs": {
        "title": "Read the docs",
        "desc": "Open AGENTS.md and README.md to understand the template architecture.",
        "code": "AGENTS.md + README.md"
      },
      "replacePage": {
        "title": "Replace this page",
        "desc": "Move your product UI into src/components and keep page.tsx thin.",
        "code": "src/app/page.tsx"
      },
      "firstFeature": {
        "title": "Build your first feature",
        "desc": "Add API routes under src/app/api and call them from typed helpers.",
        "code": "src/app/api/*"
      },
      "translations": {
        "title": "Add translations",
        "desc": "Edit en-US / zh-CN strings in src/i18n/locales. LanguageSwitcher and I18nProvider in layout.tsx are already wired.",
        "code": "src/i18n/locales/"
      }
    },
    "nextCommand": {
      "title": "Next command",
      "desc": "Start developing and iterate in real time.",
      "command": "bun dev"
    }
  }
}
```

---

## 39. src/i18n/locales/zh-CN.json

```json
{
  "common": {
    "signIn": "登录",
    "signOut": "退出登录",
    "loading": "加载中…",
    "on": "开",
    "off": "关",
    "close": "关闭",
    "save": "保存",
    "cancel": "取消",
    "edit": "编辑",
    "delete": "删除",
    "userId": "用户 ID"
  },
  "language": {
    "label": "语言",
    "triggerLabel": "语言：{{language}}",
    "followSystem": "跟随系统",
    "followSystemWithLanguage": "跟随系统（{{language}}）",
    "enUS": "English",
    "zhCN": "中文"
  },
  "errors": {
    "notFound": {
      "code": "404",
      "title": "页面未找到",
      "description": "你访问的页面不存在，或已被移动。",
      "backHome": "返回首页"
    },
    "generic": {
      "title": "出了点问题",
      "description": "发生了意外错误。你可以重试，或返回首页继续。",
      "tryAgain": "重试",
      "backHome": "返回首页"
    }
  },
  "starter": {
    "badge": "Eazo 应用模板",
    "title": "用 Eazo 构建你的下一个应用",
    "subtitle": "演示代码已移除。你现在拥有干净的基础：认证、数据访问与平台能力已就绪，可直接开发产品功能。",
    "steps": {
      "readDocs": {
        "title": "阅读文档",
        "desc": "打开 AGENTS.md 与 README.md，了解模板架构与约定。",
        "code": "AGENTS.md + README.md"
      },
      "replacePage": {
        "title": "替换本页",
        "desc": "将产品 UI 放到 src/components 下，并保持 page.tsx 为薄入口。",
        "code": "src/app/page.tsx"
      },
      "firstFeature": {
        "title": "开发第一个功能",
        "desc": "在 src/app/api 添加接口，并通过 src/lib/api 中的类型化 helper 调用。",
        "code": "src/app/api/*"
      },
      "translations": {
        "title": "补充翻译",
        "desc": "在 src/i18n/locales 编辑中英文文案；layout 已接入 LanguageSwitcher 与 I18nProvider。",
        "code": "src/i18n/locales/"
      }
    },
    "nextCommand": {
      "title": "下一步命令",
      "desc": "启动开发服务器，实时迭代你的产品。",
      "command": "bun dev"
    }
  }
}
```

---

## 40. src/lib/db/migrate.ts

```typescript
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "path";
import postgres from "postgres";

config({ path: ".env" });

const runMigrate = async () => {
  const client = postgres(
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/myapp",
    { max: 1 }
  );
  const db = drizzle(client);

  console.log("⏳ Running migrations...");

  const start = Date.now();
  const migrationsFolder = path.join(process.cwd(), "src/lib/db/migrations");
  await migrate(db, { migrationsFolder });
  const end = Date.now();

  console.log("✅ Migrations completed in", end - start, "ms");
  await client.end();
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("❌ Migration failed");
  console.error(err);
  process.exit(1);
});
```

---

## 41. src/lib/mcp/server.ts

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function buildMcpServer(_userId: string): McpServer {
  const server = new McpServer({
    name: "eazo-mcp",
    version: "1.0.0",
  });

  // Register your tools here. See AGENTS.md § 8 for the pattern:
  //   import { registerMyTool } from "./tools/my-tool";
  //   registerMyTool(server, _userId);

  return server;
}
```

---

## 42. src/lib/auth/index.ts

```typescript
export { requireAuth } from "@eazo/sdk/server";
export type { User, AuthResult } from "@eazo/sdk/server";
```

---

## 43. src/lib/db/client.ts

```typescript
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

config({ path: ".env" });

const client = postgres(
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/myapp"
);

export const db = drizzle(client);
```

---

## 44. src/lib/db/schema/users.ts

```typescript
import type { InferSelectModel } from "drizzle-orm";
import { index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    email: varchar("email", { length: 256 }).unique(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
    createdAtIdx: index("users_created_at_idx").on(table.createdAt),
  })
);

export type User = InferSelectModel<typeof users>;
```

---

## 45. src/lib/db/schema/tasks.ts

```typescript
import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    rawInput: text("raw_input"),          // 用户原始输入，AI 生成正式 title 后保留
    startDate: timestamp("start_date", { withTimezone: true }), // 大任务开始日期
    status: text("status").notNull().default("active"),
    totalDays: integer("total_days").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("tasks_user_id_idx").on(table.userId),
    createdAtIdx: index("tasks_created_at_idx").on(table.createdAt),
  })
);

export const subtasks = pgTable(
  "subtasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    durationDays: integer("duration_days").notNull().default(1),
    startDay: integer("start_day").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    resources: text("resources"),        // JSON: Array<{type,title,url?,searchQuery?,author?}>
    topic: text("topic"),                // 主题类别，如：数学/编程/语言
    urgency: integer("urgency"),         // 1-5 紧急度
    importance: integer("importance"),   // 1-5 重要度
    keywords: text("keywords"),          // JSON: string[] 关键词
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    taskIdIdx: index("subtasks_task_id_idx").on(table.taskId),
  })
);

export type Task = InferSelectModel<typeof tasks>;
export type Subtask = InferSelectModel<typeof subtasks>;
```

---

## 46. src/lib/i18n/locale.ts

```typescript
export const localeCodes = ["en-US", "zh-CN"] as const;
export type LocaleCode = (typeof localeCodes)[number];

const localeSet = new Set<string>(localeCodes);

export const normalizeLocale = (value: string | null | undefined): LocaleCode | null => {
  if (!value) return null;
  if (localeSet.has(value)) return value as LocaleCode;

  const normalized = value.toLowerCase();
  if (normalized.startsWith("zh")) return "zh-CN";
  if (normalized.startsWith("en")) return "en-US";
  return null;
};
```

---

## 47. src/lib/i18n/preference.ts

```typescript
import { normalizeLocale, type LocaleCode } from "@/lib/i18n/locale";

export const LOCALE_STORAGE_KEY = "eazo-app.locale.v1";

export type LocalePreference = LocaleCode | "system";

export function detectSystemLocale(): LocaleCode {
  const browserLanguages =
    typeof navigator !== "undefined"
      ? [navigator.language, ...(navigator.languages ?? [])]
      : [];
  for (const language of browserLanguages) {
    const locale = normalizeLocale(language);
    if (locale) return locale;
  }
  return "en-US";
}

export function parseLocalePreference(raw: string | null | undefined): LocalePreference {
  if (!raw) return "system";
  if (raw === "system") return "system";
  return normalizeLocale(raw) ?? "system";
}

export function resolveLocalePreference(preference: LocalePreference): LocaleCode {
  return preference === "system" ? detectSystemLocale() : preference;
}

function getBrowserStorage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

/** Read preference from localStorage (client only). */
export function getLocalePreference(): LocalePreference {
  const storage = getBrowserStorage();
  if (!storage) return "system";
  return parseLocalePreference(storage.getItem(LOCALE_STORAGE_KEY));
}

export function persistLocalePreference(preference: LocalePreference): void {
  getBrowserStorage()?.setItem(LOCALE_STORAGE_KEY, preference);
  if (typeof document !== "undefined") {
    document.cookie = `${LOCALE_STORAGE_KEY}=${encodeURIComponent(preference)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }
}
```

---

## 48. src/lib/i18n/server-locale.ts

```typescript
import type { NextRequest } from "next/server";
import { normalizeLocale, type LocaleCode } from "@/lib/i18n/locale";

export function getRequestLocale(request: NextRequest): LocaleCode {
  const fromHeader = normalizeLocale(request.headers.get("x-app-locale"));
  if (fromHeader) return fromHeader;

  const acceptLanguage = request.headers.get("accept-language");
  const preferred = acceptLanguage?.split(",")[0]?.split(";")[0]?.trim();
  return normalizeLocale(preferred) ?? "en-US";
}
```

---

## 49. src/lib/i18n/server-preference.ts

```typescript
import { cookies } from "next/headers";
import {
  LOCALE_STORAGE_KEY,
  parseLocalePreference,
  resolveLocalePreference,
} from "@/lib/i18n/preference";
import type { LocaleCode } from "@/lib/i18n/locale";

/** Resolved locale for SSR (cookie → default en-US). */
export async function getServerLocale(): Promise<LocaleCode> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_STORAGE_KEY)?.value;
  const preference = parseLocalePreference(
    raw ? decodeURIComponent(raw) : null,
  );
  if (preference === "system") {
    return "en-US";
  }
  return resolveLocalePreference(preference);
}
```

---

## 50. src/utils/utils.ts

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 51. src/lib/db/queries/users.ts

```typescript
import { eq } from "drizzle-orm";
import { db } from "../client";
import { users, type User } from "../schema/users";

export async function getUserById(id: string): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0];
}

export async function upsertUser(data: {
  id: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}): Promise<User> {
  const rows = await db
    .insert(users)
    .values(data)
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: data.email ?? null,
        name: data.name ?? null,
        avatarUrl: data.avatarUrl ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return rows[0];
}

export async function updateUser(
  id: string,
  data: { name?: string | null; avatarUrl?: string | null }
): Promise<User | undefined> {
  if (Object.keys(data).length === 0) return getUserById(id);

  const rows = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return rows[0];
}

export async function deleteUser(id: string): Promise<boolean> {
  const rows = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
  return rows.length > 0;
}
```

---

## 52. src/lib/db/queries/index.ts (barrel)

```typescript
export * from "./users";
export * from "./tasks";
```

---

## 53. src/lib/db/schema/index.ts (barrel)

```typescript
export * from "./users";
export * from "./tasks";
```
