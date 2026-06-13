# BACKEND_API.md — API 行为语义

> **职责说明：** 本文档只描述 API 的「行为语义」（做什么、权限、错误码）。  
> **字段结构** 定义在 Pydantic schema（Python 代码）中，是唯一真源。  
> **可视化参考**：`docs/api/index.html`（从 openapi.json 渲染，包含完整字段说明）

---

## 全局约定

**Base URL：** `/api/v1`

**认证：** JWT Bearer Token（`Authorization: Bearer <token>`）

**通用错误码：**
| 码 | 含义 |
|----|------|
| 400 | 请求参数校验失败（Pydantic 返回详细字段错误） |
| 401 | 未认证或 Token 已过期 |
| 403 | 已认证但无权限访问该资源 |
| 404 | 资源不存在（或软删除后不可见） |
| 422 | 语义错误（FastAPI 自动处理） |
| 500 | 服务器内部错误 |

**分页约定（列表接口）：**
- 请求：`?page=1&page_size=20`
- 响应：包含 `total`、`page`、`page_size`、`items` 字段（见 openapi.json）

---

## 认证模块

### POST /api/v1/auth/register
**描述：** 用户注册新账号  
**认证：** 不需要  
**行为：**
1. 验证 email 格式和唯一性（已存在返回 400）
2. 密码哈希存储（bcrypt）
3. 返回 access_token 和 refresh_token

**错误码：**
- `400` email 已被注册

---

### POST /api/v1/auth/login
**描述：** 用户登录，获取 JWT  
**认证：** 不需要  
**行为：**
1. 验证 email + password
2. 返回 access_token（15min 过期）和 refresh_token（7d 过期）

**错误码：**
- `401` email 或密码错误

---

## {Feature} 模块

### POST /api/v1/{feature}
**描述：** 创建资源  
**认证：** 需要  
**行为：**
1. 校验请求字段（Pydantic）
2. 关联到当前登录用户（`user_id = current_user.id`）
3. 持久化到数据库
4. 返回创建的资源

**错误码：**
- `400` 请求字段不合法（详见字段约束在 openapi.json）

---

### GET /api/v1/{feature}
**描述：** 获取当前用户的资源列表（分页）  
**认证：** 需要  
**行为：**
1. 过滤当前用户（`user_id = current_user.id`）
2. 过滤软删除（`deleted_at IS NULL`）
3. 按 `created_at DESC` 排序
4. 返回分页结果

---

### GET /api/v1/{feature}/{id}
**描述：** 获取单条资源  
**认证：** 需要  
**行为：**
1. 查询 ID + user_id（防止越权）
2. 软删除资源返回 404

**错误码：**
- `403` 资源属于其他用户
- `404` 资源不存在或已删除

---

### PATCH /api/v1/{feature}/{id}
**描述：** 更新资源（部分更新）  
**认证：** 需要  
**行为：**
1. 验证资源属于当前用户
2. 只更新提供的字段（其余字段不变）

**错误码：**
- `403` 越权
- `404` 不存在

---

### DELETE /api/v1/{feature}/{id}
**描述：** 软删除资源  
**认证：** 需要  
**行为：**
1. 验证资源属于当前用户
2. 设置 `deleted_at = NOW()`（不真正删除数据）
3. 返回 204 No Content

**错误码：**
- `403` 越权
- `404` 不存在或已删除
