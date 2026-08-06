# AutoTask · 开发者完整上手指南

> **验收标准**：一个完全不认识这个项目的人，拿到这份文档，能在自己电脑上从零搭建、跑通、并理解每一行代码。

---

# 第一部分：项目全局画像

## 1.1 一句话定位

AutoTask 是一款 **AI 驱动的订单式学习任务管理工具**。用户输入一个模糊的学习目标（如"学 Python"），系统通过 4 阶段 AI Pipeline（意图分析 → 资源搜索 → 计划生成 → 核查修订）自动拆解为可执行子任务，并基于 Bloom 认知分类法和认知负荷理论进行智能排期，最终在双列仪表板上展示可交互的任务时间线。

---

## 1.2 完整技术栈

| 分类 | 名称 | 版本 | 作用 |
|---|---|---|---|
| 运行时 | Bun | 1.3.9 | 包管理器 + 脚本执行器 |
| 框架 | Next.js | 16.2.4 | 全栈框架（App Router） |
| UI 库 | React | 19.2.4 | 前端 UI |
| 类型系统 | TypeScript | ^5 | 静态类型检查 |
| 样式 | Tailwind CSS | ^4 | 原子化 CSS |
| 样式工具 | tw-animate-css | ^1.4.0 | Tailwind 动画扩展 |
| 组件库 | shadcn/ui | ^4.3.1 | 基础 UI 组件 |
| 基础组件 | @base-ui/react | ^1.4.0 | Button 等无样式基础组件 |
| 动效 | framer-motion | ^12.38.0 | 动画库（当前未使用，保留备用） |
| 图标 | lucide-react | ^1.8.0 | 图标库 |
| Toast | sonner | ^2.0.7 | 通知提示 |
| 主题 | next-themes | ^0.4.6 | 暗色模式 |
| ORM | drizzle-orm | ^0.45.2 | 数据库类型安全查询 |
| ORM CLI | drizzle-kit | ^0.31.10 | 迁移生成工具 |
| 数据库驱动 | postgres | ^3.4.9 | PostgreSQL 客户端（postgres.js） |
| 数据库 | PostgreSQL | 14+ | 关系型数据库 |
| 国际化 | i18next | ^25.8.14 | 国际化框架 |
| 国际化React | react-i18next | ^16.5.6 | React i18n 绑定 |
| 平台 SDK | @eazo/sdk | 0.22.5 | 认证/AI/Memory/通知 |
| MCP | @modelcontextprotocol/sdk | ^1.29.0 | MCP 服务端协议 |
| 工具 | clsx | ^2.1.1 | 条件 className 合并 |
| 工具 | tailwind-merge | ^3.5.0 | Tailwind class 冲突解决 |
| 工具 | class-variance-authority | ^0.7.1 | 组件变体管理 |
| 工具 | zod | ^4.3.6 | 数据校验 |
| 工具 | dotenv | ^17.4.2 | 环境变量加载 |
| 字体 | Geist / Geist Mono | — | 通过 next/font/google 加载 |
| 部署 | Vercel | — | 生产部署平台 |
| PostCSS | @tailwindcss/postcss | ^4 | Tailwind v4 PostCSS 插件 |
| 测试 | happy-dom | ^20.11.1 | DOM 测试环境 |

---

## 1.3 架构总览

### 分层结构

```
┌─────────────────────────────────────────────────────────┐
│  第 1 层：UI 层（React Client Components）                │
│  src/components/home/  src/components/task/             │
│  src/components/history/  src/components/errors/        │
│  src/components/i18n/  src/components/user-profile/     │
│  src/components/ui/                                     │
├─────────────────────────────────────────────────────────┤
│  第 2 层：页面路由层（Next.js App Router）                 │
│  src/app/page.tsx  src/app/history/page.tsx             │
│  src/app/task/[id]/page.tsx                             │
├─────────────────────────────────────────────────────────┤
│  第 3 层：客户端 API 层（浏览器端 fetch 封装）              │
│  src/lib/api/request.ts  src/lib/api/tasks.ts           │
│  src/lib/api/app-ai-request.ts                          │
├─────────────────────────────────────────────────────────┤
│  第 4 层：API 路由层（Next.js Route Handlers，服务端）     │
│  src/app/api/tasks/  src/app/api/subtasks/              │
│  src/app/api/user/  src/app/api/notifications/          │
│  src/app/api/mcp/                                       │
├─────────────────────────────────────────────────────────┤
│  第 5 层：业务服务层（服务端纯函数）                        │
│  src/lib/scheduler.ts（排期算法）                        │
│  src/lib/eazo-ai-billing.ts（AI 调用封装）               │
│  src/lib/auth/index.ts（认证守卫）                       │
│  src/lib/mcp/server.ts（MCP 工具注册）                   │
├─────────────────────────────────────────────────────────┤
│  第 6 层：数据访问层（Drizzle ORM）                        │
│  src/lib/db/queries/tasks.ts                            │
│  src/lib/db/queries/users.ts                            │
├─────────────────────────────────────────────────────────┤
│  第 7 层：数据层（PostgreSQL）                             │
│  tables: users / tasks / subtasks                       │
└─────────────────────────────────────────────────────────┘
```

### 模块调用关系

```
UI 组件
  └─ 调用 → src/lib/api/*.ts（客户端 API 层）
               └─ 调用 → src/lib/api/request.ts（注入 session header）
                            └─ 调用 → src/lib/api/app-ai-request.ts（402 处理）
                                         └─ fetch → Next.js API Routes

API Routes（服务端）
  ├─ 调用 → src/lib/auth/index.ts（鉴权）
  ├─ 调用 → src/lib/db/queries/*.ts（数据库操作）
  ├─ 调用 → src/lib/eazo-ai-billing.ts（AI 调用）
  └─ 调用 → src/lib/scheduler.ts（排期计算）

src/lib/db/queries/*.ts
  └─ 调用 → src/lib/db/client.ts（Drizzle 实例）
               └─ 连接 → PostgreSQL

src/lib/eazo-ai-billing.ts
  └─ 调用 → Eazo AI Gateway（HTTPS，Creator Proxy）
               └─ 路由 → deepseek.v3.2 等模型
```

---

## 1.4 完整数据流示例：用户新建任务 → AI 分析 → 左侧列表展示

```
Step 1  用户点击「+ 新建任务」，输入"学 Python"，按 Enter
         │
         ▼ 组件：NewTaskInput.handleSubmit()
         │  onSubmit("学 Python") → 弹窗关闭

Step 2  right-panel.tsx: useAnalysisPanel.startAnalysis("学 Python")
         │  abortRef.current?.abort()      ← 中止旧请求
         │  await createTask("学 Python")  ← POST /api/tasks
         │    │  API Route: src/app/api/tasks/route.ts
         │    │  requireAuth() → 验证 x-eazo-session header
         │    │  createTask(userId, "学 Python") → INSERT INTO tasks
         │    └─ 返回 { id: "uuid-xxx", title: "学 Python", ... }
         │  setEntries([新Entry头插])       ← 右侧面板新增标签页
         │  setFocusedId("uuid-xxx")
         │  runStream("uuid-xxx", "学 Python", "", true)

Step 3  SSE 请求：POST /api/tasks/uuid-xxx/analyze
         │  API Route: src/app/api/tasks/[id]/analyze/route.ts
         │
         │  AI 调用 #1（INTENT_PROMPT）
         │    appAi.chat({ model: "deepseek.v3.2", stream: true })
         │    → Eazo AI Gateway → deepseek.v3.2
         │    SSE 推送: phase=intent, delta×N, intent_done
         │    → 前端更新 entry.taskTitle = "掌握Python基础"
         │
         │  AI 调用 #2（RESOURCE_PROMPT）
         │    → SSE 推送: phase=search, delta×N, search_done
         │
         │  AI 调用 #3（PLAN_PROMPT）
         │    → SSE 推送: phase=plan, delta×N
         │
         │  AI 调用 #4（VALIDATE_PROMPT）
         │    → 若 pass=false: AI 调用 #5（修订）
         │    → SSE 推送: phase=validate [, phase=revise]
         │
         │  排期计算：computeNewTaskStartDate()
         │    getScheduledTasksByUser(userId)
         │    → SELECT * FROM tasks WHERE user_id = ?
         │    → 找出最末结束日 + 1
         │
         │  DB 写入：
         │    updateTaskTitleAndRawInput(id, "掌握Python基础", "学 Python")
         │    updateTaskStartDate(id, newStartDate)
         │    createSubtasks(id, subtaskItems[])
         │      → INSERT INTO subtasks × N
         │    updateTaskTotalDays(id, 14)
         │    updateTaskStatus(id, "done")
         │
         │  SSE 推送: phase=done, result{subtasks, totalDays, startDate}
         │
         ▼ 前端接收 result 事件
         │  getTask("uuid-xxx") → GET /api/tasks/uuid-xxx
         │    → SELECT tasks + subtasks WHERE id = ?
         │  entry.task = 完整任务数据
         │  右侧面板渲染子任务列表

Step 4  home-page.tsx: entries.phase 变为 "done"
         │  useEffect 检测 → loadSubtasks()
         │    GET /api/subtasks
         │      → SELECT subtasks JOIN tasks WHERE tasks.user_id = ?
         │    setSubtaskRows(data)
         ▼ 左侧列表渲染所有子任务行
```

