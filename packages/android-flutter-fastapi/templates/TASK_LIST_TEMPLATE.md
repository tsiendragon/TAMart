# TASK_LIST — {Feature Name}

> 功能 ID: F-XXX  
> Tech Design: docs/design/FEATURE_{feature}.md  
> 数据库已确认: YYYY-MM-DD  
> 创建日期: YYYY-MM-DD  
> 状态: Planning → In Progress → Done

---

## 使用规则

1. **每轮 Claude 对话只执行一个 Task**
2. 开始前声明：「当前任务：T-XX — 描述。验证命令：cmd。预计改动：files。」
3. 完成后更新 ☐ → ✅，然后 `git commit -m "type(scope): T-XX 描述"`
4. 依赖的任务必须 ✅ 才能开始后续任务

---

## 任务清单

### Phase 1 — 后端数据层

| ID | 描述 | 层 | 文件 | 依赖 | 验证命令 | 状态 |
|----|------|-----|------|------|---------|------|
| T-01 | 创建 Alembic migration | DB | `backend/alembic/versions/xxx.py` | — | `alembic upgrade head && alembic downgrade -1 && alembic upgrade +1` | ☐ |
| T-02 | 创建 ORM Model | Model | `backend/app/models/{feature}.py` | T-01 ✅ | `python3 -m py_compile backend/app/models/{feature}.py` | ☐ |

### Phase 2 — 后端业务层

| ID | 描述 | 层 | 文件 | 依赖 | 验证命令 | 状态 |
|----|------|-----|------|------|---------|------|
| T-03 | 创建 Pydantic schema | Schema | `backend/app/schemas/{feature}_schema.py` | — | `python3 -m py_compile backend/app/schemas/{feature}_schema.py` | ☐ |
| T-04 | 创建 Repository 层 | Repository | `backend/app/repositories/{feature}_repo.py` | T-02 ✅ | `python3 -m py_compile backend/app/repositories/{feature}_repo.py` | ☐ |
| T-05 | 创建 Service 层 | Service | `backend/app/services/{feature}_service.py` | T-04 ✅ | `PYTHONPATH=backend pytest backend/tests/unit/test_{feature}_service.py -v` | ☐ |

### Phase 3 — 后端 API 层

| ID | 描述 | 层 | 文件 | 依赖 | 验证命令 | 状态 |
|----|------|-----|------|------|---------|------|
| T-06 | 创建 Router + 注册端点 | Router | `backend/app/routers/{feature}.py` | T-05 ✅, T-03 ✅ | `PYTHONPATH=backend pytest backend/tests/integration/test_{feature}_api.py -v` | ☐ |
| T-07 | 生成 openapi.json + HTML | Build | `docs/api/openapi.json`, `docs/api/index.html` | T-06 ✅ | `make gen-docs && [ -f docs/api/openapi.json ]` | ☐ |

### Phase 4 — Flutter 层

| ID | 描述 | 层 | 文件 | 依赖 | 验证命令 | 状态 |
|----|------|-----|------|------|---------|------|
| T-08 | 生成 Dart API client | Build | `frontend/lib/core/api_client/generated/` | T-07 ✅ | `make gen-client && flutter analyze frontend/lib/core/api_client/` | ☐ |
| T-09 | 创建 Domain 层（实体 + 接口） | Domain | `frontend/lib/features/{feature}/domain/` | T-07 ✅ | `flutter analyze frontend/lib/features/{feature}/domain/` | ☐ |
| T-10 | 创建 Data 层（Repository 实现） | Data | `frontend/lib/features/{feature}/data/` | T-08 ✅, T-09 ✅ | `flutter test frontend/test/unit/features/{feature}/data/` | ☐ |
| T-11 | 创建 Providers | Provider | `frontend/lib/features/{feature}/presentation/providers/` | T-10 ✅ | `flutter test frontend/test/unit/features/{feature}/providers/` | ☐ |
| T-12 | 创建 Screen + Widget | UI | `frontend/lib/features/{feature}/presentation/` | T-11 ✅ | `flutter test frontend/test/widget/features/{feature}/` | ☐ |

### Phase 5 — 测试

| ID | 描述 | 层 | 文件 | 依赖 | 验证命令 | 状态 |
|----|------|-----|------|------|---------|------|
| T-13 | 契约测试 | Test | `backend/tests/contract/` | T-07 ✅ | `PYTHONPATH=backend pytest backend/tests/contract/ -v` | ☐ |
| T-14 | 集成测试 | Test | `frontend/integration_test/` | T-12 ✅ | `flutter test integration_test/features/{feature}_test.dart` | ☐ |

---

## 进度

完成: 0 / 14 tasks  
最后更新: YYYY-MM-DD
