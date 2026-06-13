# Spec 05 — Adapter Capability Profile、Golden 快照与金丝雀 CI(M1+,规范性)

> 状态:Draft(M1+)。落实 PRD v2.1 §6 capability profile + golden 快照 + 金丝雀 CI。
> 本文是各平台支持级别的**唯一事实源**,adapter、CLI 报告、市场徽章**全部从 profile 生成,不允许硬编码**。

## 1. 设计目标

### 1.1 问题

| 问题 | 现状 |
|---|---|
| 支持级别多处维护 | PRD、DESIGN、CLI 代码、徽章各维护一套,已出现矛盾 |
| 平台格式演进无自动检测 | 平台静默更改 schema/语义,TAMart 无感知,产物可能失效 |
| 稳定性退化无防护 | adapter 代码改动可能悄然改变生成路径或格式 |

### 1.2 解法

1. **单一 profile YAML**:每个平台工具的支持能力在 `profiles/<tool>@<major>.yaml` 中声明一次,adapter、CLI 报告、市场徽章以及 `tam validate` 均从此文件生成,禁止另起炉灶。
2. **Golden 快照测试**:对固定 fixture 包运行 adapter,比对生成的文件树与版本库中提交的期望快照,保护 TAMart 自身的稳定性。
3. **金丝雀 CI**:定期/上游发版时自动向真实平台执行安装+验证,检测平台运行时语义漂移。

---

## 2. Profile 文件位置与命名约定

```
tamart/
├── profiles/
│   ├── claude-code@0.yaml   # 主版本绑定 breaking-change 边界
│   ├── cursor@0.yaml
│   └── _schema.yaml         # profile 的 JSON Schema(校验所有 profile 文件)
```

### 2.1 命名规则

- 格式:`<tool>@<major>.yaml`
  - `tool`:与 `tam.yaml` 中 `targets[]` 枚举对齐,如 `claude-code`、`cursor`。
  - `major`:从 `0` 起的非负整数,代表 profile 格式的 breaking-change 边界(**非**平台版本号)。
- minor/patch 级别的平台更新:修改现有文件并更新 `lastCanaryPass`。
- breaking format 变更:新建 `<tool>@<n+1>.yaml`,旧版添加 `deprecated: true`(见 §7)。

### 2.2 adapter 版本锁定

- adapter 安装时取当前活跃(非 deprecated)的 profile 文件。
- 支持通过 `--adapter-profile claude-code@0` 显式锁定某一主版本 profile;锁定版本已 deprecated 时打印 `W_PROFILE_DEPRECATED` 但继续。

---

## 3. Profile Schema 定义

### 3.1 claude-code@0.yaml

