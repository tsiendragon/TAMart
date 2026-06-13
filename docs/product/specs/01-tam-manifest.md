# Spec 01 — `tam.yaml` Manifest 规范(M1,规范性)

> 状态:Draft for M1。范围:v1 = Claude Code + Cursor。
> 本文是 `tam.yaml` 的**规范性**定义,`tam validate` 必须据此校验。

## 1. 文件位置与编码

- 包根目录下唯一的 `tam.yaml`(UTF-8,LF)。
- 同时存在 `tam.yaml` 与 `tam.yml` → **错误** `E_MANIFEST_AMBIGUOUS`。

## 2. 顶层字段

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| `schema` | int | 是 | 当前为 `1`;未知值 → `E_SCHEMA_UNSUPPORTED` |
| `name` | string | 是 | `@scope/name`;`scope`、`name` 各匹配 `^[a-z0-9][a-z0-9-]{0,38}$`;否则 `E_NAME_INVALID` |
| `version` | string | 是 | 严格 semver `x.y.z`(可带 `-pre`/`+build`);否则 `E_VERSION_INVALID` |
| `description` | string | 是 | 1–200 字符 |
| `license` | string | 是 | SPDX 标识符;非 SPDX → `W_LICENSE_NONSTANDARD`(警告) |
| `keywords` | string[] | 否 | ≤ 10 项,各 ≤ 32 字符 |
| `repository` | string(url) | 否 | https URL |
| `targets` | enum[] | 否 | `claude-code` \| `cursor`(v1);省略=两者尽力适配。出现 `codex`/`opencode` → `W_TARGET_DEFERRED` |
| `assets` | Asset[] | 是 | ≥ 1 项;见 §3 |
| `permissions` | Permissions | 条件 | 含可执行资产时必填;见 §4 |
| `dependencies` | map<pkg,range> | 否 | 见 §5 |

## 3. `assets[]`

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| `type` | enum | 是 | `rule`\|`skill`\|`agent`\|`command`\|`hook`\|`mcp` |
| `id` | string | 是 | `^[a-z0-9][a-z0-9-]{0,63}$`;**包内唯一**,否则 `E_ASSET_ID_DUP` |
| `src` | path | 是 | 相对包根;必须存在且在包根内(禁 `..`/绝对路径/符号链接逃逸)→ `E_SRC_ESCAPE`/`E_SRC_MISSING` |
| `scope` | enum | 否 | `project`(默认)\|`user` |
| `attach` | object | 否 | 仅 `type: rule` 合法;`{ globs: string[], alwaysApply: bool }` |

**按类型的附加校验**:

- `skill`:`src` 为目录,必须含 `SKILL.md`,其 frontmatter 必须有 `description`。
- `agent`/`command`/`rule`:`src` 为含 frontmatter 的 `.md` 文件。
- `hook`:`src` 为 `.yaml`，字段校验按 [Spec 04 §5.2](./04-hook.md) 执行：M1 必须校验所有 `E_*` 级别错误（`E_HOOK_UNKNOWN_EVENT`、`E_HOOK_MISSING_MATCHER`、`E_HOOK_INVALID_PATTERN`、`E_HOOK_INVALID_COMBO`、`E_HOOK_REDOS_RISK`）；M3 扩展为完整 capability profile 与平台映射校验（per-platform 支持级别计算）。
- `mcp`:`src` 为 server 声明 yaml;env 值仅允许 `${ENV_VAR}` 引用,出现明文 → `E_SECRET_INLINE`。
- `attach` 出现在非 rule 资产 → `E_ATTACH_MISPLACED`。

## 4. `permissions`(可执行资产强制)

```yaml
permissions:
  exec: [bash]          # 允许的解释器;空/缺失但存在 hook 或带脚本的 skill → E_PERM_UNDECLARED
  network: []           # 声明的出网域名;空=不出网
```

- 含 `hook`、或 `skill` 目录内含可执行脚本(`scripts/**`)的包,**必须**声明 `permissions.exec`,否则 `E_PERM_UNDECLARED`(发布即拒)。
- `network` 为声明值;运行时由权限 broker 对 **tam 托管脚本**强制(见 PRD §5),不可强制处标注"未验证声明"。

## 5. `dependencies`

- 形如 `"@scope/name": "^1.2.0"`,semver range(npm 语义)。
- 扁平解析,冲突取最高兼容版本;资产 `id` 跨包冲突 → 安装期 `E_ASSET_CONFLICT`(需 `--force`)。
- 依赖按 **scope↔registry 绑定**解析,防依赖混淆(见 Spec 02 §4)。

## 6. `tam validate` 验收标准

```gherkin
Scenario: 合法 manifest
  Given 一个字段齐全、src 均存在、含 hook 且已声明 exec 的包
  When 运行 `tam validate`
  Then 退出码 0,输出四象限适配报告(每资产×每 target 的支持级别)

Scenario: 未声明权限的可执行包
  Given 含 hook 但 permissions.exec 缺失
  When 运行 `tam validate`
  Then 退出码非 0,报 E_PERM_UNDECLARED,指出 asset id

Scenario: src 逃逸包根
  Given 某 asset.src 含 `../`
  When 运行 `tam validate`
  Then 退出码非 0,报 E_SRC_ESCAPE

Scenario: 明文 secret
  Given mcp 声明含明文 token
  When 运行 `tam validate`
  Then 退出码非 0,报 E_SECRET_INLINE,定位字段

Scenario: hook 事件名非法
  Given 含 hook 的包，hook 文件声明 event: pre:nonexistent
  When 运行 `tam validate`
  Then 退出码非 0，报 E_HOOK_UNKNOWN_EVENT，指出 hook 文件路径与 event 字段

Scenario: hook 缺少 matcher
  Given 含 hook 的包，hook 文件声明 event: pre:shell 但未提供 matcher.pattern
  When 运行 `tam validate`
  Then 退出码非 0，报 E_HOOK_MISSING_MATCHER

Scenario: hook ReDoS 风险
  Given 含 hook 的包，hook 文件的 matcher.pattern 为 `(a+)+b`
  When 运行 `tam validate`
  Then 退出码非 0，报 E_HOOK_REDOS_RISK
```

- `tam validate` 对所有 `E_*` 退出码 `1`,仅 `W_*` 时退出码 `0` 但打印警告。
- `--strict` 下 `W_*` 也视为失败(CI 用)。