---

## 1.5 完整目录树（每个文件职责说明）

```
autotask/
│
├── AGENTS.md                     # 平台技术规范，AI Agent 开发手册，必读
├── PRD.md                        # 产品需求文档（本项目生成）
├── reproduce.md                  # 本文件，开发者上手指南
├── README.md                     # 项目简要说明，含 env 变量表
├── package.json                  # 依赖声明 + npm scripts
├── bun.lock                      # Bun 锁定文件，保证依赖版本一致
├── tsconfig.json                 # TypeScript 编译配置
├── next.config.ts                # Next.js 构建配置
├── next-env.d.ts                 # Next.js 自动生成的 TS 类型声明（勿编辑）
├── drizzle.config.ts             # Drizzle ORM 配置（schema 路径/迁移路径/DB连接）
├── eslint.config.mjs             # ESLint 配置（继承 next/core-web-vitals + typescript）
├── postcss.config.mjs            # PostCSS 配置（启用 @tailwindcss/postcss）
├── components.json               # shadcn/ui 配置（style/路径别名/图标库）
├── vercel.json                   # Vercel 部署配置（构建命令/CSP header/Cron 定义）
├── tsconfig.tsbuildinfo          # TypeScript 增量编译缓存（勿提交，gitignore）
│
├── public/                       # 静态资源目录（Next.js 直接托管）
│   ├── file.svg                  # 模板默认 SVG 图标（未使用）
│   ├── globe.svg                 # 模板默认 SVG 图标（未使用）
│   ├── next.svg                  # Next.js logo（未使用）
│   ├── vercel.svg                # Vercel logo（未使用）
│   └── window.svg                # 模板默认 SVG 图标（未使用）
│
├── scripts/                      # 辅助脚本（Bun 直接执行，不参与 Next 构建）
│   ├── cleanup-demo.ts           # 一键清除模板 Demo 代码，还原为干净起点
│   └── sdk-watch.ts              # 本地开发 @eazo/sdk 时的 watch 同步工具
│
└── src/
    │
    ├── app/                      # Next.js App Router 根目录
    │   ├── layout.tsx            # 全局根布局：挂载 I18nProvider + EazoProvider + Toaster
    │   ├── page.tsx              # 主页路由（/）：渲染 <HomePage />（薄入口，仅 9 行）
    │   ├── globals.css           # 全局样式：Tailwind 导入 + 设计 Token + keyframes
    │   ├── error.tsx             # Next.js 全局错误边界：渲染 ErrorFallbackPage
    │   ├── not-found.tsx         # Next.js 404 页面：渲染 NotFoundPage
    │   ├── opengraph-image.tsx   # OG 图片生成（Eazo 部署时自动生成，含 Base64 icon）
    │   ├── twitter-image.tsx     # Twitter 卡片图片（re-export opengraph-image）
    │   │
    │   ├── history/
    │   │   └── page.tsx          # /history 路由：渲染 <HistoryPage />
    │   │
    │   ├── task/
    │   │   └── [id]/
    │   │       └── page.tsx      # /task/:id 路由：渲染 <TaskDetailPage taskId={id} />
    │   │
    │   └── api/                  # Next.js Route Handlers（服务端，全部需鉴权）
    │       ├── tasks/
    │       │   ├── route.ts      # GET /api/tasks（列表）+ POST /api/tasks（创建）
    │       │   └── [id]/
    │       │       ├── route.ts              # GET/PATCH/DELETE /api/tasks/:id
    │       │       ├── analyze/
    │       │       │   └── route.ts          # POST /api/tasks/:id/analyze（4段AI Pipeline SSE）
    │       │       └── subtasks/
    │       │           └── [subtaskId]/
    │       │               └── route.ts      # PATCH /api/tasks/:id/subtasks/:sid（切换完成）
    │       ├── subtasks/
    │       │   └── route.ts      # GET /api/subtasks（全量子任务+大任务JOIN）
    │       ├── user/
    │       │   └── profile/
    │       │       └── route.ts  # GET /api/user/profile（解密session+upsert用户到DB）
    │       ├── mcp/
    │       │   └── route.ts      # GET/POST/DELETE /api/mcp（MCP Streamable HTTP）
    │       └── notifications/
    │           ├── cron/
    │           │   └── daily-digest/
    │           │       └── route.ts  # GET（Vercel Cron每日17点推送任务提醒）
    │           └── test/
    │               └── route.ts      # POST（手动触发测试推送）
    │
    ├── components/               # React 组件（按功能模块分组）
    │   │
    │   ├── home/                 # 主仪表板相关组件
    │   │   ├── index.tsx         # barrel 导出：export { HomePage }
    │   │   ├── home-page.tsx     # 主仪表板页面（全局状态枢纽，左右双列布局）
    │   │   ├── new-task-input.tsx        # 新建任务输入弹窗
    │   │   ├── subtask-row.tsx           # 左侧子任务列表行（含属性标签）
    │   │   ├── subtask-detail-modal.tsx  # 子任务详情弹窗（含资源列表）
    │   │   ├── right-panel.tsx           # 右侧AI分析面板 + useAnalysisPanel Hook
    │   │   └── congrats-modal.tsx        # 全部完成庆祝弹窗
    │   │
    │   ├── task/                 # 任务详情页相关组件
    │   │   ├── gantt-chart.tsx           # 甘特图时间线可视化（可折叠）
    │   │   ├── task-detail-page-v2.tsx   # 任务详情页 v2（当前使用版本，含状态回退）
    │   │   ├── task-detail-page.tsx      # 任务详情页 v1（旧版，保留备用）
    │   │   ├── task-input-form.tsx       # 旧版任务输入表单（含内嵌分析面板，已被新版替代）
    │   │   └── analysis-panel.tsx        # 旧版分析进度面板（配合 task-input-form 使用）
    │   │
    │   ├── history/              # 历史任务页相关组件
    │   │   ├── index.tsx         # barrel 导出：export { HistoryPage }
    │   │   └── history-page.tsx  # 历史任务卡片宫格列表页
    │   │
    │   ├── errors/               # 错误页面组件
    │   │   ├── error-fallback-page.tsx  # 通用错误 fallback（含重试+返回首页）
    │   │   ├── error-page-shell.tsx     # 错误页外层壳（渐变背景+网格+语言切换）
    │   │   └── not-found-page.tsx       # 404 页面（含返回首页按钮）
    │   │
    │   ├── i18n/                 # 国际化相关组件
    │   │   ├── i18n-provider.tsx        # I18nextProvider 封装，挂载时应用本地 locale
    │   │   ├── language-switcher.tsx    # 语言切换下拉控件（参考实现）
    │   │   ├── locale-sync-effect.tsx   # 监听系统语言变化并同步 i18n
    │   │   └── locale-sync-effect.test.tsx  # LocaleSyncEffect 的测试文件
    │   │
    │   ├── user-profile/         # 用户信息相关组件
    │   │   ├── user-badge.tsx     # 用户头像/登录按钮徽章（含下拉 UserID 面板）
    │   │   └── user-sync-effect.tsx  # Mobile 登录后触发 DB upsert 的副作用组件
    │   │
    │   └── ui/                   # shadcn/ui 基础组件（勿直接修改）
    │       ├── button.tsx        # Button 组件（基于 @base-ui/react/button）
    │       ├── card.tsx          # Card/CardHeader/CardContent 等
    │       ├── dialog.tsx        # Dialog/DialogTrigger/DialogContent 等
    │       ├── input.tsx         # Input 输入框
    │       ├── label.tsx         # Label 标签
    │       ├── select.tsx        # Select 下拉选择
    │       ├── sheet.tsx         # Sheet 侧边抽屉
    │       ├── sonner.tsx        # Toaster 通知（包装 sonner 库）
    │       ├── tabs.tsx          # Tabs/TabsList/TabsTrigger/TabsContent
    │       └── textarea.tsx      # Textarea 多行输入
    │
    ├── i18n/                     # 国际化资源
    │   ├── index.ts              # i18next 初始化 + changeLocale/getResolvedLocale 等工具函数
    │   └── locales/
    │       ├── en-US.json        # 英文翻译字符串
    │       └── zh-CN.json        # 中文翻译字符串
    │
    ├── lib/                      # 服务端/共用业务逻辑
    │   ├── scheduler.ts          # 全局排期算法（Bloom验证/交错学习/窗口式排期）
    │   ├── eazo-ai-billing.ts    # App AI 客户端（Creator Proxy 模式 + BYOK 模式）
    │   │
    │   ├── auth/
    │   │   └── index.ts          # re-export requireAuth from @eazo/sdk/server
    │   │
    │   ├── api/                  # 客户端 API 封装（浏览器端，勿在服务端调用）
    │   │   ├── index.ts          # barrel 导出所有 api helpers
    │   │   ├── request.ts        # fetch 封装（注入 x-eazo-session + x-app-locale）
    │   │   ├── app-ai-request.ts # 处理 402 app_ai_unavailable 的 toast 逻辑
    │   │   ├── tasks.ts          # 任务相关 CRUD 客户端函数（全类型化）
    │   │   └── user-profile.ts   # fetchUserProfile() 客户端函数
    │   │
    │   ├── db/                   # 数据库层
    │   │   ├── client.ts         # Drizzle + postgres.js 实例（db 单例）
    │   │   ├── migrate.ts        # 执行迁移脚本入口（bun src/lib/db/migrate.ts）
    │   │   ├── add-raw-input.ts  # 历史补丁：为 tasks 表追加 raw_input 列
    │   │   ├── add-start-date.ts # 历史补丁：为 tasks 表追加 start_date 列
    │   │   ├── schema/
    │   │   │   ├── index.ts      # barrel 导出所有 schema
    │   │   │   ├── users.ts      # users 表 Drizzle schema + User 类型
    │   │   │   └── tasks.ts      # tasks + subtasks 表 schema + Task/Subtask 类型
    │   │   ├── queries/
    │   │   │   ├── index.ts      # barrel 导出所有 query 函数
    │   │   │   ├── users.ts      # getUserById/upsertUser/updateUser/deleteUser
    │   │   │   └── tasks.ts      # 任务/子任务全部 CRUD + JOIN 查询
    │   │   └── migrations/
    │   │       ├── 0000_lush_wind_dancer.sql  # 初始建表迁移 SQL
    │   │       └── meta/
    │   │           ├── 0000_snapshot.json     # Drizzle 迁移快照（自动生成）
    │   │           └── _journal.json          # 迁移执行日志（自动生成）
    │   │
    │   ├── i18n/                 # 服务端 i18n 工具
    │   │   ├── locale.ts         # localeCodes 常量 + normalizeLocale 函数
    │   │   ├── preference.ts     # localStorage locale 偏好读写
    │   │   ├── server-locale.ts  # 从 NextRequest header 解析 locale
    │   │   └── server-preference.ts  # 从 cookie 解析 locale（SSR 用）
    │   │
    │   └── mcp/
    │       └── server.ts         # MCP Server 工厂函数（当前为空壳，可注册 tools）
    │
    └── utils/
        └── utils.ts              # cn() 工具函数（clsx + tailwind-merge）
```

