---
name: review
description: 代码审查：对照 PRD/DATABASE/API/openapi.json 多维度审查实现，输出 BLOCKER/WARNING/SUGGESTION 三级 review comments
---

## 用法

```
/review <feature> [scope]
```

示例：
```
/review user-profile           # 审查所有改动
/review user-profile backend   # 只审查后端
/review user-profile flutter   # 只审查 Flutter
```

## 前置条件

```
[ ] /test-feature 已运行并出具 PASS 结论（TEST_PLAN_<feature>.md 存在且结论为 PASS）
```

如测试未通过，输出：「请先运行 /test-feature <feature> 确保测试通过后再进行 review」

## 执行步骤

以 `reviewer` agent 角色运行：

**步骤 1 — 读取参考文档**
- `docs/product/PRD_<feature>.md`（验收标准）
- `docs/design/FEATURE_<feature>.md`（技术设计）
- `docs/design/DATABASE.md`（表结构，对应 Model）
- `docs/design/BACKEND_API.md`（API 行为语义）
- `docs/api/openapi.json`（最新 API 字段快照）

**步骤 2 — 后端审查**（scope = backend 或 all）

检查维度（按优先级）：

1. **数据库一致性**
   - ORM Model ↔ DATABASE.md（类型/约束/索引完全一致）
   - Alembic migration 存在且有 `downgrade()`
   - 软删除过滤：查询中 `.filter(Entity.deleted_at.is_(None))`
   - 用户隔离：查询中 `user_id = current_user.id`

2. **API 契约一致性**
   - 端点列表 ↔ BACKEND_API.md
   - 字段快照 ↔ openapi.json ↔ Pydantic schema
   - 错误码 ↔ BACKEND_API.md 约定

3. **FastAPI 分层规范**
   - Router 无 ORM（`.query()` `.filter()` `.commit()`）
   - Router 无业务逻辑
   - 无 `@app.on_event`
   - 无 Pydantic v1 `orm_mode`

4. **安全**
   - 路由有权限校验（`Depends(get_current_user)` 或等价）
   - 无硬编码 secret/password/key
   - 输入有 Pydantic 类型校验

**步骤 3 — Flutter 审查**（scope = flutter 或 all）

1. **分层规范**
   - Presentation 未 import `*_repository_impl.dart`
   - Presentation 通过 Provider → Repository 接口访问数据

2. **API Client**
   - Data 层使用生成的 client（未手写字段）

3. **Android 规范**
   - 未使用 `Permission.storage`（应使用细粒度权限）

4. **PRD 验收标准覆盖**
   - 所有 AC 有对应实现
   - 无 scope creep（实现了 PRD 排除的功能）

**步骤 4 — 输出 Review Report**

```markdown
## Code Review — <feature>

### BLOCKER（必须修复后才能合并）
- `path:line` — 问题描述
  期望：XXX
  实际：YYY

### WARNING（建议修复）
- `path:line` — 问题描述

### SUGGESTION（可选优化）
- `path:line` — 优化建议

---
### 结论
[APPROVED 🟢] 无 BLOCKER，可以进入发布流程
[CHANGES REQUESTED 🔴] 有 N 个 BLOCKER，请修复后重新 review
```

## 禁止
- 直接修改代码（只出 review comments）
- 没有文档依据的主观意见
- 将 SUGGESTION 标注为 BLOCKER
- 测试未通过时执行 review
