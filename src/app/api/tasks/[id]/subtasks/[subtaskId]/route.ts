import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getTaskById, toggleSubtask, postponeSubtask } from "@/lib/db/queries";

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

  // 延迟一天：startDay += 1
  if (body.action === "postpone") {
    const startDay = await postponeSubtask(subtaskId);
    return NextResponse.json({ ok: true, startDay });
  }

  const completed = Boolean(body.completed);
  await toggleSubtask(subtaskId, completed);
  return NextResponse.json({ ok: true });
}