---

# 第二部分：环境搭建（精确到命令级别）

## 2.1 运行时安装

### Node.js（可选，Bun 包含兼容运行时）

本项目优先使用 Bun，但 Next.js 仍依赖 Node.js 兼容层。

```bash
# 验证 Node.js 版本（需要 >= 18.17.0）
node --version
# 如未安装，推荐使用 nvm：
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
```

### Bun（必须，版本 1.3.9）

```bash
# 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 验证版本
bun --version
# 应输出: 1.3.9 或兼容版本

# 如需安装特定版本：
curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.9"
```

## 2.2 数据库安装

本项目使用 **PostgreSQL 14+**。

### 本地开发（macOS）

```bash
# 通过 Homebrew 安装
brew install postgresql@14
brew services start postgresql@14

# 验证
psql --version
# psql (PostgreSQL) 14.x
```

### 本地开发（Ubuntu/Debian）

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 创建数据库

```bash
# 进入 psql
psql -U postgres

# 在 psql 内执行：
CREATE DATABASE autotask;
CREATE USER autotask_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE autotask TO autotask_user;
\q
```

### 验证连接

```bash
psql "postgresql://autotask_user:your_password@localhost:5432/autotask" -c "SELECT 1;"
# 应输出: 1
```

> **注意**：如果使用 Eazo 平台托管，DATABASE_URL 由平台自动注入，无需本地安装 PostgreSQL。

## 2.3 全局工具链

```bash
# 1. Bun（见上方安装步骤）

# 2. drizzle-kit（通过 bun 本地调用，无需全局安装）
#    项目内通过 "bun run db:generate" 等 scripts 调用

# 验证 drizzle-kit 可用：
cd autotask && bun run db:generate --help
```

## 2.4 依赖安装（完整 package.json）

```bash
cd autotask
bun install

# 如果 sharp 模块安装卡住（常见于部分 Linux 环境）：
SHARP_IGNORE_GLOBAL_LIBVIPS=1 bun install
```

**package.json 完整内容：**

```json
{
  "name": "nextjs-template",
  "version": "0.1.0",
  "private": true,
  "packageManager": "bun@1.3.9",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "cleanup:demo": "bun scripts/cleanup-demo.ts",
    "sdk:sync": "rm -rf node_modules/@eazo/sdk && mkdir -p node_modules/@eazo/sdk && cp ../eazo-sdk/sdk/package.json node_modules/@eazo/sdk/ && cp -r ../eazo-sdk/sdk/dist node_modules/@eazo/sdk/dist && cp -R ../eazo-sdk/sdk/node_modules node_modules/@eazo/sdk/node_modules",
    "sdk:dev": "(cd ../eazo-sdk/sdk && npm run build) && bun run sdk:sync",
    "sdk:watch": "bun run scripts/sdk-watch.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "bun src/lib/db/migrate.ts",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:drop": "drizzle-kit drop"
  },
  "dependencies": {
    "@base-ui/react": "^1.4.0",
    "@eazo/sdk": "0.22.5",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "dotenv": "^17.4.2",
    "drizzle-orm": "^0.45.2",
    "framer-motion": "^12.38.0",
    "i18next": "^25.8.14",
    "lucide-react": "^1.8.0",
    "next": "16.2.4",
    "next-themes": "^0.4.6",
    "postgres": "^3.4.9",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "react-i18next": "^16.5.6",
    "shadcn": "^4.3.1",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "drizzle-kit": "^0.31.10",
    "eslint": "^9",
    "eslint-config-next": "16.2.4",
    "happy-dom": "^20.11.1",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

---

# 第三部分：完整配置文件

## 3.1 .env（环境变量）

将 `.env.example` 复制为 `.env` 并填入真实值。**以下是 `.env.example` 的完整内容**（正式开发时将占位符替换为真实值）：

```bash
# ─── Eazo 平台认证 ─────────────────────────────────────────────────────
# Eazo 开发者私钥（64位十六进制字符串），用于服务端解密用户 session token
# 在 Eazo 开发者设置页面生成密钥对，绝对不要暴露给浏览器
EAZO_PRIVATE_KEY=your_eazo_private_key_here

