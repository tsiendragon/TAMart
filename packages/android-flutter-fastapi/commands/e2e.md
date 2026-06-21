---
name: e2e
description: 端到端测试 — 分层混合（L1 后端全栈 / L2 web+Playwright / L3 原生 integration_test），按 flow spec 驱动，截图+DB 断言，发现问题自愈修复
---

## 用法

```
/e2e <subcommand> <feature> [options]
```

| 子命令 | 作用 |
|--------|------|
| `/e2e backend <feature>` | L1：起 FastAPI + 测试库，跑后端全栈 e2e（含同步 push/pull） |
| `/e2e web <feature>` | L2：构建 Flutter web（语义树）+ Playwright 驱动，截图视觉回归 + 查网络 + 查 DB |
| `/e2e native <feature>` | L3：Android 模拟器跑 integration_test，原生精确断言（真正"测 APK"） |
| `/e2e full <feature>` | L1 → L2 → L3 全跑 + 合并报告 + promote 检查 |
| `/e2e explore <feature>` | 用 Playwright MCP 交互式探索（无脚本），发现路径/缺失 identifier，产出 flow 草案 |
| `/e2e promote <feature>` | 把通过的 L2 flow spec 物化为 L3 integration_test 用例 |

示例：
```
/e2e backend transaction
/e2e web transaction
/e2e web transaction --update-snapshots   # 更新视觉基线（需在 PR 说明）
/e2e native transaction
/e2e full transaction
```

## 前置条件

```
[ ] e2e/flows/<feature>.flow.yaml 存在（缺失先 /e2e explore 生成草案）
[ ] 关键控件已挂 Semantics(identifier:)（reviewer 已校验）
[ ] frontend/lib/main_e2e.dart 存在（web/native e2e 入口，强制开启语义）
[ ] L2 一次性安装：playwright.config.ts（模板 templates/playwright.config.ts.template）
    + package.json（templates/e2e.package.json.template）+ npm i -D @playwright/test
    + npx playwright install --with-deps chromium
[ ] L3 需 Android 模拟器/设备
```

> 一次性脚手架安装清单（从 templates/ 拷到目标项目）：
> `playwright.config.ts` · `package.json`(e2e 段) · `frontend/lib/main_e2e.dart` · `e2e/playwright/<feature>.spec.ts`(由 spec 模板生成) · `e2e/flows/<feature>.flow.yaml`

## 执行步骤

以 `e2e-tester` agent 角色运行。

**步骤 1 — 读取 flow spec 与验收标准**
- 读 `e2e/flows/<feature>.flow.yaml`（步骤/identifier/断言）
- 读 `docs/product/PRD_<feature>.md`，把 flow 步骤对回 AC

**步骤 2 — 起后端（L1/L2/L3 都依赖）**
```bash
bash scripts/e2e-backend-run.sh <feature> docker   # 或 test（in-process）
```

**步骤 3 — 按子命令执行对应层**
```bash
# L2 web
bash scripts/e2e-web-run.sh <feature>
# L3 native
bash scripts/e2e-promote.sh <feature>      # 若 L3 用例尚未生成
bash scripts/e2e-native-run.sh <feature>
```

**步骤 4 — 数据库断言**
```bash
# 按 flow 的 db_assert 段逐条核对
bash scripts/assert-db.sh --table <t> --where '<json>' --expect <exists|count:N>
```

**步骤 5 — 失败自愈循环**（见 e2e-tester agent §自愈）
- 归类失败（UI / 逻辑 / 契约 / DB）→ 最小修复（≤3 文件）→ 补回归护栏 → 重跑
- 涉及 schema / 同步协议 / API 字段 → **不得静默改**，回 `/db-design` 或 architect 门控

**步骤 6 — 生成报告**
按 `templates/E2E_REPORT_TEMPLATE.md` 写 `e2e/reports/E2E_REPORT_<feature>_<date>.md`。

## 通过条件（全部满足）

- [ ] flow 全部步骤通过（对应层）
- [ ] 所有 `db_assert` PASS
- [ ] L2 视觉 diff 在阈值内（`maxDiffPixelRatio ≤ 0.01`）
- [ ] `full` 模式下 L1/L2/L3 三层均绿
- [ ] flow 覆盖的 AC 全部验证

## 禁止
- 未跑 flow 就输出"e2e 通过"
- 用坐标点击 canvas 代替 identifier 定位（脆，禁止）
- 仅 L2 通过就宣称"APK 可用"（须 L3 验证，见 spec 07 §2.3）
- 自愈时静默修改 schema / 同步协议 / API 字段（须走门控）
- 未在 PR 说明就更新视觉基线
