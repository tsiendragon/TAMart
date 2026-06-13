---
name: db-design
description: 数据库设计命令（最高优先级门控）：分析 PRD 和 Tech Design，完成 ER 图、表设计、索引设计，等待用户确认后标记已确认
---

## 用法

```
/db-design <feature>
```

示例：
```
/db-design user-profile
```

## 前置条件
- `docs/product/PRD_<feature>.md` 必须存在（已用户确认）
- `docs/design/FEATURE_<feature>.md` 必须存在（或同步进行 Tech Design）

## 执行步骤

以 `architect` agent 身份运行：

**步骤 1 — 读取上下文**
- 读 `docs/product/PRD_<feature>.md`（理解功能和业务规则）
- 读 `docs/design/DATABASE.md`（了解现有表和全局约定）
- 读 `docs/design/FEATURE_<feature>.md`（如已存在）

**步骤 2 — 实体建模**
- 识别领域实体（名词 → 表）
- 识别实体关系（1:1 / 1:N / M:N）
- 输出 Mermaid ER 图

**步骤 3 — 逐表完整设计**
对每张新增/修改表，输出设计块到 `docs/design/DATABASE.md`，包含：
- 建表 SQL（或完整 DDL）
- 每列：列名 / 类型 / 约束 / 默认值 / 说明
- 枚举约束（VARCHAR + CHECK，禁止 PG 原生 ENUM）
- 索引列表（理由说明）
- 设计决策记录（为什么这样设计）

**步骤 4 — 输出 Migration 计划**
- Migration 类型：autogenerate / 需手写 CHECK / 数据迁移
- 存量数据影响：是 / 否
- 是否有不可逆操作：是（说明） / 否

**步骤 5 — 等待确认**
```
## 数据库设计摘要 — <feature>

新增表: [table_a, table_b]
修改表: [table_c]（新增列: [col_x]）
Migration 类型: autogenerate + 手写 CHECK
是否有存量数据风险: 否

---
请 Review DATABASE.md 中新增的表设计。
确认后回复「确认数据库设计」，我将标记为已确认并可以进入任务规划。
```

**步骤 6 — 用户确认后**
- 在 DATABASE.md 对应表头追加 `状态: 已确认 [YYYY-MM-DD]`
- 删除 `.claude/state/schema-unconfirmed`（如存在）
- 输出：「数据库设计已确认，可以运行 /plan-feature <feature> 进行任务规划」

## 设计规范（强制）
- 主键：`BIGSERIAL PRIMARY KEY`
- 软删除：所有业务表必须有 `deleted_at TIMESTAMPTZ`
- 时间戳：`created_at` / `updated_at`（均带时区）
- 用户隔离：所有用户业务表必须有 `user_id BIGINT NOT NULL REFERENCES users(id)` + 索引
- 枚举：`VARCHAR(N) NOT NULL CHECK(col IN (...))` — 禁止 PG `ENUM` 类型
- FK 列必须有单独索引（Postgres 不自动创建）
- 高频查询字段必须有索引（先列出查询模式，再决定索引）