# Eazo App ID，由根布局传入 <EazoProvider>
EAZO_APP_ID=your_eazo_app_id_here
NEXT_PUBLIC_EAZO_APP_ID=your_eazo_app_id_here

# ─── App AI 配置 ────────────────────────────────────────────────────────
# Eazo 官方 AI 代理地址（Creator Proxy 模式，AI 费用计入创作者积分）
EAZO_APP_AI_API_BASE=https://eazo.ai/creator

# AI 提供商模式：eazo = 使用 Eazo 官方代理；byok = 使用自带密钥
EAZO_AI_PROVIDER_MODE=eazo

# 默认 AI 模型（可选值见 AGENTS.md § 5.4）
EAZO_AI_MODEL_KEY=deepseek.v3.2

# AI 能力声明（当前仅用 text）
EAZO_AI_ENABLED=true
EAZO_AI_CAPABILITY=text
EAZO_AI_MODELS_JSON={"text": "deepseek.v3.2"}

# BYOK 模式下的自带 AI 提供商配置（eazo 模式下留空即可）
AI_PROVIDER_BASE_URL=
AI_PROVIDER_API_KEY=
AI_PROVIDER_MODEL=

# ─── Eazo 平台 API ─────────────────────────────────────────────────────
EAZO_API_BASE=https://eazo.ai
EAZO_PLATFORM_API_BASE=https://eazo.ai
NEXT_PUBLIC_EAZO_API_BASE=https://eazo.ai
NEXT_PUBLIC_EAZO_PLATFORM_API_BASE=https://eazo.ai

# ─── App 元信息 ────────────────────────────────────────────────────────
# 用于 <title> 和 meta description（layout.tsx 读取）
NEXT_PUBLIC_APP_TITLE=AutoTask
NEXT_PUBLIC_APP_DESCRIPTION=Input a goal and let AI automatically break it into subtasks with a Gantt schedule.

# ─── 数据库 ────────────────────────────────────────────────────────────
# PostgreSQL 连接串（Drizzle ORM 使用）
# 格式：postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL=postgresql://postgres:password@localhost:5432/autotask

# ─── Vercel Cron 鉴权 ──────────────────────────────────────────────────
# 每日推送 Cron 使用的 Bearer Token，与 Vercel 项目环境变量一致
# 生成命令：openssl rand -hex 32
CRON_SECRET=replace_with_a_long_random_string
```

## 3.2 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

**关键配置说明：**
- `"paths": { "@/*": ["./src/*"] }` — 路径别名，`@/lib/...` 等同于 `src/lib/...`
- `"strict": true` — 启用所有严格类型检查，不允许 `any` 泄漏
- `"noEmit": true` — TypeScript 只做类型检查，不生成 JS（由 Next.js/Turbopack 负责编译）
- `"moduleResolution": "bundler"` — 适配 Next.js + Turbopack 的模块解析规则

## 3.3 next.config.ts

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@eazo/sdk"],
  allowedDevOrigins: [
    "*.e2b.app",
    "localhost",
    "127.0.0.1",
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    // ... 172.17 到 172.31 的所有 RFC1918 段
  ],
};

export default nextConfig;
```

**关键配置说明：**
- `images.unoptimized: true` — 禁用 Next.js 图片优化（Eazo 平台已有 CDN 处理）
- `transpilePackages: ["@eazo/sdk"]` — 将 @eazo/sdk 纳入 Turbopack 的 watch 范围，SDK 变更时 HMR 自动生效
- `allowedDevOrigins` — 允许 e2b 沙盒、局域网等来源访问开发服务器（解决跨域 HMR 问题）

## 3.4 drizzle.config.ts

```typescript
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });

export default defineConfig({
  schema: "./src/lib/db/schema",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/myapp",
  },
});
```

**关键配置说明：**
- `schema` — Drizzle 读取 `src/lib/db/schema/` 目录下所有文件生成迁移
- `out` — 生成的迁移 SQL 文件保存在 `src/lib/db/migrations/`
- 使用 `dotenv` 手动加载 `.env`（drizzle-kit 在 CLI 执行时不自动读取 Next.js 的 env）

## 3.5 vercel.json

```json
{
    "framework": "nextjs",
    "buildCommand": "bun run build",
    "headers": [
        {
            "source": "/(.*)",
            "headers": [
                {
                    "key": "Content-Security-Policy",
                    "value": "frame-ancestors https: http:"
                }
            ]
        }
    ],
    "crons": [
        {
            "path": "/api/notifications/cron/daily-digest",
            "schedule": "0 17 * * *"
        }
    ]
}
```

**关键配置说明：**
- `buildCommand: "bun run build"` — 告诉 Vercel 用 Bun 而非 npm 执行构建
- `headers.Content-Security-Policy: "frame-ancestors https: http:"` — 允许 Eazo 平台在 iframe 中嵌入本 App
- `crons[0]` — 每天 UTC 17:00（北京时间次日 01:00）自动调用每日推送接口；Vercel 会注入 `Authorization: Bearer ${CRON_SECRET}` header

## 3.6 postcss.config.mjs

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

**说明**：Tailwind CSS v4 改为 PostCSS 插件方式集成，不再需要 `tailwind.config.js`，所有配置通过 `globals.css` 内的 `@theme` 指令完成。

## 3.7 eslint.config.mjs

```javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

## 3.8 components.json（shadcn/ui）

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/utils/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}
```

**说明**：shadcn/ui 组件通过 `bunx shadcn add <component>` 命令添加。`aliases.utils` 指向 `@/utils/utils`（而非默认的 `@/lib/utils`），注意新同事添加组件后需检查生成的导入路径。

---

# 第四部分：逐源文件完整代码与讲解

## 4.1 src/utils/utils.ts

**职责**：提供 `cn()` 工具函数，合并 Tailwind CSS 类名，自动解决冲突。

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**关键逻辑**：`clsx` 将条件类名展开为字符串，`twMerge` 处理 Tailwind 规则冲突（如 `p-2 p-4` 只保留 `p-4`）。

**对外接口**：`cn(...classValues)` → `string`

**依赖**：`clsx`、`tailwind-merge`

---

## 4.2 src/lib/auth/index.ts

**职责**：从 `@eazo/sdk/server` re-export 服务端鉴权函数，作为项目内的统一认证入口。

```typescript
export { requireAuth } from "@eazo/sdk/server";
export type { User, AuthResult } from "@eazo/sdk/server";
```

**关键逻辑**：`requireAuth(request: NextRequest)` 解密 `x-eazo-session` header，返回 `{ ok: true, user }` 或 `{ ok: false, response: Response(401) }`。所有 API Route 第一行必须调用它。

**对外接口**：
- `requireAuth(request)` → `{ ok: true, user: User } | { ok: false, response: Response }`
- `User` 类型：`{ id, email, name, avatarUrl }`

---

## 4.3 src/lib/db/client.ts

**职责**：创建 Drizzle ORM 单例实例，整个项目所有数据库操作都通过 `db` 这一个对象。

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

**关键逻辑**：
- `config({ path: ".env" })` — 在 Next.js 服务端代码中手动加载 `.env`，确保 `DATABASE_URL` 在编译期和运行期都可用
- `postgres(url)` — 创建 postgres.js 连接池（默认最大 10 个连接）
- `drizzle(client)` — 在连接池上套一层 Drizzle 查询构建器

**对外接口**：`db`（Drizzle 实例，所有 queries 文件导入这个）

---

## 4.4 src/lib/db/schema/users.ts

**职责**：定义 `users` 表的 Drizzle schema，以及 `User` TypeScript 类型。

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

**设计说明**：`id` 是 Eazo 平台注入的用户 ID（字符串，非 UUID），最长 128 字符。`InferSelectModel` 从 schema 自动推导出 SELECT 查询的返回类型。

---

## 4.5 src/lib/db/schema/tasks.ts

**职责**：定义 `tasks` 和 `subtasks` 两张表的 schema 及类型。

