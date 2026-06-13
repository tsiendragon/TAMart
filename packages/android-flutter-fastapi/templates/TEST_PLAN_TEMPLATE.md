# TEST_PLAN — {Feature Name}

> 功能 ID: F-XXX  
> 测试日期: YYYY-MM-DD  
> 测试人: QA Agent  
> PRD: docs/product/PRD_{feature}.md

---

## 1. 验收标准覆盖矩阵

| AC | 描述 | 测试用例 ID | 状态 |
|----|------|-----------|------|
| AC-01 | 描述 | UT-01, IT-02 | ✅ 已覆盖 |
| AC-02 | 描述 | WT-01 | ⚠️ 部分覆盖 |
| AC-03 | 描述 | — | ❌ 未覆盖 |

---

## 2. 测试用例

### Flutter 单测（UT-）

| ID | 描述 | 文件 | 状态 |
|----|------|------|------|
| UT-01 | Provider 加载成功时返回数据列表 | test/unit/features/{feature}/providers/ | — |
| UT-02 | Provider 加载失败时暴露 error 状态 | test/unit/features/{feature}/providers/ | — |
| UT-03 | Repository 接口调用正确参数 | test/unit/features/{feature}/data/ | — |

### Flutter Widget 测试（WT-）

| ID | 描述 | 文件 | 状态 |
|----|------|------|------|
| WT-01 | 加载中显示 CircularProgressIndicator | test/widget/features/{feature}/ | — |
| WT-02 | 空状态显示引导 Widget | test/widget/features/{feature}/ | — |
| WT-03 | 数据正常时渲染列表 | test/widget/features/{feature}/ | — |

### FastAPI 单测（ST-）

| ID | 描述 | 文件 | 状态 |
|----|------|------|------|
| ST-01 | Service 创建资源成功 | tests/unit/test_{feature}_service.py | — |
| ST-02 | Service 输入无效时抛出正确异常 | tests/unit/test_{feature}_service.py | — |
| ST-03 | Service 用户隔离（只返回当前用户数据） | tests/unit/test_{feature}_service.py | — |

### FastAPI 集成测试（IT-）

| ID | 描述 | 文件 | 状态 |
|----|------|------|------|
| IT-01 | POST /api/v1/{feature} 201 Created | tests/integration/test_{feature}_api.py | — |
| IT-02 | GET /api/v1/{feature}/{id} 200 OK | tests/integration/test_{feature}_api.py | — |
| IT-03 | 未认证请求返回 401 | tests/integration/test_{feature}_api.py | — |

### 契约测试（CT-）

| ID | 描述 | 文件 | 状态 |
|----|------|------|------|
| CT-01 | openapi.json 中声明的所有端点都存在 | tests/contract/test_openapi_contract.py | — |
| CT-02 | 响应结构与 openapi.json schema 一致 | tests/contract/test_openapi_contract.py | — |

---

## 3. 测试结果

### 运行时间：YYYY-MM-DD HH:MM

| 套件 | 通过 | 失败 | 跳过 |
|------|------|------|------|
| Flutter analyze | ✅ / ❌ | — | — |
| Flutter 单测 | X | X | X |
| Flutter Widget 测试 | X | X | X |
| Flutter 集成测试 | X | X | X |
| FastAPI 单测 | X | X | X |
| FastAPI 集成测试 | X | X | X |
| 契约测试 | X | X | X |

### 失败详情

（列出失败用例及错误信息）

---

## 4. 未覆盖场景说明

| 场景 | 原因 | 风险等级 |
|------|------|---------|
| 场景描述 | 技术限制 / 时间 / 范围外 | 高 / 中 / 低 |

---

## 5. 结论

**[ PASS 🟢 ]** — 所有测试通过，所有 AC 已覆盖  
**[ FAIL 🔴 ]** — 原因：...（填写失败原因）
