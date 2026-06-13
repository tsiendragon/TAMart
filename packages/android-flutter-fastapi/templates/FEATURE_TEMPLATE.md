# Tech Design — {Feature Name}

> 功能 ID: F-XXX  
> 版本: v0.1  
> 状态: Draft / Confirmed  
> 作者: Architect Agent  
> 日期: YYYY-MM-DD

---

## 快速摘要（读这里就够了解全貌）

**功能：** 一句话描述功能做什么

**改动规模：** 小（1-3 Task）/ 中（4-8 Task）/ 大（9+ Task）

**新增 API：** [POST /api/v1/xxx, GET /api/v1/xxx/{id}]

**新增表：** [table_name_a, table_name_b]

**Flutter 范围：** `features/{feature}/`（新建 / 修改现有）

**Backend 范围：** `routers/{f}.py`, `services/{f}_service.py`, `schemas/{f}_schema.py`, `models/{f}.py`

**Alembic 需要：** 是 / 否

**关键约束：** 
1. 最重要的业务规则
2. 第二重要的约束

**Task List：** `docs/internal/TASK_LIST_{feature}.md`

---

## 1. 架构决策

### 1.1 方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| 方案 A | ... | ... |
| 方案 B | ... | ... |

**选择：** 方案 A，原因：...

### 1.2 关键设计决策

- **决策 1：** [描述] — 原因：[...]
- **决策 2：** [描述] — 原因：[...]

## 2. 后端设计

### 2.1 API 端点（行为语义，字段见 Pydantic schema）

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | /api/v1/{feature} | 创建 | 需要 |
| GET | /api/v1/{feature}/{id} | 查询 | 需要 |

错误码：
- `400` 参数校验失败
- `401` 未认证
- `403` 无权限
- `404` 资源不存在

### 2.2 分层职责

**Router (`routers/{f}.py`)：**
- HTTP 参数解析、调用 service、返回 HTTP 响应
- 无业务逻辑，无 ORM

**Service (`services/{f}_service.py`)：**
- 业务规则实现
- 调用 repository 获取/存储数据

**Repository (`repositories/{f}_repo.py`)：**
- 数据库 CRUD 操作
- 无业务逻辑

### 2.3 关键时序

```
Client → Router → Service → Repository → DB
```

（如有复杂时序，在此处添加 Mermaid sequence diagram）

## 3. 数据库设计摘要

> 详细表结构见 `docs/design/DATABASE.md` 中的 `### {table_name}` 节

新增/修改的表：
- `table_a`：[一句话说明用途]
- `table_b`：[一句话说明用途]

Migration 类型：autogenerate / 需手写 CHECK 约束 / 数据迁移

## 4. Flutter 设计

### 4.1 目录结构

```
frontend/lib/features/{feature}/
├── data/
│   ├── {feature}_repository_impl.dart
│   └── models/   # 生成的 Dart 模型
├── domain/
│   ├── {feature}_repository.dart  # abstract class
│   └── entities/
└── presentation/
    ├── screens/{feature}_screen.dart
    ├── widgets/
    └── providers/{feature}_provider.dart
```

### 4.2 状态管理

使用 Riverpod。关键 Provider：
- `{feature}ListProvider`：获取列表
- `{feature}DetailProvider`：获取单条

### 4.3 关键 UI 状态

| 状态 | 显示 |
|------|------|
| Loading | CircularProgressIndicator |
| Empty | 空状态引导 Widget |
| Error | ErrorWidget + 重试按钮 |
| Data | 正常内容 |

## 5. 测试策略

**后端单测：** `backend/tests/unit/test_{feature}_service.py`
- 覆盖 Service 层所有业务分支

**Flutter 单测：** `frontend/test/unit/features/{feature}/`
- Provider 状态变化
- Repository 接口 mock 实现

**集成测试：**
- `backend/tests/integration/test_{feature}_api.py`
- `frontend/integration_test/features/{feature}_test.dart`

**契约测试：** `backend/tests/contract/test_openapi_contract.py`

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 风险 1 | 中 | 缓解方案 |

---
*Handoff: Architect → Dev 请运行 /plan-feature {feature}*