```yaml
# profiles/claude-code@0.yaml
tool: claude-code
profileVersion: 0
description: "Claude Code CLI — native support baseline"
docUrl: "https://docs.anthropic.com/claude-code"
managedMarker: "# managed by tam"
owner: "team-tamart@okg.com"
expiryDays: 90          # 超过此天数未通过金丝雀则打印 W_PROFILE_STALE
lastCanaryPass: null    # 首次金丝雀通过后填写,格式 ISO-8601

assets:

  rule:
    support: native
    features:
      alwaysApply: supported
      globs: supported
      description: supported
    output:
      mode: file
      targetDir: ".claude/rules/"
      extension: ".md"

  skill:
    support: native
    features:
      description: supported
      examples: supported
    output:
      mode: file
      targetDir: ".claude/skills/"
      extension: "/"          # 目录,保留 src 内部结构

  agent:
    support: native
    features:
      description: supported
      model: supported
    output:
      mode: file
      targetDir: ".claude/agents/"
      extension: ".md"

  command:
    support: native
    features:
      description: supported
      args: supported
    output:
      mode: file
      targetDir: ".claude/commands/"
      extension: ".md"

  hook:
    support: native
    hookFile: ".claude/settings.json"
    hookFileFormat: json-merge   # 与已有 settings.json 合并,不替换整文件
    events:
      "pre:shell":
        nativeName: PreToolUse
        toolMatcher: Bash
        blocking: supported
        input_mutability: supported
        output_mutability: supported
        exec_model: sync
      "pre:file-edit":
        nativeName: PreToolUse
        toolMatcher: Edit
        blocking: supported
        input_mutability: supported
        output_mutability: unsupported
        exec_model: sync
      "pre:file-write":
        nativeName: PreToolUse
        toolMatcher: Write
        blocking: supported
        input_mutability: supported
        output_mutability: unsupported
        exec_model: sync
      "pre:mcp":
        nativeName: PreToolUse
        toolMatcher: mcp__*
        blocking: supported
        input_mutability: supported
        output_mutability: unsupported
        exec_model: sync
      "pre:user-prompt":
        nativeName: UserPromptSubmit
        toolMatcher: null
        blocking: supported
        input_mutability: supported
        output_mutability: unsupported
        exec_model: sync
      "post:shell":
        nativeName: PostToolUse
        toolMatcher: Bash
        blocking: unsupported
        input_mutability: unsupported
        output_mutability: supported
        exec_model: sync
      "post:file-edit":
        nativeName: PostToolUse
        toolMatcher: Edit
        blocking: unsupported
        input_mutability: unsupported
        output_mutability: unsupported
        exec_model: sync
      "session-start":
        nativeName: SessionStart
        toolMatcher: null
        blocking: unsupported
        input_mutability: unsupported
        output_mutability: unsupported
        exec_model: sync
      "session-stop":
        nativeName: Stop
        toolMatcher: null
        blocking: unsupported
        input_mutability: unsupported
        output_mutability: unsupported
        exec_model: sync

  mcp:
    support: native
    configFile: ".mcp.json"
    configFormat: json
    envValueRule: env-var-ref-only   # env 值只允许 ${ENV_VAR} 形式,明文 → E_SECRET_INLINE
```

### 3.2 cursor@0.yaml

```yaml
# profiles/cursor@0.yaml
tool: cursor
profileVersion: 0
description: "Cursor IDE — translated support baseline"
docUrl: "https://docs.cursor.com"
managedMarker: "<!-- managed by tam -->"
owner: "team-tamart@okg.com"
expiryDays: 60          # Cursor 迭代快,缩短过期窗口
lastCanaryPass: null

assets:

  rule:
    support: native
    features:
      alwaysApply: supported
      globs: supported
      description: supported
    output:
      mode: file
      targetDir: ".cursor/rules/"
      extension: ".mdc"
      frontmatterTransform:
        alwaysApply: alwaysApply   # 字段名与 Claude Code 一致,无需重映射
        globs: globs

  skill:
    support: native
    features:
      description: supported
      examples: supported
    output:
      mode: file
      targetDir: ".cursor/skills/"
      extension: "/"              # 目录,保留 src 内部结构

  agent:
    support: native
    features:
      description: supported
      model: unsupported           # Cursor 不支持 per-agent model 声明
    output:
      mode: file
      targetDir: ".cursor/agents/"
      extension: ".md"

  command:
    support: native
    features:
      description: supported
      args: supported
    output:
      mode: file
      targetDir: ".cursor/commands/"
      extension: ".md"

  hook:
    support: translated            # 需要格式转换,部分事件不可用
    hookFile: ".cursor/hooks.json"
    hookFileFormat: json-replace   # 整文件替换(Cursor 不支持合并写入)
    events:
      "pre:shell":
        nativeName: beforeShellExecution
        toolMatcher: null
        blocking: supported
        input_mutability: unsupported
        output_mutability: unsupported
        exec_model: sync
      "pre:file-edit":
        nativeName: null
        blocking: unsupported      # Cursor 无此事件;hook 对该平台判定为 unsupported
        input_mutability: unsupported
        output_mutability: unsupported
        exec_model: null
      "pre:file-write":
        nativeName: null
        blocking: unsupported
        input_mutability: unsupported
        output_mutability: unsupported
        exec_model: null
      "pre:mcp":
        nativeName: beforeMCPExecution
        toolMatcher: null
        blocking: supported
        input_mutability: unsupported
        output_mutability: unsupported
        exec_model: sync
      "pre:user-prompt":
        nativeName: beforeSubmitPrompt
        toolMatcher: null
        blocking: supported
        input_mutability: unsupported
        output_mutability: unsupported
        exec_model: sync
      "post:shell":
        nativeName: null
        blocking: unsupported
        input_mutability: unsupported
        output_mutability: unsupported
        exec_model: null
      "post:file-edit":
        nativeName: afterFileEdit
        toolMatcher: null
        blocking: unsupported
        input_mutability: unsupported
        output_mutability: unsupported
        exec_model: async
      "session-start":
        nativeName: null
        blocking: unsupported
        input_mutability: unsupported
        output_mutability: unsupported
        exec_model: null
      "session-stop":
        nativeName: stop
        toolMatcher: null
        blocking: unsupported
        input_mutability: unsupported
        output_mutability: unsupported
        exec_model: async

  mcp:
    support: native
    configFile: ".cursor/mcp.json"
    configFormat: json
    envValueRule: env-var-ref-only
```

