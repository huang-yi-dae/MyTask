# patch-05-api-misc.md

## src/app/api/tasks/[id]/subtasks/[subtaskId]/route.ts

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

## src/app/api/subtasks/route.ts

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

## src/app/api/user/profile/route.ts

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

## src/app/api/notifications/cron/daily-digest/route.ts

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

## src/app/api/mcp/route.ts

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

## src/lib/mcp/server.ts

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
