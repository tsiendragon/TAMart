---
name: agents-rules
description: Agent 协作约定，安装为 AGENTS.md
---

# AGENTS.md — Agent 协作约定

> 每次动需求、动设计、动数据库、动代码、动测试，都按这里执行。

## 0. 总则

1. **文档先于代码**：任何功能、API、数据库结构变化，先更新文档，再写代码。
2. **数据库设计是第一道门控**：代码开始前 DATABASE.md 必须有对应表定义，且经用户确认。
3. **单任务节奏**：每轮只执行 TASK_LIST 中的一个任务，完成即 commit + push。
4. **阶段交接必须输出 handoff message**：不允许跳过交接直接进入下一阶段。
5. **完成一个完整改动单元**：更新文档 → 实现代码 → 运行验证 → commit → push。
6. **schema 变更 4 件套原子提交**：任何表/列变更，必须在**同一个 commit**同步改齐 ① DATABASE.md ② 后端 Alembic migration（含 downgrade）③ 前端 Drift table + `schemaVersion` bump + `MigrationStrategy` step ④ 双侧迁移测试。缺一不可，不允许分多次提交。
7. **同步协议是冻结契约**：涉及 `sync_id` / `updated_at` / tombstone / `schema_version` / push-pull / 冲突解决的变更，须经设计门控（见 SYNC_DESIGN_<feature>.md），不得在实现/测试阶段静默改。

## 1. 开发生命周期阶段

```
/new-feature → PRD(pm) → Tech Design(architect) → DB Design(architect)
             → /plan-feature → TASK_LIST → 实现(flutter-dev + fastapi-dev)
             → 测试(qa) → Review(reviewer) → 发布(devops)
```

**门控（每个门控需用户明确确认才能继续）：**
- 门控 1：PRD 确认 → 进入 Tech Design
- 门控 2：Tech Design 确认 → 进入数据库设计
- 门控 3：数据库设计确认（Schema 冻结）→ 进入 TASK_LIST 规划
- 门控 4：TASK_LIST 确认 → 开始写代码

## 2. 文档职责表

| 文件/目录 | 作用 | 维护规则 |
|----------|------|---------|
| `docs/product/PRD.md` | 总 PRD | 全局目标、范围、版本规划 |
| `docs/product/PRD_<f>.md` | 子功能 PRD | 做什么、为什么、验收标准 AC |
| `docs/product/FUNCTIONAL_LIST.md` | 功能清单 | 功能编号、优先级、状态 |
| `docs/product/UX_FLOW.md` | 用户流程 | 操作路径，含失败路径 |
| `docs/design/ARCHITECTURE.md` | 全局架构 | 模块边界、数据流 |
| `docs/design/DATABASE.md` | 数据库设计 | 表/字段/索引/约束（唯一真源） |
| `docs/design/BACKEND_API.md` | API 行为语义 | 做什么、权限、错误码（不写字段） |
| `docs/design/FEATURE_<f>.md` | 功能 Tech Design | 30行摘要块 + 完整设计 |
| `docs/internal/TASK_LIST_<f>.md` | 任务清单 | T-01..T-N，每轮执行一个 |
| `docs/api/openapi.json` | API 字段快照 | CI 自动生成，不手写 |
| `docs/api/index.html` | API HTML 文档 | CI 自动生成 |

## 3. 上下文分级加载

| 层级 | 文件 | 何时读 |
|------|------|--------|
| Level 0（每轮必读） | CLAUDE.md + AGENTS.md | 始终 |
| Level 1（当前任务必读） | PRD_<f>.md + FEATURE_<f>.md（摘要块）+ TASK_LIST_<f>.md | 每次开始任务 |
| Level 2（按需读） | DATABASE.md / BACKEND_API.md / FRONTEND_ARCH.md | 有疑问时 |
| Level 3（片段查询） | ARCHITECTURE.md / DATA_FLOW.md / openapi.json | 仅查特定信息 |

## 4. 标准 Handoff Message 格式

### PM → Architect
```
## PM Handoff → Architect
功能: <name>  功能 ID: F-<XXX>
PRD: docs/product/PRD_<feature>.md
核心 AC: [AC-01, AC-02]  关键约束: [...]
```

### Architect → DB Design
```
## Tech Design Handoff → DB Design
Tech Design: docs/design/FEATURE_<feature>.md
需新增表: [table_a, table_b]  需修改表: [table_c]
关键业务规则: [...]
```

### DB Design → Plan
```
## DB Design Handoff → Plan
DATABASE.md 已更新，涉及表: [table_a, table_b]
已确认日期: <YYYY-MM-DD>
后端 Alembic: autogenerate + 手写 CHECK 约束
前端 Drift: schemaVersion v22 → v23（createTable / addColumn）
同步影响: 是/否（涉及 sync_id/tombstone 时附 SYNC_DESIGN_<feature>.md）
```

### Architect → Dev
```
## Tech Design Handoff
flutter_scope: frontend/lib/features/<feature>/
backend_scope: backend/app/{routers,services,schemas,models}/<feature>*
new_apis: [POST /api/v1/xxx]  new_tables: [xxx]  alembic: yes/no
```

## 5. Reviewer 输出格式

```
## Code Review — <feature>
### BLOCKER（必须修复）
- `path:line` — 问题（期望：XXX，实际：YYY）
### WARNING（建议修复）
### SUGGESTION（可选优化）
```

## 6. 验证命令速查

```bash
# Python 语法
python3 -m py_compile backend/app/<module>.py

# FastAPI 后端测试
PYTHONPATH=backend pytest backend/tests/ -q

# 生成 openapi + HTML
make gen-docs

# 生成 Dart client
make gen-client

# Flutter 分析 + 测试
flutter analyze && flutter test

# Alembic 验证
cd backend && alembic upgrade head && alembic downgrade -1 && alembic upgrade head
```
