---
name: project-rules
description: Android Flutter + FastAPI 项目核心约束规则，安装为 CLAUDE.md
---

# Flutter + FastAPI 项目 — Claude 规则

## 核心约束（所有 Agent 必须遵守）

### 文档优先
1. 任何功能、API、数据结构变化，先更新文档，再写代码
2. 完成一个阶段后，必须输出标准 handoff message 再进入下一阶段
3. 每次开始一个任务前，读 TASK_LIST，确认当前任务 ID 和验证命令

### 数据库设计（最高优先级）
4. 写任何 `backend/app/models/*.py` 前，`docs/design/DATABASE.md` 中必须有对应表的 `### <table>` 节
5. DATABASE.md 是数据库结构唯一真源，ORM Model 必须与之严格一致
6. Alembic migration 必须包含 downgrade，本地 `alembic upgrade head` 通过后才提交
7. 数据库设计经用户确认（"已确认"标记）后视为冻结，变更需走专项流程

### API 字段管理（Code-first）
8. openapi.yaml 不存在；API 字段定义在 Pydantic schema（Python 代码）中，是唯一真源
9. BACKEND_API.md 只写行为语义（做什么、权限、错误码），不写字段结构
10. FastAPI 实现后必须运行 `make gen-docs` 更新 docs/api/openapi.json 和 index.html
11. Flutter API client 必须从 openapi.json 生成（`make gen-client`），禁止手写字段

### FastAPI 规范
12. 禁止 `@app.on_event`，使用 `lifespan` context manager
13. 使用 Pydantic v2（`ConfigDict + from_attributes`），禁止 v1 `class Config: orm_mode = True`
14. 分层：Router（HTTP 转发）→ Service（业务逻辑）→ Repository（数据访问）
15. Router 不含 ORM 操作（禁止在 Router 中调用 `.query()` `.filter()` `.commit()`）

### Flutter 规范
16. 分层：Presentation → Domain → Data，禁止 Presentation 直接 import Data 实现类
17. Android 13+（API 33）使用细粒度权限：`Permission.photos` / `Permission.videos` / `Permission.audio`
18. API client 从 openapi.json 生成，禁止手写字段定义

### i18n & e2e 可测性
18a. 用户可见文案一律走 `AppLocalizations`，禁止 Widget 内裸字符串；新增文案同步补 zh-CN / zh-TW / en-US 三语 `.arb` key（hook 告警）
18b. 关键交互控件（按钮/输入框/可点列表项/Tab/对话框）必须挂 `Semantics(identifier:)`，命名 `<feature>-<element>[-<action>]`，全小写连字符
18c. e2e 定位用 identifier（语言无关），不得依赖可见文案；同一 id 在 web 语义树与原生 `find.bySemanticsIdentifier` 复用
18d. flow spec（`e2e/flows/<feature>.flow.yaml`）是 L2(web Playwright) 与 L3(integration_test) 的单一来源，二者共用，禁止双写

### 安全
19. 禁止硬编码 secret、密码、JWT key、API key；一律用环境变量
20. Keystore 文件和 key.properties 不入 git

### Git
21. Commit message 格式：`feat/fix/docs/test/chore/refactor(<scope>): 描述`
22. 禁止 `--no-verify` 跳过 hook
23. 禁止 force push 到 main / develop
24. 并行开发使用 Worktree（见 docs/internal/GIT_WORKFLOW.md）

### Build & Release
25. 后端通过 Docker 部署（见 docs/ops/DEPLOY_PLAYBOOK.md）
26. Flutter 构建 AAB（不是 APK）上架 Play Store
27. AAB 签名配置通过 CI secrets 注入，不入 git

## 开发节奏（单任务原则）
每一轮 Claude 对话执行且只执行 **一个 Task**：
1. 读 TASK_LIST_<feature>.md，找到当前 TODO 任务
2. 声明：「当前任务：T-XX — [描述]。验证命令：[cmd]。预计改动：[文件]。」
3. 实现，运行验证命令
4. 更新 TASK_LIST：☐ → ✅
5. `git commit -m "type(scope): 描述"`，`git push`
6. 声明：「T-XX ✅ 完成。下一任务：T-XX+1。」

## 文档职责速查
| 文档 | 管什么 | 不管什么 |
|------|--------|---------|
| PRD_*.md | 做什么、为什么、验收标准 AC | 怎么做 |
| FEATURE_*.md | 单功能技术设计（含30行摘要块） | PRD 内容 |
| DATABASE.md | 表/字段/索引/约束（唯一真源） | API 字段 |
| BACKEND_API.md | API 行为语义、错误码 | 字段结构 |
| Pydantic schema | API 请求/响应字段（唯一真源） | — |
| TASK_LIST_*.md | 当前 feature 的任务进度 | — |
| docs/api/index.html | API 字段参考（渲染自 openapi.json） | — |

## Agent 路由规则
- 需求 / PRD → `pm` agent 或 `/new-feature`
- 数据库设计 → `architect` agent 或 `/db-design`
- 技术设计 / 架构 → `architect` agent
- 任务规划 → `architect` agent 或 `/plan-feature`
- Flutter 开发 → `flutter-dev` agent 或 `/implement`
- FastAPI 开发 → `fastapi-dev` agent 或 `/implement`
- 测试 / 验收 → `qa` agent 或 `/test-feature`
- 代码审查 → `reviewer` agent 或 `/review`
- 构建 / 部署 → `devops` agent 或 `/release`
