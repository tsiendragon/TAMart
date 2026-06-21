# SYNC_DESIGN_<feature>.md — 离线同步协议设计

> 维护者：Architect Agent。**同步协议是冻结契约**，变更须走设计门控（AGENTS.md §0.7）。
> 适用于所有"离线优先 + 多端同步"的可同步实体。

## 快速摘要

**可同步实体：** [account, transaction, category, ...]
**同步粒度：** 整对象 / 字段级
**冲突策略：** last-write-wins（按 `updated_at`） / 字段级合并 / 人工解决
**关键约束：** [1-3 条]

---

## 1. 同步字段（每张可同步表必备）

| 字段 | 类型 | 说明 |
|------|------|------|
| `sync_id` | string (UUID/雪花) | **跨端唯一标识**，非本地自增 id；push/pull 以此对齐 |
| `updated_at` | datetime (UTC) | 冲突解决依据（last-write-wins） |
| `deleted_at` / `tombstone` | datetime / bool | 软删除；删除也要同步（tombstone），不可物理消失 |
| `schema_version` | int | 客户端数据结构版本，服务端据此判断兼容/拒绝 |
| `dirty` / `sync_state` | enum (本地) | 本地标记：pending / synced / conflict（仅客户端） |

> 本地自增主键 `id` 不跨端；跨端一律用 `sync_id`。新建对象客户端先生成 `sync_id`。

## 2. object_type 枚举

```
account | transaction | transaction_entry | category | ledger | ...
```
每条变更记录带 `object_type` + `sync_id`，服务端按类型路由。

## 3. Push（客户端 → 服务端）

```
POST /api/v1/sync/push
Body: { schema_version, changes: [ { object_type, sync_id, op: upsert|delete, payload, updated_at } ] }
Resp: { code, data: { accepted: [sync_id], conflicts: [ { sync_id, server_updated_at, server_payload } ] } }
```
- 服务端逐条比对 `updated_at`：客户端较新 → 接受；服务端较新 → 进 conflicts。
- `op: delete` 写 tombstone，不物理删。

## 4. Pull（服务端 → 客户端）

```
GET /api/v1/sync/pull?since=<cursor>&schema_version=<n>
Resp: { code, data: { changes: [...], next_cursor, server_time } }
```
- 增量游标 `since`（服务端 `updated_at` 或单调序列）。
- 客户端应用变更；本地 `dirty` 的对象遇服务端更新 → 进冲突队列。

## 5. 冲突解决

| 策略 | 适用 | 行为 |
|------|------|------|
| last-write-wins | 多数字段 | `updated_at` 大者胜 |
| 字段级合并 | 不相交字段编辑 | 按字段取各自最新 |
| 人工解决 | 关键字段冲突 | 进 `sync_conflicts`，UI 让用户选 |

```
POST /api/v1/sync/resolve-conflict
Body: { sync_id, resolution: keep_local|keep_server|merged, payload? }
```

## 6. schema_version 兼容

- 客户端 `schema_version` < 服务端最低支持 → 服务端返回升级提示，拒绝 push。
- 与 DATABASE.md 的「前端 Drift schemaVersion」对齐升级。

---

## 7. 同步 e2e 场景（交给 e2e-tester / L1）

> 这些场景是 `/e2e backend <feature>` 与 L3 的必测路径。

1. **基本往返**：设备A upsert → push → 设备B pull → 数据一致
2. **删除同步**：设备A delete（tombstone）→ push → 设备B pull → 本地消失（非物理删）
3. **last-write-wins**：A、B 各改同一对象，后写覆盖先写（按 updated_at）
4. **人工冲突**：A、B 同时改关键字段 → 进 sync_conflicts → resolve → 收敛
5. **增量游标**：多次 pull，`since` 游标不漏不重
6. **schema_version 拒绝**：低版本客户端 push 被拒并提示升级
7. **断点续传**：push 中断后重试，幂等（同 sync_id 不重复落库）

对应 DB 断言（assert-db.sh）：tombstone 行存在、冲突表计数、`sync_id` 唯一、无重复落库。

## 8. 设计决策记录

- [为什么选 last-write-wins 而非向量时钟 / 为什么 tombstone 而非物理删 ...]