### 3.3 `profiles/_schema.yaml` 定义

`_schema.yaml` 是所有 profile 文件的 JSON Schema 元定义，adapter 代码和 CI pipeline 用它校验 profile 合法性（`tam validate` 报 `E_PROFILE_INVALID` 即来源于此）。

```yaml
# profiles/_schema.yaml
$schema: "https://json-schema.org/draft/2020-12"
type: object
required: [tool, profileVersion, description, managedMarker, owner, expiryDays, assets]
properties:
  tool:
    type: string
    enum: [claude-code, cursor, codex, opencode]
  profileVersion:
    type: integer
    minimum: 0
  description:
    type: string
    minLength: 1
  docUrl:
    type: string
    format: uri
  managedMarker:
    type: string
    minLength: 1
  owner:
    type: string
    minLength: 1
    description: "必须为邮件列表地址（team- 前缀），不接受个人邮箱"
  expiryDays:
    type: integer
    minimum: 1
  lastCanaryPass:
    type: [string, "null"]
    format: date-time
  deprecated:
    type: boolean
    default: false
  assets:
    type: object
    required: [rule, skill, agent, command, hook, mcp]
    properties:
      rule:    { $ref: "#/$defs/assetSpec" }
      skill:   { $ref: "#/$defs/assetSpec" }
      agent:   { $ref: "#/$defs/assetSpec" }
      command: { $ref: "#/$defs/assetSpec" }
      hook:    { $ref: "#/$defs/hookAssetSpec" }
      mcp:     { $ref: "#/$defs/assetSpec" }

$defs:
  supportLevel:
    type: string
    enum: [native, translated, degraded, unsupported]

  assetSpec:
    type: object
    required: [support]
    properties:
      support: { $ref: "#/$defs/supportLevel" }
      features:
        type: object
        additionalProperties:
          type: string
          enum: [supported, unsupported]
      output:
        type: object
        required: [mode]
        properties:
          mode:
            type: string
            enum: [file, managed-block, config-merge]

  capabilityValue:
    type: string
    enum: [supported, unsupported, partial]

  hookEventSpec:
    type: object
    required: [blocking, input_mutability, output_mutability, exec_model]
    properties:
      nativeName:     { type: [string, "null"] }
      toolMatcher:    { type: [string, "null"] }
      blocking:       { $ref: "#/$defs/capabilityValue" }
      input_mutability:  { $ref: "#/$defs/capabilityValue" }
      output_mutability: { $ref: "#/$defs/capabilityValue" }
      exec_model:        { $ref: "#/$defs/capabilityValue" }

  hookAssetSpec:
    allOf:
      - { $ref: "#/$defs/assetSpec" }
      - type: object
        required: [hookFile, hookFileFormat, events]
        properties:
          hookFile:
            type: string
          hookFileFormat:
            type: string
            enum: [json-merge, json-replace, toml, yaml]
          events:
            type: object
            # 必须包含 Spec 04 §3.1 定义的所有规范事件
            required:
              - "pre:shell"
              - "pre:file-edit"
              - "pre:file-write"
              - "pre:mcp"
              - "pre:user-prompt"
              - "post:shell"
              - "post:file-edit"
              - "session-start"
              - "session-stop"
            additionalProperties:
              $ref: "#/$defs/hookEventSpec"
```

