# TAMart 工程规范(specs/)

交工程前的 M1 规范性细节,补齐 [`../PRD.md`](../PRD.md) §11「仍待办」清单中的可执行契约。
范围:v1 = Claude Code + Cursor。

| Spec | 内容 | 状态 |
|---|---|---|
| [01 — tam.yaml manifest](./01-tam-manifest.md) | 包 manifest 规范性 schema + `tam validate` 验收 | Draft(M1) |
| [02 — registry & 归档](./02-registry.md) | `registry.json` schema + 不可变归档 + package digest + 解析链 | Draft(M1) |
| [03 — install / sync](./03-cli-install-sync.md) | CLI 执行契约 + 事务/幂等/三方合并 + Gherkin 验收 | Draft(M1) |

待补(后续里程碑):`04-hook.md`(hook 能力格,M3)、`05-adapter-profile.md`(capability profile 格式 + golden/金丝雀 CI)、`06-security-pipeline.md`(扫描/隔离/签名/yank/权限 broker,M4 `G_OPEN`)。
