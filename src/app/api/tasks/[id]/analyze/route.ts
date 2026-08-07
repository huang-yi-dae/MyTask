import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { appAi } from "@/lib/eazo-ai-billing";
import { resolveResources, type SearchIntent, type TrustableResource } from "@/lib/tavily";
import { validateResources } from "@/lib/resource-validator";
import { extractUrl, fetchUrlContent, formatContentForPrompt } from "@/lib/url-fetcher";
import {
  INTENT_PROMPT as _INTENT_PROMPT,
  RESOURCE_INTENT_PROMPT as _RESOURCE_INTENT_PROMPT,
  PLAN_PROMPT as _PLAN_PROMPT,
  VALIDATE_PROMPT as _VALIDATE_PROMPT,
} from "@/lib/ai/prompts";
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

// ─── Resource type（使用 TrustableResource，含 trust_level）────────────────
// TrustableResource 从 src/lib/tavily.ts 导入，不在此重复定义

// ─── AI Prompts（从 src/lib/ai/prompts.ts 导入，保持向后兼容别名）─────────────
const INTENT_PROMPT = _INTENT_PROMPT;
const RESOURCE_INTENT_PROMPT = _RESOURCE_INTENT_PROMPT;
const PLAN_PROMPT = _PLAN_PROMPT;
const VALIDATE_PROMPT = _VALIDATE_PROMPT;

// ─── Stage 1: Intent Analysis ──────────────────────────────────────────
// ─── Stage 1: Intent Analysis ──────────────────────────────────────────
// (Prompt 定义已移至 src/lib/ai/prompts.ts，此处保留注释说明理论依据)
// - Vygotsky ZPD 理论：先评估先备知识，才能设定合适的学习起点
// - Bloom 认知分类法：明确最终目标层级，反向设计学习路径

// ─── Stage 2: Resource Search Intent ──────────────────────────────────
// 两阶段分离：AI 只生成搜索意图（无 URL），代码负责实际检索

// ─── Stage 3 & 4 Prompts 见 src/lib/ai/prompts.ts ───────────────────

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
        // ── Stage 0: URL 内容抓取（如果输入包含 URL）───────────────
        // 用户输入 GitHub 仓库、文章、文档链接时，先抓取真实内容
        // 再将内容注入 Stage 1 的 INTENT_PROMPT，让 AI 基于实际页面规划
        let urlContext = "";
        const detectedUrl = extractUrl(rawGoal);
        if (detectedUrl) {
          send("phase", { step: "intent", label: "// 阶段 0 · 检测到链接，正在读取页面内容…" });
          try {
            const fetched = await fetchUrlContent(detectedUrl);
            if (fetched) {
              urlContext = formatContentForPrompt(fetched);
              send("url_fetched", {
                url: detectedUrl,
                urlType: fetched.urlType,
                title: fetched.title,
                tags: fetched.tags,
              });
            }
          } catch { /* 抓取失败静默降级，不阻断主流程 */ }
        }

        // ── Stage 1: Intent ───────────────────────────────────────────
        send("phase", { step: "intent", label: "// 阶段 1/4 · 评估先备知识与学习目标层级…" });

        // 如果有 URL 内容，把它作为上下文附加到用户输入后面
        const enrichedGoal = urlContext
          ? `${rawGoal}\n\n${urlContext}`
          : rawGoal;

        const intentRaw = await callAI(
          INTENT_PROMPT,
          enrichedGoal + (adjustment ? `\n调整要求：${adjustment}` : ""),
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

        // ── Stage 2: Resources（两阶段分离）──────────────────────────
        // Step A：AI 只生成搜索意图，不生成 URL
        send("phase", { step: "search", label: "// 阶段 2/4 · 生成搜索策略，检索可信资源…" });

        const intentRawStr = await callAI(
          "你是资深学习资源顾问，请以 JSON 格式精确回复，不要加 markdown 代码块。严禁生成任何 URL。",
          RESOURCE_INTENT_PROMPT
            .replace("{GOAL}", enrichedGoal.slice(0, 800)) // 使用带 URL 内容的完整目标
            .replace("{DOMAIN}", domain)
            .replace(/{PRIOR_LEVEL}/g, priorLevel)
            .replace("{KEYWORDS}", keywords),
          (d) => send("delta", { stage: "search", content: d })
        );

        interface IntentListResult { search_intents?: SearchIntent[] }
        const intentList = parseJson<IntentListResult>(intentRawStr)?.search_intents ?? [];

        // Step B：代码调用 Tavily，从白名单域名检索真实 URL
        // 有 TAVILY_API_KEY → verified；无 → search_only
        send("phase", { step: "search", label: `// 阶段 2/4 · 正在检索 ${intentList.length} 个资源来源…` });
        const resources: TrustableResource[] = await resolveResources(intentList, topicCategory);

        // Step C：三维可信度验证（URL 存活 + 域名权威分 + 新鲜度）
        // 并行 HEAD 检测，总耗时 ≤ 3s，不阻断主流程
        send("phase", { step: "validate_resources", label: `// 阶段 2/4 · 验证 ${resources.filter(r => r.url).length} 条资源可达性…` });
        await validateResources(resources);

        const verifiedCount = resources.filter((r) => r.trust_level === "verified").length;
        const reachableCount = resources.filter((r) => r.url_status === "ok" || r.url_status === "redirect").length;
        send("search_done", {
          resourceCount: resources.length,
          verifiedCount,
          searchOnlyCount: resources.length - verifiedCount,
          reachableCount,
        });

        // ── Stage 3: Plan ─────────────────────────────────────────────
        send("phase", { step: "plan", label: "// 阶段 3/4 · 按 Bloom 认知层级设计学习路径…" });

        const planRaw = await callAI(
          "你是学习计划设计专家，精通Bloom认知分类法和认知负荷理论，请以 JSON 格式精确回复，不要加 markdown 代码块。",
          PLAN_PROMPT
            .replace("{GOAL}", enrichedGoal.slice(0, 1200))
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

          const actualDate = findNextAvailableDay(earliestDate, topicCategory, dailySlots, s.bloom_level ?? 2);
          const actualStartDay = Math.round(
            (actualDate.getTime() - newStartDate.getTime()) / 86400000
          );

          registerDailySlot(actualDate.toISOString().slice(0, 10), topicCategory, dailySlots, s.bloom_level ?? 2);
          cumulativeDay = actualStartDay + s.duration_days;

          const subtaskResources: TrustableResource[] = (s.resource_indices ?? [])
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