**校验约定**：
- `_schema.yaml` 自身作为 M1 交付物，与 profile 文件同目录提交。
- CI pipeline 在 golden 测试前先用 `_schema.yaml` 校验所有 `profiles/*.yaml`；校验失败 → `E_PROFILE_INVALID`，golden 测试跳过。
- `owner` 字段必须为 `team-` 前缀的邮件列表地址（不接受个人邮箱），由 `_schema.yaml` 的 pattern 约束（实现时补充 `pattern: "^team-"`）。

---

## 4. Adapter 使用 Profile 的约定

### 4.1 FileOp 生成

Adapter 从 profile 读取各资产类型的 `output` 配置,计算 `FileOp[]`(纯函数,不落盘):

- `mode: file` → 按 `targetDir + assetId + extension` 产生写入 op。
- `mode: managed-block` → 在 `managedBlockFile` 的托管区块内写入;区块边界由 `managedBlockMarker` 标识。
- `mode: config-merge` → 将资产配置合并写入目标 config 文件(如 settings.json)。

### 4.2 支持级别计算规则

资产的最终支持级别由以下规则确定,取**最低**级别:

```
support_level = min(
    type.support,               // 该资产类型的顶层 support
    min(feature.status for each feature used by the asset)
)
```

支持级别从高到低排序:`native > translated > degraded > unsupported`。

**hook 额外规则(fail-closed)**:hook 所需的任一 capability 维度(`blocking`、`input_mutability`、`output_mutability`)在目标平台为 `unsupported`,则该 hook 对该平台整体判定为 `unsupported`。宁可拒绝安装,不可静默降级为无效 hook。

### 4.3 单一事实源约束

| 消费方 | 约束 |
|---|---|
| CLI `tam validate --report` | 从 profile 生成支持级别矩阵,禁止硬编码 |
| 市场徽章(compatible / partial / unsupported) | 从 profile 的 `support` 字段生成 |
| `registry.json` 中的 `compat` 字段(Spec 02 §3) | 发布时由 CI 从 profile 计算写入 |
| adapter `plan()` 函数 | 直接读取 profile output 配置,不内联路径字符串 |

### 4.4 Profile 过期告警

- `lastCanaryPass` 与当前日期之差超过 `expiryDays`,**或** `lastCanaryPass` 为 `null` 且 profile 文件 mtime 超过 `expiryDays` → 打印 `W_PROFILE_STALE`。
- 打印告警后安装**继续**,不报错退出(stale 是警告,不是阻断)。

---

## 5. Golden File 测试

### 5.1 目录结构

```
tests/
└── golden/
    ├── fixtures/
    │   ├── all-assets/         # 含所有资产类型的 fixture 包(有完整 tam.yaml)
    │   └── hook-portable/      # 仅含便携子集 hook(不含 Cursor 不支持事件)的 fixture 包
    └── expected/
        ├── claude-code/
        │   ├── all-assets/     # 对 claude-code 运行 adapter 后的预期文件树
        │   └── hook-portable/
        └── cursor/
            ├── all-assets/
            └── hook-portable/
```