```typescript
import type { InferSelectModel } from "drizzle-orm";
import {
  boolean, index, integer, pgTable, text,
  timestamp, uuid, varchar,
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
    rawInput: text("raw_input"),
    startDate: timestamp("start_date", { withTimezone: true }),
    status: text("status").notNull().default("active"),
    totalDays: integer("total_days").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    durationDays: integer("duration_days").notNull().default(1),
    startDay: integer("start_day").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    resources: text("resources"),   // JSON: Resource[]
    topic: text("topic"),
    urgency: integer("urgency"),
    importance: integer("importance"),
    keywords: text("keywords"),     // JSON: string[]
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    taskIdIdx: index("subtasks_task_id_idx").on(table.taskId),
  })
);

export type Task = InferSelectModel<typeof tasks>;
export type Subtask = InferSelectModel<typeof subtasks>;
```

**设计要点**：
- `rawInput` 永久保存用户原始输入，AI 重新生成时不覆盖
- `startDay` 是相对偏移天数（非绝对日期），子任务实际日期 = `tasks.startDate + startDay`
- `resources`/`keywords` 存 JSON 字符串，查询时用 `JSON.parse()` 解析
- 两张表都设置 `ON DELETE CASCADE`，删大任务自动清理子任务

---

## 4.6 src/lib/db/queries/users.ts

**职责**：封装 `users` 表的所有数据库操作函数。

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

**关键逻辑**：`upsertUser` 使用 `ON CONFLICT DO UPDATE`，每次登录都会更新用户的 name/email/avatarUrl，保持 DB 与 Eazo 平台数据同步。

---

## 4.7 src/lib/db/queries/tasks.ts（核心查询文件）

**职责**：封装任务和子任务的所有 CRUD + JOIN 查询，是整个应用数据访问的核心层。完整代码见源文件，以下重点讲解关键函数。

**`getSubtasksWithTaskByUser`** — 左侧列表的数据来源：
```typescript
// SELECT subtasks.*, tasks.title, tasks.raw_input, tasks.start_date, tasks.status
// FROM subtasks INNER JOIN tasks ON subtasks.task_id = tasks.id
// WHERE tasks.user_id = $1
// ORDER BY tasks.created_at DESC, subtasks.sort_order
```
返回 `SubtaskWithTask[]`，每条子任务附带父任务信息，前端直接渲染无需二次查询。

**`getTasksWithSubtasksByUser`** — 右侧面板历史恢复的数据来源：
```typescript
// 两步查询：
// 1. SELECT * FROM tasks WHERE user_id = $1
// 2. SELECT * FROM subtasks WHERE task_id IN (...)
// 内存分组为 Map<taskId, Subtask[]>，避免 N+1 查询
```

**`getScheduledTasksByUser`** — 排期算法的输入：
```typescript
// SELECT id, start_date, total_days, created_at, status FROM tasks WHERE user_id = $1
// 只取排期相关字段，不加载子任务，减少数据传输
```

**对外接口**（完整列表）：
- `getTasksByUser(userId)` → `TaskWithProgress[]`（含完成计数）
- `getSubtasksWithTaskByUser(userId)` → `SubtaskWithTask[]`
- `getTaskById(id)` → `Task | null`
- `createTask(userId, title)` → `Task`
- `updateTaskTitleAndRawInput(id, title, rawInput)` → `void`
- `updateTaskStartDate(id, startDate)` → `void`
- `updateTaskTotalDays(id, totalDays)` → `void`
- `updateTaskStatus(id, status)` → `void`
- `deleteTask(id)` → `void`（级联删除子任务）
- `getSubtasksByTask(taskId)` → `Subtask[]`
- `createSubtasks(taskId, items[])` → `Subtask[]`
- `toggleSubtask(id, completed)` → `void`
- `getScheduledTasksByUser(userId)` → 排期摘要数组
- `getTasksWithSubtasksByUser(userId)` → `TaskWithSubtasksFull[]`

---

## 4.8 src/lib/scheduler.ts（排期算法核心）

**职责**：实现全局智能排期算法，基于 Bloom 认知分类法、交错学习、Deep Work 研究设计。

**关键常量**：
```typescript
export const MAX_SUBTASKS_PER_DAY = 3;      // 每天最多3个子任务（约2-4小时深度工作）
export const MAX_SAME_TOPIC_PER_DAY = 1;    // 同主题每天最多1次（交错学习原则）
export const SCHEDULING_WINDOW_DAYS = 7;    // 超过7天间隙则新任务从今天开始
export const REVIEW_INTERVAL_DAYS = 5;      // 每5天学习后建议插入复习节点
```

**核心函数 `computeNewTaskStartDate`**：
```typescript
// 找出所有活跃任务的最末结束日
// 若最末日距今超过 7 天 → 直接从今天开始（窗口式排期）
// 否则 → 从最末日 +1 天开始（接续排期）
```

**`validateBloomSequence(levels)`**：
```typescript
// 验证 Bloom 层级序列是否整体渐进
// 允许小幅回落（复盘），但超过 2 级倒退算违规
// 违规率 > 30% 返回 false，触发 AI 修订循环
```

**`suggestReviewNodes(subtasks)`**：
```typescript
// 参考 SM-2 间隔重复：每学习 5 天内容后建议复习
// 返回建议插入复习节点的 startDay 列表
```

**`findNextAvailableDay(earliestStart, topic, slots)`**：
```typescript
// 从 earliestStart 向后逐日查找满足以下条件的日期：
// 1. 当天子任务总数 < MAX_SUBTASKS_PER_DAY（3个）
// 2. 当天同主题子任务数 < MAX_SAME_TOPIC_PER_DAY（1个）
// 最大搜索 60 天防止死循环
```

---

## 4.9 src/lib/eazo-ai-billing.ts（AI 客户端）

**职责**：封装 App AI 调用，支持 Creator Proxy（eazo 模式）和 BYOK（自带密钥）两种模式，对外暴露与 OpenAI SDK 兼容的 `appAi.chat()` 接口。

**两种模式**：

| 模式 | 触发条件 | 调用地址 | 费用 |
|---|---|---|---|
| `eazo`（默认） | `EAZO_AI_PROVIDER_MODE=eazo` | `EAZO_APP_AI_API_BASE/api/app-ai/chat` | 计入 Creator 积分 |
| `byok` | `EAZO_AI_PROVIDER_MODE=byok` | `AI_PROVIDER_BASE_URL/chat/completions` | 计入自带 API Key |

**关键函数**：
```typescript
// 非流式调用
const result = await appAi.chat({
  model: "deepseek.v3.2",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(result.choices[0].message.content);

// 流式调用（SSE）
const stream = await appAi.chat({
  model: "deepseek.v3.2",
  messages: [...],
  stream: true,
  max_tokens: 2500,
});
for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content ?? "";
}
```

**错误处理**：`AppAIUnavailableError`（积分耗尽/服务不可用）会在服务端抛出，客户端的 `AppAIClientUnavailableError` 对应触发 toast 提示。

---

## 4.10 src/lib/api/request.ts 和 app-ai-request.ts

**职责**：客户端 fetch 封装，自动注入认证 header 并统一处理 402 错误。

**request.ts**（所有 API 调用的入口）：
```typescript
"use client";
// 使用方式：
const res = await request("/api/tasks", { method: "POST", body: JSON.stringify(data) });
// 自动添加:
//   x-eazo-session: await auth.getSessionHeader()
//   x-app-locale: getResolvedLocale()
```

**app-ai-request.ts**（402 专项处理）：
```typescript
// 当 API 返回 402 且 code === "app_ai_unavailable" 时：
// 1. 弹出 Sonner toast："AI 功能暂时不可用..."
// 2. 抛出 AppAIClientUnavailableError
// 调用方 catch 到此错误后直接 return，不再显示额外错误
```

---

## 4.11 src/lib/api/tasks.ts（客户端任务 API）

**职责**：封装所有任务相关的客户端 fetch 函数，全部有 TypeScript 类型标注。

```typescript
// 所有函数签名：
getTasks()                        → Promise<TaskWithProgress[]>
getTasksWithSubtasks()            → Promise<TaskWithSubtasks[]>
getSubtasksWithTask()             → Promise<SubtaskWithTask[]>
getTask(id: string)               → Promise<TaskWithSubtasks>
createTask(title: string)         → Promise<Task>
updateTaskStatusApi(id, status)   → Promise<void>
deleteTask(id: string)            → Promise<void>
toggleSubtask(taskId, subtaskId, completed) → Promise<void>
```

