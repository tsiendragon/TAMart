---
name: implement
description: 执行 TASK_LIST 中的下一个任务（单任务原则），自动路由给 flutter-dev 或 fastapi-dev
---

## 用法

```
/implement <feature> [task-id]
```

示例：
```
/implement user-profile        # 自动找下一个 TODO 任务
/implement user-profile T-05   # 指定任务 ID
```

## 前置条件

```
[ ] docs/internal/TASK_LIST_<feature>.md 存在
[ ] 有至少一个状态为 ☐ 的任务
[ ] 数据库设计已确认（涉及 Model 时检查 DATABASE.md 中对应表标注「已确认」）
```

## 执行逻辑

**步骤 1 — 定位任务**

读 `TASK_LIST_<feature>.md`，找到：
- 指定 `task-id` 时：找对应行
- 未指定时：找第一个 `☐` 且前置依赖全部 `✅` 的任务

如果没有可运行的任务（都在等待依赖），输出：
```
无可运行任务。等待中的任务：T-XX（依赖 T-YY）
```

**步骤 2 — 路由到对应 Agent**

根据任务"层"字段自动路由：
- `Model / Schema / Repository / Service / Router / Alembic` → 以 `fastapi-dev` 角色执行
- `Flutter Domain / Data / Provider / UI / Widget` → 以 `flutter-dev` 角色执行
- `gen-docs / gen-client` → 直接运行工具脚本

**步骤 3 — 声明并执行**

输出任务声明：
```
当前任务：T-XX — [描述]
角色：fastapi-dev / flutter-dev
依赖：[T-YY ✅]
验证命令：[从 TASK_LIST 读取]
预计改动：[从 TASK_LIST 读取]
```

执行单个任务，运行验证命令。

**步骤 4 — 完成确认**

```
T-XX ✅ 完成
验证：[验证命令及结果摘要]
已 commit：type(scope): T-XX 描述

下一可运行任务：T-XX+1 — [描述]
运行 /implement <feature> 继续，或 /implement <feature> T-YY 跳转到指定任务
```

同时更新 TASK_LIST：`☐ → ✅`

## gen-docs 任务（T-06 类型）

```bash
# 启动 FastAPI 服务（临时）+ 导出 openapi.json
cd backend
python3 -c "
import json
from app.main import app
with open('../docs/api/openapi.json', 'w') as f:
    json.dump(app.openapi(), f, indent=2, ensure_ascii=False)
print('openapi.json updated')
"

# 渲染 HTML（使用 redoc-cli 或静态 redoc）
npx redoc-cli bundle docs/api/openapi.json \
  -o docs/api/index.html \
  --title "API Reference"

# 清除 stale 标记
rm -f .claude/state/openapi.stale
```

## gen-client 任务（T-07 类型）

```bash
dart run openapi_generator -- generate \
  -i docs/api/openapi.json \
  -g dart-dio \
  -o frontend/lib/core/api_client/generated/ \
  --additional-properties=pubName=api_client,nullableFields=true

# 清除 stale 标记
rm -f .claude/state/dart-client.stale
```

## 禁止
- 一轮执行多个 Task
- 跳过验证命令直接标记 ✅
- 在 DATABASE.md 未确认的情况下实现 Model 层
