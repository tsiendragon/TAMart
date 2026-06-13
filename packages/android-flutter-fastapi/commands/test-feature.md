---
name: test-feature
description: 运行完整测试套件（单测/集成/契约），生成结构化测试报告，验收标准全覆盖才出具通过结论
---

## 用法

```
/test-feature <feature> [scope]
```

示例：
```
/test-feature user-profile          # 运行全部测试
/test-feature user-profile backend  # 只运行后端测试
/test-feature user-profile flutter  # 只运行 Flutter 测试
/test-feature user-profile contract # 只运行契约测试
```

## 前置条件

```
[ ] TASK_LIST_<feature>.md 所有实现任务（非测试任务）已 ✅
[ ] openapi.json 已更新（.claude/state/openapi.stale 不存在）
```

## 执行步骤

以 `qa` agent 角色运行：

**步骤 1 — 读取验收标准**
- 读 `docs/product/PRD_<feature>.md`，提取所有 AC-XX 验收标准
- 建立「验收标准 → 测试用例」覆盖矩阵

**步骤 2 — 运行 Flutter 测试**（scope = flutter 或 all）

```bash
cd frontend
flutter analyze lib/features/<feature>/

flutter test test/unit/features/<feature>/ -v 2>&1 | tee /tmp/flutter-unit.log
flutter test test/widget/features/<feature>/ -v 2>&1 | tee /tmp/flutter-widget.log
flutter test integration_test/features/<feature>_test.dart 2>&1 | tee /tmp/flutter-integration.log
```

**步骤 3 — 运行 FastAPI 测试**（scope = backend 或 all）

```bash
cd backend
PYTHONPATH=. DATABASE_URL=sqlite:///:memory: \
  pytest tests/unit/test_<feature>_service.py -v 2>&1 | tee /tmp/fastapi-unit.log

PYTHONPATH=. DATABASE_URL=sqlite:///./test.db \
  pytest tests/integration/test_<feature>_api.py -v 2>&1 | tee /tmp/fastapi-integration.log
```

**步骤 4 — 运行契约测试**（scope = contract 或 all）

```bash
cd backend
PYTHONPATH=. pytest tests/contract/test_openapi_contract.py -v 2>&1 | tee /tmp/contract.log
```

**步骤 5 — 生成测试报告**

创建 `docs/internal/TEST_PLAN_<feature>.md`，输出以下格式：

```markdown
## Test Report — <feature> — <date>

### 总结
- Flutter 代码分析: PASS / FAIL (N errors)
- Flutter 单测: X/X PASS
- Flutter Widget 测试: X/X PASS
- Flutter 集成测试: X/X PASS
- FastAPI 单测: X/X PASS
- FastAPI 集成测试: X/X PASS
- 契约测试: PASS / FAIL

### 验收标准覆盖
| AC | 描述 | 测试用例 | 状态 |
|----|------|---------|------|
| AC-01 | ... | UT-03 | ✅ |
| AC-02 | ... | — | ❌ 未覆盖 |

### 失败用例
（有失败时列出，含错误信息）

### 结论
[PASS 🟢] 所有测试通过，所有 AC 已覆盖
[FAIL 🔴] 失败原因：...（不符合通过条件时输出）
```

## 通过条件（全部满足）

- [ ] `flutter analyze` 无 error
- [ ] 所有单测通过
- [ ] 契约测试通过
- [ ] 所有 PRD 验收标准 AC 已覆盖（或有明确未覆盖原因说明）

## 禁止
- 未运行测试输出"测试通过"
- 跳过契约测试
- 将"部分覆盖"报告为"完整覆盖"
- 测试 FAIL 时继续执行 `/review` 或 `/release`