**SubtaskWithTask 类型**（左侧列表行数据）：
```typescript
interface SubtaskWithTask extends Subtask {
  taskTitle: string;
  taskRawInput: string | null;
  taskStartDate: string | null;  // ISO 字符串（来自 JSON 序列化）
  taskStatus: string;
  taskCreatedAt: string;
}
```

---

## 4.12 src/app/api/user/profile/route.ts

**职责**：解密 session、返回用户信息、同时 upsert 到本地 DB（非阻塞）。

```typescript
// GET /api/user/profile
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;    // 401

  // 非阻塞 upsert（不等待 DB，避免增加响应延迟）
  upsertUser({ id: user.id, email, name, avatarUrl }).catch(console.error);

  return NextResponse.json({ ok: true, user });
}
```

**触发时机**：Web 登录后 SDK 自动调用；Mobile 登录后由 `UserSyncEffect` 触发。

---

## 4.13 src/app/api/tasks/route.ts

**职责**：任务列表查询和创建。

```typescript
// GET /api/tasks          → TaskWithProgress[]（含完成计数）
// GET /api/tasks?withSubtasks=1  → TaskWithSubtasksFull[]（含子任务数组）
// POST /api/tasks { title }  → Task（201）
```

**`withSubtasks=1` 的用途**：右侧面板登录后历史恢复，一次请求拿到所有任务+子任务，避免 N 次查询。

---

## 4.14 src/app/api/tasks/[id]/route.ts

**职责**：单任务的查询、状态更新、删除。

```typescript
// GET    /api/tasks/:id  → Task & { subtasks: Subtask[] }
// PATCH  /api/tasks/:id  { status: "done"|"active" }  → { ok: true }
// DELETE /api/tasks/:id  → { ok: true }（级联删除子任务）
```

**安全检查**：所有操作都验证 `task.userId === auth.user.id`，防止越权访问他人任务。

---

## 4.15 src/app/api/tasks/[id]/subtasks/[subtaskId]/route.ts

**职责**：切换子任务完成状态。

```typescript
// PATCH /api/tasks/:id/subtasks/:subtaskId  { completed: boolean }
// 先验证父任务归属，再更新子任务
await toggleSubtask(subtaskId, completed);
```

---

## 4.16 src/app/api/subtasks/route.ts

**职责**：返回当前用户所有子任务（附带大任务信息），左侧列表的唯一数据来源。

```typescript
// GET /api/subtasks  → SubtaskWithTask[]
// SELECT subtasks.*, tasks.title, tasks.start_date, ...
// FROM subtasks INNER JOIN tasks ON subtasks.task_id = tasks.id
// WHERE tasks.user_id = $1
```

---

## 4.17 src/app/api/tasks/[id]/analyze/route.ts（Pipeline 核心）

**职责**：4 阶段 AI Pipeline，通过 SSE 实时推送进度，最终写入 DB 并计算排期。

**4 个 Prompt 常量**：
- `INTENT_PROMPT` — 分析目标，输出 task_name / topic / urgency / importance / bloom_target_level / prior_knowledge_level
- `RESOURCE_PROMPT` — 搜索资源，输出 resources[]（含 suitable_for / learning_phase）
- `PLAN_PROMPT` — 生成子任务，强制 Bloom 层级渐进，工期 1-5 天
- `VALIDATE_PROMPT` — 五维百分制评审，分数 < 75 触发修订

**SSE 事件类型**：
```
phase       → { step: string, label: string }  当前阶段变化
delta       → { stage: string, content: string }  AI token 流
intent_done → { taskName, domain, topicCategory, priorLevel, bloomTarget }
search_done → { resourceCount: number }
result      → { subtasks, totalDays, taskName, rawInput, startDate, reviewNodes }
error       → { message: string }
```

**排期写入流程**：
```typescript
// 1. 更新任务名称
await updateTaskTitleAndRawInput(id, taskName, rawInput);

// 2. 计算新任务起始日（窗口式接续排期）
const newStartDate = computeNewTaskStartDate(otherTasks, today);
await updateTaskStartDate(id, newStartDate);

// 3. 按 Bloom 层级排序子任务
const sorted = [...subtasks].sort((a, b) => (a.bloom_level ?? 2) - (b.bloom_level ?? 2));

// 4. 交错排期（每日容量 + 同主题限制）
for (const s of sorted) {
  const actualDate = findNextAvailableDay(earliestDate, topicCategory, dailySlots);
  registerDailySlot(dateStr, topicCategory, dailySlots);
}

// 5. 批量插入子任务
await createSubtasks(id, subtaskItems);
await updateTaskTotalDays(id, totalDays);
await updateTaskStatus(id, "done");
```

---

## 4.18 src/app/api/notifications/cron/daily-digest/route.ts

**职责**：Vercel Cron 每日推送任务提醒（UTC 17:00）。

```typescript
// GET /api/notifications/cron/daily-digest
// 鉴权：Bearer ${CRON_SECRET}（Vercel 自动注入）
// 逻辑：
//   统计 status="active" 的任务数
//   有任务 → 推送"你有 N 个进行中的任务"
//   无任务 → 推送"来新建一个目标吧"
await notifications.publish({ title, body, data });
```

---

## 4.19 src/app/api/mcp/route.ts

**职责**：暴露 MCP Streamable HTTP 协议端点，让 AI Agent 可以调用任务 CRUD 工具。

```typescript
// GET/POST/DELETE /api/mcp
// 无状态模式（sessionIdGenerator: undefined）→ 适合 Vercel serverless
// 每次请求独立建立 McpServer，按 userId 隔离
const server = buildMcpServer(auth.user.id);
await server.connect(transport);
return transport.handleRequest(request);
```

目前 `buildMcpServer` 是空壳（无注册工具），可在 `src/lib/mcp/server.ts` 中按需添加。

---

## 4.20 src/components/home/home-page.tsx（状态枢纽）

**职责**：主仪表板，管理左侧子任务列表和右侧 AI 面板的所有状态，协调跨区域联动。

**核心 state**：
```typescript
subtaskRows:         SubtaskWithTask[]      // 左侧列表数据
timeFilter:          "today"|"tomorrow"|"week"|"all"
detailSubtask:       SubtaskWithTask|null   // 详情弹窗
congrats:            CongratsData|null       // 庆祝弹窗
highlightedSubtaskId: string|null           // 高亮行（3秒后清除）
showInput:           boolean                // 新建输入弹窗
```

**关键函数**：
- `handleToggleSubtask` — 乐观更新左侧+弹窗+右侧，检测全部完成触发庆祝弹窗
- `handleJumpToSubtask` — 右侧点击子任务 → 计算归属 filter → 切换筛选 → 高亮 3 秒
- `handleDeleteTask` — 删除 DB + 过滤左侧列表 + 移除右侧面板标签页

**useEffect 联动**：
```typescript
// 登录后加载左侧列表
useEffect(() => { if (user) loadSubtasks(); }, [user]);

// 登录后恢复右侧面板历史
useEffect(() => { if (user) getTasksWithSubtasks().then(hydrateFromDB); }, [user]);

// 分析完成后刷新左侧
useEffect(() => {
  if (entries.some(e => e.stream.phase === "done") && user) loadSubtasks();
}, [entries.map(e => e.stream.phase).join(",")]);
```

---

## 4.21 src/components/home/right-panel.tsx（SSE 状态机）

**职责**：右侧 AI 分析面板 UI + `useAnalysisPanel` Hook（SSE 流管理）。

**`useAnalysisPanel` Hook 对外接口**：
```typescript
{
  entries:       AnalysisEntry[]   // 所有任务面板数据
  focusedId:     string|null       // 当前聚焦的任务 ID
  setFocusedId:  (id) => void
  startAnalysis: (goal) => void    // 新建任务 → 创建DB记录 → 开始SSE
  regenAnalysis: (id, adj) => void // 重新生成（中止旧SSE，重置状态）
  removeEntry:   (id) => void      // 移除面板标签（不删DB）
  hydrateFromDB: (tasks) => void   // 登录后历史恢复（去重合并）
  focusTask:     (id) => void      // 聚焦某任务
}
```