### 5.2 Golden 测试约定

| 约定 | 说明 |
|---|---|
| fixture 来源 | 人工创建,提交到版本库;不由构建自动生成 |
| 对比命令 | `npm test -- --golden` |
| 更新命令 | `npm run golden:update`(必须附 code review,不允许无审查合入) |
| `expected/` 变更合法性 | 必须附 profile 变更或 adapter 代码变更作为原因;纯 expected 产物变更视为 CI 失败 |
| 幂等断言 | golden 测试额外断言"对已安装状态再次运行 sync 产生零 FileOp" |
| 差异格式 | 失败时输出 unified diff,精确标出第一处不匹配的文件与行号 |

### 5.3 与 adapter 代码变更的关联

- adapter 修改 `plan()` 函数时,必须同步更新 `expected/` 并在 PR 描述中说明原因。
- CI pipeline 在 golden 对比之前先校验 profile YAML 合法性(`_schema.yaml` 校验),profile 非法则 golden 测试跳过并以 `E_PROFILE_INVALID` 报错。

---

## 6. 金丝雀 CI(Canary CI)

### 6.1 目的与触发方式

金丝雀 CI 的目的是检测**平台真实运行时语义**与 profile 声明之间的漂移,与 golden 测试互补:golden 保护 TAMart 稳定性,金丝雀保护对外集成的有效性。

| 触发类型 | 触发机制 | 频率 |
|---|---|---|
| 定时金丝雀 | cron | 每日一次 |
| 平台版本变更 | 监听 upstream release(GitHub release event / RSS) | 上游发版后约 1h |
| 手动 | `tam canary --tool cursor@latest` | 随时 |

### 6.2 金丝雀流程

1. 拉取目标工具的指定版本(如 `cursor@latest`),记录实际版本号。
2. 用 `all-assets` fixture 包运行 `tam install --target <tool> --yes`,收集所有生成文件。
3. 用工具原生 schema 验证器(如 Cursor 的 hooks.json schema、Claude Code settings.json schema)校验生成文件的合法性。
4. 触发冒烟 hook:构造触发条件,验证声明为 blocking(`blocking: supported`)的 hook 确实阻断目标操作(预期 exit code 2 生效)。
5. 记录结果和实际工具版本号 → 写入 profile 的 `lastCanaryPass`(ISO-8601 时间戳)。
6. 任一步骤失败 → 告警 + 自动打开 GitHub Issue(含工具版本、失败步骤、生成文件 diff),并将 profile 标记为 stale。

### 6.3 失败处理

| 失败类型 | 行为 |
|---|---|
| 工具 schema 变更导致生成文件被拒(步骤 3) | profile 标 stale,自动打开 issue,`tam install` 打印 `W_PROFILE_STALE` |
| hook 执行语义变更(exit 2 不再阻断,步骤 4) | 同上,额外在 issue 打标 `SECURITY_DRIFT` |
| 仅工具版本升级但产物仍有效(全步骤通过) | 更新 `lastCanaryPass`,无告警,无 issue |
| 金丝雀 CI 自身基础设施故障 | 不修改 profile;发告警说明原因;不触发 stale |

### 6.4 SECURITY_DRIFT 处理

标有 `SECURITY_DRIFT` 的 issue 需人工确认影响范围:

- 若 blocking hook 的失效影响安全相关场景,profile 责任人应在 24h 内评估是否需要发布 `@<n+1>` profile。
- 修复前,`tam install` 对受影响 hook 资产打印 `W_PROFILE_STALE`;若资产声明 `on-unsupported: fail` 则整体失败。

---

## 7. Profile 演进协议

