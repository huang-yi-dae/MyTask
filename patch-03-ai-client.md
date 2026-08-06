# patch-03-ai-client.md

## src/lib/eazo-ai-billing.ts

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

## src/lib/api/request.ts

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

## src/lib/api/app-ai-request.ts

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

## src/lib/api/tasks.ts

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