**SSE 解析循环**（关键）：
```typescript
let buf = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";          // 保留不完整的最后一行，等待下个 chunk
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const msg = JSON.parse(line.slice(6));
    // 按 msg.event 分发处理
  }
}
```

---

## 4.22 src/components/home/subtask-row.tsx

**职责**：左侧列表的单行组件，渲染子任务标题、日期、属性标签，处理点击/勾选/删除事件。

**日期计算函数**（对外导出，home-page.tsx 也使用）：
```typescript
// 计算子任务实际日期区间（用于时间筛选）
export function getSubtaskActualDates(row: SubtaskWithTask): { start: Date; end: Date } | null
// 计算显示用的日期字符串 "8/14 - 8/16"
export function getSubtaskDateRange(row: SubtaskWithTask): string | null
```

**事件层级**（重要，避免误操作）：
```
div[onClick = onOpen + onSelect]    ← 点击行打开详情弹窗 + 聚焦右侧
  button[✓, e.stopPropagation()]   ← 只勾选，不打开弹窗
  button[×, e.stopPropagation()]   ← 只删除大任务，不打开弹窗
```

---

## 4.23 src/components/home/subtask-detail-modal.tsx

**职责**：子任务详情弹窗，展示完整属性、描述、资源列表，提供完成/跳转操作。

**资源点击逻辑**：
```typescript
// 有 url → window.open(url, "_blank", "noopener")
// 无 url 但有 searchQuery → window.open("google.com/search?q=" + encoded)
// 两者都无 → cursor: default，不可点击
```

---

## 4.24 src/components/home/congrats-modal.tsx

**职责**：全部完成庆祝弹窗，展示完成的子任务列表和主题标签，提供「进一步学习」按钮。

**触发时机**：`handleToggleSubtask` 检测到某大任务下所有子任务全部完成时调用 `setCongrats(...)`。

---

## 4.25 src/components/task/task-detail-page-v2.tsx（当前使用版本）

**职责**：`/task/:id` 页面，展示单个任务的完整子任务列表 + 甘特图，支持状态双向切换。

**与 v1 的区别**：v2 增加了取消勾选时的状态回退逻辑：
```typescript
// 取消勾选后，若大任务原来是 done，回退为 active
if (!next && task.status === "done") {
  await updateTaskStatusApi(taskId, "active");
}
```

---

## 4.26 src/components/task/gantt-chart.tsx

**职责**：甘特图时间线可视化，支持折叠模式和入场动画。

**比例计算**：
```typescript
leftPct  = (s.startDay / totalDays) * 100    // 条的起始位置（百分比）
widthPct = Math.max((s.durationDays / totalDays) * 100, 4)  // 最小 4% 防止消失
```

**动画**：
```css
animation: ganttGrow 0.9s cubic-bezier(.2,.8,.2,1) {i * 0.12}s both;
/* scaleX(0) → scaleX(1)，逐条延迟 0.12s 入场 */
```

---

## 4.27 src/components/history/history-page.tsx

**职责**：历史任务卡片宫格，点击跳转详情页，hover 显示删除按钮。

**删除防跳转**：
```typescript
e.stopPropagation(); e.preventDefault();   // 阻止 <Link> 跳转
await deleteTask(id);
setTasks(prev => prev.filter(t => t.id !== id));  // 乐观更新
```

---

## 4.28 src/components/user-profile/user-sync-effect.tsx

**职责**：仅在 Eazo Mobile WebView 中，登录后主动触发 `GET /api/user/profile` 以 upsert 用户到 DB。

**原因**：Web 平台的 SDK 会自动调用 profile；Mobile 通过 bridge 直接注入 session，不走 SDK 自动流，需要这个 Effect 手动补触发。

```typescript
// 只在 platform === "mobile" 且 authenticated 时触发
// 用 syncedUserId ref 防止重复触发
```

---

## 4.29 src/components/i18n/i18n-provider.tsx 和 locale-sync-effect.tsx

**i18n-provider.tsx**：包裹全局 `I18nextProvider`，挂载时读取 localStorage 偏好并应用。

**locale-sync-effect.tsx**：监听浏览器 `languagechange` 事件（用户切换系统语言时），自动同步 i18n 语言。

---

## 4.30 src/lib/db/migrate.ts

**职责**：执行所有待执行的 Drizzle 迁移 SQL 文件。

```bash
# 执行命令：
bun src/lib/db/migrate.ts
# 等同于：bun run db:migrate
```

**执行逻辑**：读取 `src/lib/db/migrations/meta/_journal.json` 确定哪些迁移已执行，只运行新增的 SQL 文件。

---

## 4.31 src/lib/db/migrations/0000_lush_wind_dancer.sql（初始迁移）

**职责**：项目初始建表 SQL，创建 users / tasks / subtasks 三张表及所有索引。

> **注意**：这是 Drizzle 自动生成的迁移文件（`bun run db:generate`），不要手动编辑。如需修改表结构，应修改 schema 文件后重新 generate。

---

## 4.32 src/lib/db/add-raw-input.ts 和 add-start-date.ts（历史补丁）

**职责**：这两个文件是项目迭代过程中临时执行的「在线 ALTER TABLE」脚本，用于向已有 DB 追加列，避免迁移文件冲突。

**add-raw-input.ts**：
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS raw_input TEXT;
```

**add-start-date.ts**：
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
```

> **重要**：这两个脚本**已经执行完毕**，不需要再次运行。新部署的空数据库直接运行 `bun run db:migrate` 即可（初始迁移已经包含这些列）。如果接手的是已有数据的旧数据库，且这两列还不存在，才需要运行这两个脚本。

---

# 第五部分：启动与验证

## 5.1 安装依赖

```bash
cd /home/user/autotask   # 或你的项目目录

# 使用 Bun 安装（必须，不要用 npm/yarn）
bun install

# 如果 sharp 安装卡住（Linux 常见）：
SHARP_IGNORE_GLOBAL_LIBVIPS=1 bun install

# 验证依赖安装成功：
ls node_modules/@eazo/sdk   # 应能看到 dist/ 目录
```

## 5.2 配置环境变量

```bash
# 复制模板
cp .env.example .env

# 编辑 .env，填入以下必填项：
# DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB
# EAZO_APP_ID=你的App ID（从 Eazo 开发者控制台获取）
# EAZO_PRIVATE_KEY=你的私钥（64位十六进制）
# EAZO_APP_AI_API_BASE=https://eazo.ai/creator
# CRON_SECRET=随机字符串（openssl rand -hex 32）
```

## 5.3 初始化数据库

```bash
# 方法一：执行 Drizzle 迁移（推荐，新空数据库使用）
bun run db:migrate
# 输出：⏳ Running migrations...  ✅ Migrations completed in Xms

# 方法二：直接 push schema（跳过迁移历史，适合开发环境快速重置）
bun run db:push

# 验证表已创建：
psql "$DATABASE_URL" -c "\dt"
# 应看到：users / tasks / subtasks 三张表

# 可视化查看（可选）：
bun run db:studio
# 打开 https://local.drizzle.studio
```

## 5.4 构建命令

```bash
# 类型检查（不生成代码）
bun run build
# 期望输出：
# ✓ Compiled successfully in Xs
# ✓ TypeScript 无报错
# 14 条路由正常生成

# Lint 检查
bun run lint
# 期望：无错误输出
```

## 5.5 启动命令

### 开发模式（热重载，推荐日常开发）

```bash
bun dev
# 输出：
#  ▲ Next.js 16.2.4 (Turbopack)
#  - Local:        http://localhost:3000
#  - Network:      http://192.168.x.x:3000
#  ✓ Ready in Xs
```

### 生产模式

```bash
# 先构建
bun run build

# 再启动
bun start
# 输出：
# ▲ Next.js 16.2.4
# - Local:        http://localhost:3000
#  ✓ Started
```

## 5.6 验证成功的标准

### 开发模式验证

1. 打开 `http://localhost:3000`
2. 看到：Header 显示「AutoTask」 + 「订单式任务系统原型」
3. 左侧显示「登录后可查看和管理任务」+ 蓝色「登录」按钮
4. 右侧显示 AI 分析面板空状态（心电图图标）

### 登录验证

