# PRD：Android Flutter + FastAPI 开发工具插件生态

**版本：** 0.1
**日期：** 2026-06-13
**来源：** Deep Research（112 subagents，575 次工具调用）

---

## 一、产品概述

**背景：** Flutter + FastAPI 是 Android 全栈开发的新兴主流组合。开发者在接入 Android 生命周期、集成 AI 辅助工具、管理状态以及连接前后端时，面临碎片化的工具链和频繁的 API 废弃问题。

**目标：** 提供一套标准化的 Flutter + FastAPI 全栈插件/skill 模板，覆盖从 Android 生命周期接入、AI 助手实时交互到前后端集成的完整开发链路。

---

## 二、核心发现（研究验证结论）

### 2.1 Flutter Android 插件生命周期接入

**结论置信度：高（3-0 全票）**

Android 插件必须通过以下两步接入生命周期：

1. 实现 `ActivityAware` 接口
2. 在 `onAttachedToActivity(ActivityPluginBinding binding)` 回调中调用 `FlutterLifecycleAdapter.getActivityLifecycle(binding)` 获取 Android `Lifecycle` 对象

```dart
// 插件标准声明形式
public class MyPlugin implements FlutterPlugin, ActivityAware {
  @Override
  public void onAttachedToActivity(ActivityPluginBinding binding) {
    Lifecycle lifecycle = FlutterLifecycleAdapter.getActivityLifecycle(binding);
    // 注册生命周期观察者
  }
}
```

**依赖包：** `flutter_plugin_android_lifecycle`（官方维护，v2.0.35，无废弃警告）

> ⚠️ 已否定的误解：`onAttachedToActivity()` 本身不是 hook 点，而是获取 `binding` 的回调入口。

---

### 2.2 Flutter MCP Server：AI 助手实时交互

**结论置信度：高（3-0 全票）**

Flutter MCP Server 允许 Claude Code 等 AI 客户端与运行中的 Flutter 应用实时交互。

**官方安装（需 Dart 3.9+）：**
```bash
claude mcp add --transport stdio dart -- dart mcp-server
```

**能力：**
- 实时 widget tree 查看
- 热重载触发
- 运行时错误检索

**社区扩展 `mcp_flutter`（稳定版 v3.x）：**

| 类别 | 代表功能 |
|------|---------|
| Inspection | 语义快照、widget 树查询 |
| Interaction | widget 点击、表单输入 |
| Debug | Dart 表达式求值、错误日志 |
| Lifecycle | 热重载、状态重置 |

> ⚠️ **风险：** 官方标注为**实验性**；`mcp_flutter` v4.0.0-dev.1 正在大幅重构，API 可能变更。

---

### 2.3 状态管理与 DI 方案

**结论置信度：中-高**

| 方案 | 定位 | 适用场景 |
|------|------|---------|
| **Riverpod** | 响应式状态管理 + DI，Provider 的改进版 | 中大型项目，需要解耦的依赖注入 |
| **Bloc** | 可预测状态管理，业务逻辑与 UI 严格分离 | 复杂业务流，需要清晰状态机 |
| **Flutter Hooks** | React Hooks 风格，`HookWidget` 复用有状态逻辑 | 简化 `StatefulWidget`，提升代码复用 |

> ⚠️ Riverpod 三层清架构（Data / Domain / Presentation）的具体分层实现在对抗验证中未通过（vote 1-2），不应作为规范直接采用。

---

### 2.4 FastAPI 生命周期管理

**结论置信度：高（3-0 全票）**

自 FastAPI 0.93.0 起，`@app.on_event` 已废弃，统一使用 `lifespan` 参数：

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await redis_client.init()
    await create_tables()
    yield
    # Shutdown
    await redis_client.close()

app = FastAPI(lifespan=lifespan)
```

共享资源挂载到 `app.state.*`，通过 `Depends()` 注入到路由。

---

### 2.5 Pydantic v2 ORM 序列化

**结论置信度：高（3-0 全票）**

```python
# ✅ Pydantic v2（当前标准）
from pydantic import BaseModel, ConfigDict

class UserSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str

# ❌ Pydantic v1（已废弃）
class UserSchema(BaseModel):
    class Config:
        orm_mode = True
```

> ⚠️ FastAPI 官方文档在反映此变更上有已知滞后，应以 [Pydantic 官方迁移指南](https://docs.pydantic.dev/latest/migration/) 为准。

---

### 2.6 Flutter ↔ FastAPI 集成模式

**结论置信度：高（3-0 全票）**

**标准模式（原型 / 小项目）：**
```dart
final response = await http.get(Uri.parse('$baseUrl/users'));
final data = jsonDecode(response.body);
final user = User.fromJson(data);
```

**生产推荐（中大型项目）：**
- 网络层：`Dio` 或 `Retrofit`（拦截器、错误处理、取消请求）
- 序列化：`json_serializable` + `build_runner` 代码生成
- CORS 策略：开发环境宽松，生产环境严格隔离

```python
# FastAPI CORS 开发/生产隔离
import os
if os.getenv("ENV") == "development":
    app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:9090"])
```

---

## 三、Android 权限注意事项

`permission_handler` 包在 Android 13+（API 33）中有重大变化：

| 旧 API | 新 API（Android 13+）|
|--------|---------------------|
| `Permission.storage` | `Permission.photos` / `Permission.videos` / `Permission.audio` |

---

## 四、插件 Skill 模板规划（MVP）

### Skill 1：Android 生命周期接入脚手架
- 生成 `ActivityAware` + `FlutterPlugin` 标准插件骨架
- 包含 `flutter_plugin_android_lifecycle` 依赖声明

### Skill 2：FastAPI 项目初始化模板
- `lifespan` 生命周期管理
- Pydantic v2 Schema 模板
- CORS 开发/生产配置分离
- SQLAlchemy + Alembic 迁移集成

### Skill 3：Flutter ↔ FastAPI 集成配置
- Dio 客户端基础配置
- `json_serializable` 代码生成配置
- 环境变量管理（`.env` 分层）

### Skill 4：Flutter MCP 接入指南
- Claude Code MCP Server 安装与配置
- `mcp_flutter` v3.x 工具使用说明
- 实验性功能风险提示

---

## 五、遗留开放问题

1. **Flutter MCP Server 稳定版时间线：** v4.0.0-dev.1 重构完成后 API 是否兼容？
2. **Dio + json_serializable vs 手写 fromJson：** 在小团队场景下的工程权衡？
3. **FastAPI WebSocket + FCM 推送：** 与 lifespan 协同的成熟最佳实践模板？
4. **Riverpod vs Bloc 选型：** 与 FastAPI SSE / streaming endpoint 集成时的差异？

---

## 六、被否定的声明（供参考，不应引用）

- `onAttachedToActivity()` 是 hook 点本身（**否定**，它是获取 binding 的回调）
- Flutter 插件可在运行时动态注册自定义 MCP 工具（**否定**）
- Riverpod 使用两种特定 Provider 类型的具体说法（**否定**，v2 API 已重构）
