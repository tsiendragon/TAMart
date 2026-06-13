# Docs 文档结构

> 采用 4 级上下文加载策略，避免 Agent 一次性加载全部文档

## 目录结构

```
docs/
├── product/          # 产品文档（PM Agent 维护）
│   ├── PRD.md                    # 总 PRD — 全局目标/版本规划
│   ├── PRD_<feature>.md          # 子功能 PRD — 做什么/验收标准
│   ├── FUNCTIONAL_LIST.md        # 功能清单 — 编号/优先级/状态
│   └── UX_FLOW.md                # 用户流程 — 操作路径/失败路径
│
├── design/           # 技术设计（Architect Agent 维护）
│   ├── ARCHITECTURE.md           # 全局架构 — 模块边界/数据流
│   ├── DATABASE.md               # 数据库设计（唯一真源）
│   ├── BACKEND_API.md            # API 行为语义（不含字段）
│   ├── FEATURE_<feature>.md      # 单功能 Tech Design（含30行摘要块）
│   ├── FRONTEND_ARCH.md          # Flutter 架构约定
│   ├── BACKEND_ARCH.md           # FastAPI 架构约定
│   ├── SKELETON.md               # 目录结构说明
│   └── DATA_FLOW.md              # 关键时序图
│
├── internal/         # 开发内部文档（自动生成，Agent 使用）
│   ├── TASK_LIST_<feature>.md    # 任务清单（/plan-feature 生成）
│   └── TEST_PLAN_<feature>.md    # 测试计划（/test-feature 生成）
│
├── api/              # API 文档（CI 自动生成，不手写）
│   ├── openapi.json              # OpenAPI 3.0 规范（FastAPI 导出）
│   └── index.html                # Redoc 渲染的可读 HTML
│
└── ops/              # 运维文档
    ├── DEPLOY_PLAYBOOK.md        # 后端部署记录和操作手册
    └── PLAY_STORE_GUIDE.md       # Android AAB 发布记录
```

## 4 级上下文加载策略

| 层级 | 文档 | 何时加载 | 大小目标 |
|------|------|---------|---------|
| Level 0 | CLAUDE.md + AGENTS.md | 每轮必读 | ≤2KB |
| Level 1 | PRD_<f>.md + FEATURE_<f>.md（仅摘要块）+ TASK_LIST_<f>.md | 开始任务时 | ≤5KB |
| Level 2 | DATABASE.md / BACKEND_API.md / FRONTEND_ARCH.md | 有疑问时按需读 | ≤10KB |
| Level 3 | ARCHITECTURE.md / DATA_FLOW.md / openapi.json | 仅查特定片段 | 按需 |

## 文档所有权

| 文档 | 创建者 | 维护者 | 更新时机 |
|------|--------|--------|---------|
| PRD_*.md | PM Agent (/new-feature) | PM Agent | 需求变化时 |
| DATABASE.md | Architect Agent (/db-design) | Architect Agent | Schema 变化时（需用户确认） |
| FEATURE_*.md | Architect Agent | Architect Agent | 技术方案变化时 |
| BACKEND_API.md | Architect Agent | Architect Agent | API 行为变化时 |
| openapi.json | FastAPI Dev Agent | CI (make gen-docs) | 每次 schema/router 变化后 |
| TASK_LIST_*.md | Architect Agent (/plan-feature) | Dev Agents | 每个 Task 完成时 ☐→✅ |
| TEST_PLAN_*.md | QA Agent (/test-feature) | QA Agent | 每次运行测试时 |
| DEPLOY_PLAYBOOK.md | DevOps Agent | DevOps Agent | 每次部署后 |