5. 点击「登录」按钮 → SDK 弹出登录 UI
6. 完成登录（Google/邮箱）
7. 页面刷新，Header 右侧出现「退出」按钮
8. 左侧列表为空（新账号无任务）但无报错

### 新建任务验证

9. 点击「+ 新建任务」
10. 输入「学 Python」→ 按 Enter
11. 弹窗关闭，右侧面板新增「学 Python」标签页
12. 右侧显示 Pipeline 进度（🧠 解析学习意图 → 🔍 → 📋 → ✅）
13. 约 30-60 秒后显示子任务列表 + 甘特图
14. 左侧列表出现子任务行（含日期标签、属性标签）

### 数据库验证

```bash
# 验证用户已写入：
psql "$DATABASE_URL" -c "SELECT id, email FROM users LIMIT 5;"

# 验证任务已写入：
psql "$DATABASE_URL" -c "SELECT id, title, status, total_days FROM tasks;"

# 验证子任务已写入：
psql "$DATABASE_URL" -c "SELECT task_id, title, start_day, duration_days FROM subtasks;"
```

---

# 第六部分：常见坑点与注意事项

## 6.1 环境变量相关

**坑 1：`DATABASE_URL` 未设置导致连接 localhost 失败**
```
错误：connect ECONNREFUSED 127.0.0.1:5432
原因：.env 未配置，代码 fallback 到 localhost:5432
解决：确认 .env 存在且 DATABASE_URL 填写正确
```

**坑 2：`EAZO_APP_ID` 未设置导致 AI 调用 AppAIUnavailableError**
```
错误：AI 功能暂时不可用
原因：eazo-ai-billing.ts 检查 EAZO_APP_ID，为空时直接抛错
解决：在 .env 中设置 EAZO_APP_ID=你的App ID
```

**坑 3：`EAZO_PRIVATE_KEY` 格式错误**
```
错误：API 返回 401 Unauthorized
原因：私钥必须是 64 位十六进制字符串（无空格无前缀）
正确：EAZO_PRIVATE_KEY=240745db9f71467a...（64字符）
错误：EAZO_PRIVATE_KEY=0x240745db...（不要加0x前缀）
```

**坑 4：Vercel 部署时 `CRON_SECRET` 未配置**
```
错误：GET /api/notifications/cron/daily-digest 返回 500
原因：CRON_SECRET 环境变量为空
解决：在 Vercel 项目设置 → Environment Variables 中添加
```

## 6.2 数据库相关

**坑 5：迁移文件与实际 DB 结构不同步**
```
症状：ORM 报错某列不存在，或 SELECT 返回字段缺失
背景：tasks 表的 raw_input / start_date 列是通过 add-raw-input.ts
      和 add-start-date.ts 手动追加的，不在初始迁移文件中
解决（旧数据库）：
  bun src/lib/db/add-raw-input.ts
  bun src/lib/db/add-start-date.ts
解决（新数据库）：
  直接 bun run db:migrate，初始迁移已包含所有列
```

**坑 6：`bun run db:generate` 报找不到 DATABASE_URL**
```
原因：drizzle-kit 执行时不会自动读取 .env，但 drizzle.config.ts
      已调用 config({ path: ".env" }) 手动加载，检查 .env 文件路径
解决：确保在项目根目录执行命令，且 .env 在根目录
```

**坑 7：PostgreSQL 版本不支持 `gen_random_uuid()`**
```
错误：function gen_random_uuid() does not exist
原因：PostgreSQL 13 以下需要手动启用 pgcrypto 扩展
解决：升级到 PostgreSQL 14+，或执行 CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## 6.3 依赖与版本相关

**坑 8：使用 npm/yarn 安装导致 peerDeps 报错**
```
原因：项目固定 packageManager: "bun@1.3.9"，某些依赖解析行为与 npm 不同
解决：始终使用 bun install，不要混用 npm/yarn
```

**坑 9：@eazo/sdk 版本不匹配**
```
原因：@eazo/sdk 是 0.22.5 固定版本，不能使用 ^ 允许升级
      因为 SDK 内部实现了 ECC/AES session 解密，版本不一致会导致认证失败
解决：不要修改 package.json 中的 @eazo/sdk 版本号
```

**坑 10：React 19 与部分旧组件库不兼容**
```
症状：安装某个第三方组件库时报 peerDeps 冲突（requires React ^18）
原因：项目使用 React 19.2.4，部分库仍声明 peerDeps React ^18
解决：使用 bun add --legacy-peer-deps <package>，或等待库升级
```

## 6.4 AI Pipeline 相关

**坑 11：AI 分析超时（30 秒）**
```
症状：Pipeline 卡在某个阶段，最终出现错误提示
原因：单次 analyze 请求最多 5 次 AI 调用，每次最多 2500 tokens，
      总耗时可能超过 Vercel Hobby 的 60 秒函数超时
解决：升级 Vercel 计划（Pro 支持 300 秒）；或在 next.config.ts 设置
      maxDuration: 300（需要 Pro 计划）
```

**坑 12：AI 返回非 JSON 导致 parseJson() 返回 null**
```
症状：Pipeline 走完但子任务为空，报"AI 未生成有效计划"
原因：模型偶尔在 JSON 外面加 markdown 代码块（```json ... ```）
      parseJson() 用正则 /\{[\s\S]*\}/ 提取，遇到数组 [] 会失败
解决（已有防护）：Prompt 中写了"不要加 markdown 代码块"
      如仍失败：重试（↺ 重新生成），或调整 Prompt
```

**坑 13：SSE 流在 Safari 上表现异常**
```
症状：右侧面板长时间空白，偶尔一次性显示所有进度
原因：Safari 对 ReadableStream 的 getReader() 实现有差异
解决：当前代码使用标准 ReadableStream API，Safari 14+ 应支持
      遇到问题可检查 Safari 版本，建议 Safari 15+
```

## 6.5 开发 vs 生产环境差异

**差异 1：环境变量来源**
```
开发环境：从项目根目录的 .env 文件读取（dotenv）
生产环境（Vercel）：从 Vercel 项目设置的 Environment Variables 读取
注意：NEXT_PUBLIC_ 前缀的变量会打包进客户端 JS，其他的只在服务端可用
```

**差异 2：Cron 只在 Vercel 上运行**
```
开发环境：vercel.json 的 crons 配置不生效
本地测试推送：POST /api/notifications/test（需要已登录）
生产环境：Vercel 每天 UTC 17:00 自动调用
```

**差异 3：数据库连接数**
```
开发环境：postgres.js 默认 10 个连接，本地 PG 够用
Vercel Serverless：每个函数实例都会创建新连接，
      高并发时可能超出 PG 连接数限制（默认 100）
解决：使用连接池服务（如 PgBouncer 或 Neon Serverless）
```

**差异 4：`next dev` vs `next start`**
```
next dev（Turbopack）：快速热重载，不做生产优化
next start：必须先 next build，运行生产优化后的代码
注意：build 时 TypeScript 严格检查，dev 时可能容忍更多错误
```

**差异 5：Content-Security-Policy**
```
vercel.json 配置了 frame-ancestors https: http:
这允许 Eazo 平台将 App 嵌入 iframe
本地开发如需测试 iframe 嵌入，需要手动在浏览器允许
```

## 6.6 代码规范注意事项

**规范 1：AI 调用必须在服务端**
```
❌ 错误：在 React 组件中 import appAi 并调用
✅ 正确：组件 → request("/api/xxx") → API Route → appAi.chat()
原因：API Key / Private Key 不能暴露到客户端
```

**规范 2：客户端 API 函数统一放 src/lib/api/**
```
❌ 错误：在组件内直接 fetch("/api/tasks")
✅ 正确：在 src/lib/api/tasks.ts 中定义，组件 import 函数调用
原因：类型安全、可测试、错误处理统一
```

**规范 3：每个文件只导出一个组件**
```
❌ 错误：一个 .tsx 文件里 export function A() 和 export function B()
✅ 正确：拆分为 a.tsx 和 b.tsx，各自只有一个导出
```

**规范 4：新增 shadcn/ui 组件后检查导入路径**
```
bunx shadcn add <component>
# 检查生成的文件，import { cn } from "@/lib/utils" 要改为 "@/utils/utils"
# 因为 components.json 中 aliases.utils = "@/utils/utils"
```
