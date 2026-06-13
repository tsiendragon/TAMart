# TAMart 工程规范(specs/)

交工程前的 M1 规范性细节,补齐 [`../PRD.md`](../PRD.md) §11「仍待办」清单中的可执行契约。
范围:v1 = Claude Code + Cursor。

| Spec | 内容 | 里程碑 | 状态 |
|---|---|---|---|
| [01 — tam.yaml manifest](./01-tam-manifest.md) | 包 manifest 规范性 schema + `tam validate` 验收 | M1 | Draft |
| [02 — registry & 归档](./02-registry.md) | `registry.json` schema + 不可变归档 + package digest + 解析链 | M1 | Draft |
| [03 — install / sync](./03-cli-install-sync.md) | CLI 执行契约 + 事务/幂等/三方合并 + Gherkin 验收 | M1 | Draft |
| [04 — hook 能力格](./04-hook.md) | capability lattice + 无损可移植子集 + tap/1 shim + 编译输出 | M1 参照§4;M3 完整实现 | Draft |
| [05 — adapter capability profile](./05-adapter-profile.md) | profile schema + golden 快照 + 金丝雀 CI | M1+ | Draft |
| [06 — 安全管线](./06-security-pipeline.md) | 运行时边界 + `G_OPEN` 门禁 + 敌意归档 + 吊销 + 滥用治理 | M4 `G_OPEN` | Draft |

**PRD §11 仍待办(尚无对应 spec)**:
- `tam publish` 命令契约
- 元索引逐源合规清单与移除流程
- "零误导降级" QA 测试语料与协议
- 团队/企业强制功能形态(策略文件、CI 强制、审计输出)
- `DESIGN.md` 旧内容同步(§2/§4.3/§5.2/§6.1 已被 PRD v2 取代)
