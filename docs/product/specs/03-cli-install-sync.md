# Spec 03 — `tam install` / `tam sync` 执行契约与验收标准(M1)

> 状态:Draft for M1。范围:Claude Code + Cursor。落实 PRD v2 §4.4/§8 的幂等、原子、可逆要求。

## 1. 通用约定

- **退出码**:`0` 成功;`1` 用户/校验错误(`E_*`);`2` 冲突需决策;`3` 内部/IO 错误。
- **scope 标志**:
  - `--local`(默认):写当前项目目录(`.claude/`、`.cursor/`);等价于旧 `--scope project`。
  - `--global`:写用户级目录(`~/.claude/`、`~/.cursor/`);等价于旧 `--scope user`。
  - 底层 API 保留 `scope: "project"|"user"` 枚举;CLI 层将 `--global/--local` 转换。
- **pkg 参数**:可以是 registry 包名(`@scope/name[@version]`)或**本地路径**(`./path/to/pkg`、`/abs/path`)。
  本地路径须含 `tam.yaml`;仍执行完整 plan → preview → 事务落盘 → `tam.lock` 流程。
- **target**:默认**自动探测**(见 §2);`--target claude-code,cursor` 显式覆盖。
- **非交互**:`--yes` 自动确认;`--dry-run` 只打印计划不落盘;CI 应同时用 `--yes`(冲突仍以退出码 `2` 失败,不静默覆盖)。
- **托管标记**:每个生成文件/区块写入 `tam` 标记,含 `package@version`、`assetId`、`target`、内容 `digest`。
- **auth**:install/sync 只读,免鉴权;`publish`(后置)需 token。

## 2. target 自动探测

| 探测信号 | 判定 target |
|---|---|
| 存在 `.claude/` 或 `CLAUDE.md` | claude-code |
| 存在 `.cursor/` | cursor |
| 均无 | 报 `E_NO_TARGET_DETECTED`,提示用 `--target` |

`--global` 时探测用户级目录(`~/.claude`、`~/.cursor`)。

## 3. `tam install <pkg>` 流程

```
1. 解析 + 归档校验(Spec 02 §5)
2. 探测/取 target;对每 target 调 adapter.plan(assets) → FileOp[]（纯函数，不落盘）
3. 计算适配报告（每资产×target 支持级别）+ 权限声明 + 文件 diff
4. 展示报告；非 --yes 则等待确认
5. 冲突检查（§5）；有冲突 → 退出码 2，按 --on-conflict 策略
6. 事务落盘（§4）：写文件 → 更新 tam.lock（全部成功后）
7. 打印结果：native/translated/degraded/skipped 统计
```

- 任一资产对所有选定 target 均 `unsupported` 且其 `on-unsupported: fail` → 整体失败 `E_UNSUPPORTED_FAIL`;
  默认 `warn` 则跳过该资产并在报告标 `skipped`。

## 4. 事务性与幂等(关键)

- 写操作:对 scope 根加**文件锁**;所有产物先写 `*.tmp` 再**原子 rename**;`tam.lock` 在全部文件写成功后**最后**更新。
- 崩溃恢复:存在 `tam.lock.journal` 说明上次事务未完成 → 下次 `install`/`sync` 先**回滚或重放**至一致态,再继续。
- 幂等:对同一 lock 重复 `sync` 产生**零 FileOp**(已收敛);golden 测试断言"二次 sync 无变更"。
- **shim 完整性**：`tam install` 在写入 hook 相关配置的同时，向 `.tam/shims/` 生成对应 shim 文件，并将每个 shim 的 `shimPath`、`digest`（sha256 of file content）、`tamVersion` 写入 `tam.lock`；`tam sync` 对已存在 shim 执行 digest 校验，不匹配则强制重建（防篡改）；检测到 shim 文件 world-writable 时，打印 `E_SHIM_UNSAFE_PERMISSIONS` 并拒绝执行该 shim。

## 5. 冲突检测与三方合并

`tam.lock` 为每个生成文件/区块存 `baseDigest`(上次生成内容)与当前期望内容。

| 现状 | 用户改过? | 期望变化? | 行为 |
|---|---|---|---|
| 文件 hash == baseDigest | 否 | 是 | 安全覆盖 |
| 文件 hash != baseDigest | 是 | 否 | 保留用户内容 + `W_USER_MODIFIED` |
| 文件 hash != baseDigest | 是 | 是 | **冲突** → 退出码 2;`--on-conflict keep|overwrite|local-override`(默认交互询问) |
| 手写文件(无标记) | — | — | **绝不触碰** |

- **`AGENTS.md` 托管区块**:标记含 `package/asset/target/digest`,归属记入 lock;两个包声明同区块且无显式替换关系 → `E_BLOCK_OWNERSHIP`。区块内用户编辑触发归属转移(后续 sync/uninstall 不再当作生成内容)。

## 6. `tam sync` 与 `tam uninstall`

- `sync`:按 `tam.lock` 重建所有生成文件(新人入职 / CI);先修复未完成事务,再幂等收敛。
- `uninstall <pkg>`:凭 lock 精确删除该包生成的文件/区块;被用户改过的区块按 §5 策略处理,不静默丢弃。

## 7. 验收标准

```gherkin
Scenario: registry 包干净安装(双 target,project scope)
  Given 项目含 .claude/ 与 .cursor/,装一个含 skill+rule 的包
  When `tam install @okg/foo --yes`
  Then 退出码 0;.claude 与 .cursor 下生成带标记文件;tam.lock 记录每文件 digest 与归属

Scenario: 本地路径安装到全局(--global)
  Given ~/repos/.claude/skills/ccm-playwright-test/ 含合法 tam.yaml
  When `tam install ~/repos/.claude/skills/ccm-playwright-test --global --yes`
  Then 退出码 0;~/.claude/skills/ 下生成带标记文件;~/.claude/tam.lock 记录归属与 digest

Scenario: 本地路径安装到当前项目(--local,默认)
  Given ./packages/my-skill/ 含合法 tam.yaml,当前目录含 .claude/
  When `tam install ./packages/my-skill`
  Then 展示 diff 预览;确认后退出码 0;.claude/ 下生成文件;tam.lock 更新

Scenario: 幂等 sync
  Given 已安装且无改动
  When 连续两次 `tam sync`
  Then 第二次产生零变更(无文件被重写)

Scenario: 用户改过生成文件 + 包有更新
  Given 用户编辑了某生成的 .mdc,且新版本改了该资产
  When `tam update`
  Then 退出码 2,报冲突,按 --on-conflict 处理;无 flag 时交互询问,绝不静默覆盖

Scenario: 手写文件不受影响
  Given 项目有手写 CLAUDE.md(无 tam 标记)
  When install/sync/uninstall
  Then 该文件字节不变

Scenario: 崩溃后恢复
  Given 上次 install 在写文件与写 lock 之间中断(存在 journal)
  When 再次 `tam sync`
  Then 先回滚/重放至一致态,最终结果与一次成功安装等价

Scenario: dry-run 无副作用
  When `tam install @okg/foo --dry-run`
  Then 打印完整计划与 diff;文件系统与 tam.lock 均无改动;退出码 0

Scenario: shim 篡改检测
  Given 已安装含 hook 的包，.tam/shims/ 下对应 shim 文件被外部进程修改
  When 运行 `tam sync`
  Then 检测到 shim digest 与 tam.lock 记录不匹配
  And shim 文件被强制重建为 tam.lock 中记录版本
  And 退出码 0（重建成功）
```
