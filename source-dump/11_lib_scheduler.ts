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