1. **breaking change**:创建 `<tool>@<n+1>.yaml`,旧版文件添加 `deprecated: true`。breaking change 定义:output 路径/格式变更、hook 事件映射变更、新增必填顶层字段。
2. **deprecated profile 的包约束**:
   - 锁定到 deprecated profile 的包:**无法新发布、无法新安装**。
   - 已通过 `--adapter-profile <tool>@n` 锁定的已安装包:**可继续 sync**,打印 `W_PROFILE_DEPRECATED`。
3. **profile 责任人**:`owner` 字段指定的责任人负责监听上游 release、响应金丝雀 CI 告警、评估是否需要发布新 profile 主版本。
4. **profile 变更审查**:所有 profile 文件变更需通过 PR,至少一名 TAMart 维护者审查;不允许直接推送 `main`。
5. **profile 完整性保护（Day-1 红线）**：
   - profile 文件纳入 `CODEOWNERS`，修改任何 `profiles/` 文件须至少一名安全背景维护者（security-reviewer）参与审查，不可仅由功能开发者单独合入。
   - 以下字段变更被视为**高危变更**，须额外标注 `security-review-required` label 并延迟 24h 合并（安全审查窗口）：`targetDir`、`configFile`、`hookFile`、`managedBlockFile`、`envValueRule`。
   - M2 起，profile 发布时对文件内容用 sigstore bundle 签名（与包签名同机制）；CLI 安装前校验 profile 签名，签名无效 → `E_PROFILE_SIGNATURE_INVALID`，拒绝安装。

6. **金丝雀 CI 写回安全（防篡改 lastCanaryPass）**：
   - `lastCanaryPass` 更新由专用 CI bot 账号执行，bot 的 git push 权限范围通过 branch protection rule 限制为：仅允许修改 `profiles/*.yaml` 文件中的 `lastCanaryPass` 字段，任何其他字段变更须走 PR 流程。
   - `lastCanaryPass` 的变更必须附带金丝雀 CI run ID（写入 `canaryRunId` 字段），用于审计追溯，防止手动伪造。

---

## 8. 验收标准

```gherkin
Scenario: 支持级别从 profile 生成,无硬编码
  Given profiles/claude-code@0.yaml 和 profiles/cursor@0.yaml 存在且合法
  When 运行 `tam validate --report` 对一个含 rule、hook、mcp 的包
  Then 退出码 0
  And 输出的支持级别矩阵(每资产×每 target)与 profile 中 support 字段完全一致
  And 矩阵中不存在任何未经 profile 声明的支持级别值

Scenario: Golden 测试检测 adapter 退化
  Given expected/cursor/all-assets/ 已提交,cursor rule 输出路径为 .cursor/rules/
  When adapter 代码改变 cursor 下 rule 文件的 targetDir(如改为 .cursor/custom/)
  And 运行 `npm test -- --golden`
  Then CI 失败
  And 输出 unified diff 指出 .cursor/rules/ 与 .cursor/custom/ 的路径差异
  And 不允许在无 profile 变更的情况下合入 expected/ 的修改

Scenario: 金丝雀 CI 检测平台漂移
  Given profiles/cursor@0.yaml 中 hookFile 为 .cursor/hooks.json
  When Cursor 发布新版本并更改 hooks.json 的顶层 schema(如将 hooks 数组改为 hooks 对象)
  And 金丝雀 CI 在上游发版约 1h 后触发
  Then 步骤 3(原生 schema 校验)失败
  And 金丝雀 CI 自动打开 GitHub Issue,标注工具版本与失败步骤
  And profiles/cursor@0.yaml 的 stale 状态被更新
  And 后续 `tam install --target cursor` 打印 W_PROFILE_STALE

Scenario: Stale profile 打印告警但安装继续
  Given profiles/cursor@0.yaml 的 lastCanaryPass 距今超过 expiryDays(60 天)
  When 运行 `tam install @okg/foo --target cursor`
  Then stderr 包含 W_PROFILE_STALE,注明 profile 名称和距上次通过的天数
  And 安装继续执行
  And 退出码 0(stale 不阻断安装)
```
