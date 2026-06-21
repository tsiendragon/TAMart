# E2E Report — <feature> — <YYYY-MM-DD>

> flow spec: `e2e/flows/<feature>.flow.yaml`
> 运行模式: backend | web | native | full

## 总结

| 层 | 范围 | 结果 |
|----|------|------|
| L1 后端全栈 | API 端到端 / 同步 / 落库 | PASS / FAIL / 跳过 |
| L2 web (Playwright) | UI 全链路 / 视觉 / 网络 | PASS / FAIL / 跳过 |
| L3 native (integration_test) | 原生 DB / 平台通道 | PASS / FAIL / 跳过 |

## Flow 步骤执行

| # | 步骤 | identifier | 结果 | 备注 |
|---|------|-----------|------|------|
| 1 | tap login-submit-btn | login-submit-btn | ✅ | |
| 2 | expect_screen home | home | ✅ | |
| … | | | | |

## 数据库断言

| table | where | expect | 结果 |
|-------|-------|--------|------|
| transactions | {amount_cents:1250} | exists | ✅ |

## 网络断言（L2）

| method | path | expect | 结果 |
|--------|------|--------|------|
| POST | /api/v1/transactions | 200 / code:0 | ✅ |

## 视觉回归（L2）

| 基线 | diff ratio | 阈值 | 结果 |
|------|-----------|------|------|
| after-create-txn | 0.003 | 0.01 | ✅ |

新增/更新基线：（列出，需在 PR 说明原因）

## 失败用例

（有失败时列出：层 / 步骤 / 期望 vs 实际 / fixture 路径）

## 自愈修复记录

| 失败归类 | 根因 | 修复（文件） | 回归护栏 | 状态 |
|---------|------|------------|---------|------|
| UI | 缺 identifier | frontend/.../txn_form.dart | widget test | ✅ 已修 |
| 契约 | 字段不符 | （已升级 /db-design，未自行改） | — | ⏸ 待门控 |

## 验收标准覆盖

| AC | 描述 | flow 步骤 | 状态 |
|----|------|----------|------|
| AC-01 | … | 1–4 | ✅ |
| AC-02 | … | — | ❌ 未覆盖 |

## Promote 状态（web → native）

- [ ] L2 通过的 flow 已 promote 为 L3 用例（`e2e-promote.sh`）
- [ ] L3 在模拟器回归通过

## 结论

[PASS 🟢] 指定层全通过，db/视觉断言通过，覆盖 AC
[FAIL 🔴] 失败原因：…
