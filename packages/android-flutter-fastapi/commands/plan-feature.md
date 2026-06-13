---
name: plan-feature
description: 功能任务规划：将 Feature 拆分为单层、小粒度任务（TASK_LIST），前置条件为数据库设计已确认
---

## 用法

```
/plan-feature <feature>
```

示例：
```
/plan-feature user-profile
```

## 前置条件（全部满足才执行）

```
[ ] docs/product/PRD_<feature>.md 存在
[ ] docs/design/FEATURE_<feature>.md 存在
[ ] docs/design/DATABASE.md 中对应表标注了「状态: 已确认」
[ ] .claude/state/schema-unconfirmed 不存在
```

如任一不满足，输出具体缺失项并停止。

## 执行步骤

以 `architect` agent 身份运行：

**步骤 1 — 读取上下文**
- 读 `docs/design/FEATURE_<feature>.md`（完整版）
- 读 `docs/design/DATABASE.md`（涉及的表）
- 读 `docs/design/BACKEND_API.md`（涉及的 API）

**步骤 2 — 任务分解**

按以下规则拆分：
- **单层原则**：每个 Task 只操作一层（Schema / Model / Repository / Service / Router / Provider / Widget）
- **文件限制**：每个 Task ≤3 个文件
- **可验证性**：每个 Task 必须有一条具体验证命令
- **依赖明确**：显式列出前置 Task ID

**标准任务序列（根据实际 Feature 调整）：**
```
T-01: Alembic migration — models/<feature>.py
T-02: FastAPI Pydantic schema — schemas/<feature>_schema.py
T-03: Repository 层 — repositories/<feature>_repo.py
T-04: Service 层 — services/<feature>_service.py
T-05: Router 层 — routers/<feature>.py（注册端点）
T-06: gen-docs（更新 openapi.json + index.html）
T-07: gen-client（生成 Dart client）
T-08: Flutter Domain 层 — 实体类 + Repository 接口
T-09: Flutter Data 层 — Repository 实现（使用生成的 client）
T-10: Flutter Provider — Riverpod providers
T-11: Flutter UI — Screen / Widget
T-12: 单元测试 — Flutter + FastAPI
T-13: 集成测试
```

**步骤 3 — 输出 TASK_LIST 文件**

创建 `docs/internal/TASK_LIST_<feature>.md`，格式：
```markdown
# TASK_LIST — <feature>

> 功能 ID: F-XXX  
> 数据库已确认: YYYY-MM-DD  
> 状态: Planning

## 任务清单

| ID | 描述 | 层 | 文件 | 依赖 | 验证命令 | 状态 |
|----|------|------|------|------|---------|------|
| T-01 | 创建 Alembic migration | Model | backend/app/models/xxx.py<br>migrations/... | — | alembic upgrade head && alembic downgrade -1 | ☐ |
| T-02 | ... | | | | | ☐ |
```

**步骤 4 — 等待确认**
```
## 任务规划摘要 — <feature>

后端任务: X 个  Flutter 任务: X 个  测试任务: X 个  总计: X 个
预估工作量: 中 / 大（多轮会话）

---
请 Review docs/internal/TASK_LIST_<feature>.md
确认后回复「确认任务规划」，可以开始运行 /implement <feature>
或提出调整意见
```

## 并行开发（多 Worktree）

如需并行开发，确认任务规划后运行：
```bash
git worktree add ../worktrees/feature-<name> -b feature/<name> origin/develop
```

每个 Worktree 对应一条 feature 分支，共享 `docs/` 目录文档只能在 develop 分支修改。
