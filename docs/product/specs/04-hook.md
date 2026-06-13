# Spec 04 — Hook 能力格(M1 便携子集 + M3 完整实现,规范性)

> 状态:Draft(M3 完整实现;M1 Adapter 参照 §4 便携子集判断支持级别)
> 本文是 TAMart hook 系统的**规范性**定义。`tam validate` 与 Adapter 层必须据此校验与生成。

## 1. 设计目标

### 1.1 问题陈述

各平台对 hook 的实现在四个维度上存在不可调和的差异:

| 维度 | Claude Code | Cursor | 差异性质 |
|---|---|---|---|
| cadence | pre / post | 主要 pre | post-shell 仅 Claude Code 支持 |
| 阻断语义 | pre 阻断,exit≠0 取消工具调用 | pre 阻断,exit≠0 取消 | 语义相近但不完全等价 |
| input 可变 | PreToolUse 可修改 input | 不支持 | 结构性差异 |
| payload 格式 | JSON via stdin,结构化字段 | 平台自有格式,字段名不同 | 无公共 schema |
| session 事件 | SessionStart / Stop | 无直接对应 | 生命周期粒度不同 |

早期设计采用"中立事件 + 统一 stdin + exit 2"方案,试图用单一语义层抹平差异。该方案的 BLOCKER:当平台不支持某能力维度(如 input_mutability)时,运行时静默忽略,脚本认为已修改输入但修改实际未生效,造成**语义撒谎**——比跳过执行更危险。

### 1.2 解法

**能力格(capability lattice) + 无损可移植子集 + fail closed**:

1. **能力格**:每个 hook 声明 8 个正交能力维度(§2)。Adapter 计算该能力向量在目标平台的支持矩阵。
2. **无损可移植子集**:明确定义在 M1 两个平台(Claude Code + Cursor)上均无损的能力组合(§4)。子集内不降级、不 shim。
3. **fail closed**:子集外的能力,在不支持的平台**拒绝生成配置**或以声明的 `on-unsupported` 策略处理——永远不生成语义有误的配置。

## 2. 能力维度

每个 hook 文件须隐式或显式声明以下 8 个正交维度。`tam validate` 按本节规则校验。

| 维度 | 合法值 | 含义 |
|---|---|---|
| `cadence` | `pre` \| `post` | hook 在工具调用前还是后触发 |
| `domain` | `shell` \| `file-edit` \| `file-write` \| `mcp` \| `user-prompt` \| `session-start` \| `session-stop` \| `*` | 触发事件的工具/操作域 |
| `blocking` | `true` \| `false` | hook 进程退出码是否影响被触发操作的执行 |
| `input_mutability` | `read-only` \| `mutable` | hook 是否可修改被触发工具的输入 |
| `output_mutability` | `read-only` \| `mutable` | hook 是否可修改被触发工具的输出(仅 post 有意义) |
| `exec_model` | `sync` \| `async` | hook 进程同步阻塞还是异步触发 |
| `payload_schema` | `tap/1` | 注入脚本的 stdin 格式版本(当前唯一合法值) |
| `on_unsupported` | `fail` \| `warn` \| `skip` | 目标平台不支持该能力组合时的降级策略 |

**维度间约束**:
- `output_mutability: mutable` 要求 `cadence: post`;否则 `E_HOOK_INVALID_COMBO`。
- `blocking: false` 与 `input_mutability: mutable` 互斥;否则 `E_HOOK_INVALID_COMBO`。
- `domain: *` 展开为该平台所有已知 domain 的并集;Adapter 对每个展开项独立评估支持性。

## 3. 平台事件映射表(M1:Claude Code + Cursor)

### 3.1 TAMart 规范事件 → Claude Code 原生事件

| TAMart 规范事件 | Claude Code 原生事件 | tool matcher |
|---|---|---|
| `pre:shell` | `PreToolUse` | `tool_name == "Bash"` |
| `post:shell` | `PostToolUse` | `tool_name == "Bash"` |
| `pre:file-edit` | `PreToolUse` | `tool_name == "Edit"` |
| `post:file-edit` | `PostToolUse` | `tool_name == "Edit"` |
| `pre:file-write` | `PreToolUse` | `tool_name == "Write"` |
| `post:file-write` | `PostToolUse` | `tool_name == "Write"` |
| `pre:mcp` | `PreToolUse` | `tool_name =~ "^mcp__"` |
| `post:mcp` | `PostToolUse` | `tool_name =~ "^mcp__"` |
| `pre:user-prompt` | `UserPromptSubmit` | — |
| `pre:session-start` | `SessionStart` | — |
| `pre:session-stop` | `Stop` | — |

### 3.2 TAMart 规范事件 → Cursor 原生事件

| TAMart 规范事件 | Cursor 原生事件 |
|---|---|
| `pre:shell` | `beforeShellExecution` |
| `post:shell` | **unsupported** |
| `pre:file-edit` | **unsupported**（afterFileEdit 为 post 语义，无法在编辑前阻断） |
| `post:file-edit` | `afterFileEdit` |
| `pre:file-write` | **unsupported** |
| `post:file-write` | **unsupported** |
| `pre:mcp` | `beforeMCPExecution` |
| `post:mcp` | **unsupported** |
| `pre:user-prompt` | `beforeSubmitPrompt` |
| `pre:session-start` | **unsupported** |
| `pre:session-stop` | `stop`(语义 partial) |

### 3.3 能力维度平台支持矩阵

| 能力维度 / 值 | Claude Code | Cursor |
|---|---|---|
| `cadence: pre` | supported | supported |
| `cadence: post` | supported | partial(仅 file-edit) |
| `blocking: true` | supported | supported |
| `blocking: false` | supported | unsupported |
| `input_mutability: read-only` | supported | supported |
| `input_mutability: mutable` | supported | unsupported |
| `output_mutability: read-only` | supported | supported |
| `output_mutability: mutable` | supported | unsupported |
| `exec_model: sync` | supported | supported |
| `exec_model: async` | unsupported | unsupported |
| `domain: session-start` | supported | unsupported |
| `domain: session-stop` | supported | partial |
| `domain: file-write` | supported | unsupported |
| `domain: shell(post)` | supported | unsupported |
| `domain: mcp(post)` | supported | unsupported |

## 4. 无损可移植子集(M1:Claude Code + Cursor 的交集)

以下能力组合在 M1 双平台均**完整支持,不需要降级或 shim**:

| 维度 | 子集内合法值 |
|---|---|
| `cadence` | `pre` |
| `domain` | `shell` \| `mcp` \| `user-prompt` |
| `blocking` | `true` |
| `input_mutability` | `read-only` |
| `output_mutability` | `read-only` |
| `exec_model` | `sync` |

**子集外行为的 fail-closed 规则**:

| 子集外能力 | Cursor 侧行为 | Claude Code 侧行为 |
|---|---|---|
| `input_mutability: mutable` | **不生成任何配置**,不生成错误 shim | 正常生成 |
| `output_mutability: mutable` | 不生成任何配置 | 正常生成 |
| `cadence: post` + `domain: shell` | 不生成任何配置 | 正常生成 |
| `cadence: post` + `domain: mcp` | 不生成任何配置 | 正常生成 |
| `cadence: post` + `domain: file-write` | 不生成任何配置 | 正常生成 |
| `cadence: pre` + `domain: file-edit` | 不生成任何配置 | 正常生成 |
| `domain: session-start` | 不生成任何配置 | 正常生成 |
| `domain: session-stop` | partial:生成 `stop` 事件绑定,阻断语义不保证 | 正常生成 |
| `domain: file-write` | 不生成任何配置 | 正常生成 |
| `exec_model: async` | 不生成任何配置 | 不生成任何配置(双平台均 unsupported) |
| `blocking: false` | 不生成任何配置 | 正常生成(fire-and-forget) |

"不生成任何配置"的含义是:**Adapter 跳过该 hook 的目标平台条目**,`tam.lock` 记录该资产在该平台为 `skipped`。最终 `on-unsupported` 策略决定整体安装是否失败:
- `fail`:整体安装失败,`E_UNSUPPORTED_FAIL`
- `warn`:打印告警,继续安装,结果报告标 `skipped`
- `skip`:静默跳过,结果报告标 `skipped`

## 5. Hook 文件格式(`hooks/<id>.yaml`,规范性)

### 5.1 YAML Schema

```yaml
schema: 1                       # 必填,当前唯一合法值为 1
event: pre:shell                # 必填,格式 <cadence>:<domain>,见 §2 合法值
capabilities:
  blocking: true                # bool,默认 true
  input_mutability: read-only   # read-only | mutable,默认 read-only
  output_mutability: read-only  # read-only | mutable,默认 read-only
  exec_model: sync              # sync | async,默认 sync
matcher:
  pattern: "git push.*--force"  # 正则字符串;domain 为 shell 或 mcp 时必填
action:
  run: scripts/check-push.sh   # 相对包根路径;必须存在;必填
  timeout: 10                   # 整数秒;默认 10;最大 30
on-unsupported: warn            # warn | fail | skip;默认 warn
```

### 5.2 字段校验规则

| 字段 | 规则 | 违反时错误码 |
|---|---|---|
| `schema` | 必须为整数 `1` | `E_SCHEMA_UNSUPPORTED` |
| `event` | 必须匹配 `^(pre\|post):(shell\|file-edit\|file-write\|mcp\|user-prompt\|session-start\|session-stop\|\*)$` | `E_HOOK_UNKNOWN_EVENT` |
| `capabilities.exec_model: async` | 当前无平台支持,直接拒绝(不等到运行时) | `E_HOOK_INVALID_COMBO` |
| `capabilities.output_mutability: mutable` + `cadence: pre` | 互斥 | `E_HOOK_INVALID_COMBO` |
| `capabilities.blocking: false` + `input_mutability: mutable` | 互斥 | `E_HOOK_INVALID_COMBO` |
| `matcher.pattern` | `domain` 为 `shell` 或 `mcp` 时必填;缺失 → `E_HOOK_MISSING_MATCHER` | `E_HOOK_MISSING_MATCHER` |
| `matcher.pattern` | 必须为合法 ECMA 正则;无效 → `E_HOOK_INVALID_PATTERN`；并通过静态 ReDoS 检测（指数/多项式回溯模式检测，如 `(a+)+`、嵌套量词等）；命中高风险模式 → `E_HOOK_REDOS_RISK` | `E_HOOK_INVALID_PATTERN` |
| `action.run` | 路径相对包根,禁止 `..` 或绝对路径;文件必须存在 | `E_SRC_MISSING` / `E_SRC_ESCAPE` |
| `action.timeout` | 整数,1–30;超出上限截断并输出 `W_TIMEOUT_CLAMPED` | `W_TIMEOUT_CLAMPED` |
| `on-unsupported` | `warn` \| `fail` \| `skip` | `E_HOOK_UNKNOWN_EVENT` |

**错误码一览**:

| 错误码 | 等级 | 含义 |
|---|---|---|
| `E_HOOK_UNKNOWN_EVENT` | error | `event` 字段值不在已知事件集合内 |
| `E_HOOK_MISSING_MATCHER` | error | shell/mcp domain 缺少 `matcher.pattern` |
| `E_HOOK_INVALID_PATTERN` | error | `matcher.pattern` 不是合法 ECMA 正则 |
| `E_HOOK_INVALID_COMBO` | error | 能力维度组合违反约束 |
| `W_TIMEOUT_CLAMPED` | warning | `timeout` 超过 30 秒上限,已截断为 30 |
| `E_HOOK_REDOS_RISK` | error | `matcher.pattern` 存在已知 ReDoS 风险模式（静态检测命中指数或多项式回溯） |

## 6. Payload Shim(`tap/1` 统一 stdin schema)

### 6.1 `tap/1` 规范 JSON schema

```json
{
  "$schema": "https://tamart.dev/schemas/tap/1/hook-payload.json",
  "type": "object",
  "required": ["schema", "event", "platform", "session"],
  "properties": {
    "schema":   { "type": "string", "const": "tap/1" },
    "event":    { "type": "string", "pattern": "^(pre|post):(shell|file-edit|file-write|mcp|user-prompt|session-start|session-stop)$" },
    "platform": { "type": "string", "enum": ["claude-code", "cursor"] },
    "tool": {
      "oneOf": [
        { "type": "null" },
        {
          "type": "object",
          "required": ["name", "input"],
          "properties": {
            "name":  { "type": "string" },
            "input": { "type": "object" }
          }
        }
      ]
    },
    "session": {
      "type": "object",
      "required": ["id"],
      "properties": {
        "id": { "type": "string" }
      }
    },
    "env": { "type": "object", "additionalProperties": { "type": "string" } }
  }
}
```

- 对工具触发事件（shell/file-edit/file-write/mcp），`tool` 必须为对象；shim 若收到 `tool: null` 时报 `E_SHIM_PAYLOAD_INVALID`（exit 64）。
- 对生命周期/提示事件（session-start/session-stop/user-prompt），`tool` 必须为 `null`；shim 填充 `null`，脚本须容忍此字段缺失。

示例实例:

```json
{
  "schema": "tap/1",
  "event": "pre:shell",
  "platform": "claude-code",
  "tool": {
    "name": "Bash",
    "input": { "command": "git push --force" }
  },
  "session": { "id": "sess-abc123" },
  "env": {}
}
```

### 6.2 平台 payload → `tap/1` 字段映射

**Claude Code → tap/1**:

| tap/1 字段 | Claude Code 原生字段 |
|---|---|
| `schema` | 固定 `"tap/1"` |
| `event` | 由 hook 声明的 `event`(编译期注入) |
| `platform` | 固定 `"claude-code"` |
| `tool.name` | `$.tool_name` |
| `tool.input` | `$.tool_input`(PreToolUse) / `$.tool_response`(PostToolUse) |
| `session.id` | `$.session_id` |
| `env` | 空对象(运行时扩展保留字段) |

**Cursor → tap/1**:

| tap/1 字段 | Cursor 原生字段 |
|---|---|
| `schema` | 固定 `"tap/1"` |
| `event` | 由 hook 声明的 `event`(编译期注入) |
| `platform` | 固定 `"cursor"` |
| `tool.name` | `$.toolName`(beforeShellExecution: `"shell"`;beforeMCPExecution: `$.toolName`) |
| `tool.input` | `beforeShellExecution`: `{ "command": $.command }`;`beforeMCPExecution`: `$.args`;`afterFileEdit`: `{ "path": $.filePath, "content": $.newContent }` |
| `session.id` | `$.sessionId`(如缺失则生成 `cursor-<pid>-<ts>`) |
| `env` | 空对象 |

### 6.3 `tam-shim` 工具

`tam-shim` 是随 hook 资产一起安装的轻量包装器,由 `tam install` 在 `.tam/shims/` 目录下生成。

**调用方式**:

```
tam-shim tap/1 <platform> <script-path>
```

**职责**:

1. 从 stdin 读取平台原生 payload(JSON)
2. 按 §6.2 映射表转换为 `tap/1` 格式
3. 校验转换结果符合 §6.1 JSON schema;不符合则以退出码 `1` 终止,打印 `E_SHIM_PAYLOAD_INVALID`
3.5. 对 `matcher.pattern` 的正则匹配操作设置 **10ms 超时**（独立于 `action.timeout`）；超时时 shim 以退出码 `66`（`E_SHIM_TIMEOUT`）终止，按 fail-closed 处理。
4. 将 `tap/1` JSON 通过 stdin 管道注入 `<script-path>` 进程
5. 透传 `<script-path>` 的 stdout、stderr 和退出码给调用方

**退出码命名空间**：

| 退出码范围 | 来源 | 含义 |
|---|---|---|
| `0` | 脚本 | 允许操作 |
| `2` | 脚本 | 阻断操作（blocking hook 生效） |
| `1`, `3–63` | 脚本 | 脚本内部错误；shim 按 fail-closed 策略处理（默认视为阻断并打印警告） |
| `64` | shim 内部 | `E_SHIM_PAYLOAD_INVALID`：tap/1 schema 校验失败 |
| `65` | shim 内部 | `E_SHIM_SCRIPT_NOT_FOUND`：脚本文件不存在 |
| `66` | shim 内部 | `E_SHIM_TIMEOUT`：正则匹配或脚本执行超时 |
| `67–78` | shim 内部 | 保留 |

**shim 内部错误处理（64–78）**：shim 自身发生内部错误时，**默认 fail-closed**——向平台输出退出码 `2`（blocking 模式）或 `1`（non-blocking 模式），同时向 stderr 打印 `SHIM_INTERNAL_ERROR:<code>` 标记。平台层永远不会收到 64–78 的原始值。

**生成规则**:

- `.tam/shims/` 由 `tam install` 自动创建和管理,列入 `.gitignore`。
- shim 文件为 shell script,不含平台凭证或 API key。
- `tam uninstall` 删除对应 shim 文件;`tam sync` 重建缺失的 shim。
- `tam.lock` 记录每个 shim 文件的路径、内容 sha256 digest 以及生成时的 tam CLI 版本；`tam sync` 对已存在的 shim 重算 digest，不匹配则强制重建（防篡改）；检测到 shim 文件 world-writable 时，拒绝执行并报 `E_SHIM_UNSAFE_PERMISSIONS`。

## 6.4 tam-shim 实现规范（M1 交付物）

### 6.4.1 格式与分发

- **格式**：Node.js CommonJS script（`.js`），与 tam CLI 同语言（TypeScript 编译产物），由 tam CLI 内嵌模板生成，无外部依赖。
- **平台支持**：macOS / Linux（M1）；Windows（M2，生成 `.cmd` 包装器 + 同内容 `.js`）。
- **生成命令**：`tam install` 在写入 hook 相关配置文件时，同步在 `.tam/shims/` 下生成对应 shim 文件；`tam uninstall` 删除对应 shim；`tam sync` 重建缺失或 digest 不匹配的 shim。

### 6.4.2 文件命名与路径

```
.tam/
└── shims/
    └── <platform>-<package-name>-<asset-id>.js   # 每个 hook 资产一个 shim
```

- `<platform>`：`claude-code` 或 `cursor`（M1）
- `<package-name>`：包名中的 scope 和 name 部分，`/` 替换为 `_`
- `<asset-id>`：`tam.yaml` 中 `assets[].id`
- 示例：`.tam/shims/claude-code-okg_git-workflow-block-force-push.js`

### 6.4.3 版本管理

- shim 文件头部嵌入生成它的 tam CLI 版本（注释形式）。
- `tam sync` 比较 shim 头部版本与当前 tam CLI 版本；若不一致，强制重新生成（CLI 版本升级时自动同步所有 shim）。
- `tam.lock` 中每个 shim 条目记录：`shimPath`、`digest`（sha256 of file content）、`tamVersion`（生成时的 tam CLI semver）。

### 6.4.4 .gitignore 管理

- `tam init` 自动向项目 `.gitignore` 追加 `.tam/shims/` 条目（幂等，已存在则跳过）。
- shim 文件不提交进版本库；团队成员 `tam sync` 后自动重建。

### 6.4.5 CI 环境处理

- CI 机器需先运行 `tam sync` 以重建 shim，再执行依赖 hook 的操作。
- `tam sync --shims-only` 仅重建 shim，跳过其他文件的幂等检查（CI 快速路径）。

## 7. 编译输出格式

同一 hook 声明(以 `pre:shell` blocking read-only 为例)编译为各平台原生配置:

**源 hook 声明** (`hooks/check-force-push.yaml`):

```yaml
schema: 1
event: pre:shell
capabilities:
  blocking: true
  input_mutability: read-only
  output_mutability: read-only
  exec_model: sync
matcher:
  pattern: "git push.*--force"
action:
  run: scripts/check-push.sh
  timeout: 10
on-unsupported: warn
```

**编译为 Claude Code `settings.json`**:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".tam/shims/tam-shim tap/1 claude-code scripts/check-push.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

注:Claude Code 的 matcher 在 shell 层执行;`tam-shim` 负责将平台 stdin 转换为 `tap/1` 后再注入脚本,`matcher.pattern` 的正则过滤由 `tam-shim` 在转换后、注入前执行。

**编译为 Cursor `hooks.json`**:

```json
{
  "hooks": [
    {
      "event": "beforeShellExecution",
      "run": ".tam/shims/tam-shim tap/1 cursor scripts/check-push.sh",
      "timeout": 10,
      "blocking": true
    }
  ]
}
```

注:`matcher.pattern` 的正则过滤同样由 `tam-shim` 在注入前执行。Cursor 侧不支持 `input_mutability: mutable`,若声明了该能力则不生成此条目(见 §4)。

## 8. 验收标准

```gherkin
Scenario: 便携子集内 hook 双平台编译成功
  Given 一个 hook 声明 event:pre:shell, blocking:true, input_mutability:read-only,
        output_mutability:read-only, exec_model:sync, on-unsupported:warn
  And 项目同时含 .claude/ 与 .cursor/ 目录
  When `tam install <pkg> --yes`
  Then 退出码 0
  And .claude/settings.json 生成 PreToolUse 条目含 tam-shim 调用
  And .cursor/hooks.json 生成 beforeShellExecution 条目含 tam-shim 调用
  And tam.lock 对该 hook 资产记录 claude-code:native, cursor:native

Scenario: 子集外能力 fail-closed(Cursor 侧不生成任何配置)
  Given 一个 hook 声明 event:pre:shell, input_mutability:mutable, on-unsupported:warn
  And 项目同时含 .claude/ 与 .cursor/ 目录
  When `tam install <pkg> --yes`
  Then 退出码 0
  And .claude/settings.json 生成对应条目(Claude Code 支持 mutable)
  And .cursor/hooks.json 中该 hook 无任何条目
  And 安装报告打印告警,Cursor 侧标记 skipped
  And tam.lock 记录 claude-code:native, cursor:skipped

Scenario: tap/1 shim 转换正确
  Given Claude Code 向 tam-shim 的 stdin 发送原生 PreToolUse payload,
        包含 tool_name:"Bash", tool_input:{"command":"git push --force"}, session_id:"sess-abc123"
  When `tam-shim tap/1 claude-code scripts/check-push.sh` 执行
  Then 脚本收到的 stdin 是合法 tap/1 JSON
  And tap/1.schema == "tap/1"
  And tap/1.event == "pre:shell"
  And tap/1.platform == "claude-code"
  And tap/1.tool.name == "Bash"
  And tap/1.tool.input.command == "git push --force"
  And tap/1.session.id == "sess-abc123"

Scenario: 未知事件名被 tam validate 拒绝
  Given 一个 hook 文件声明 event: pre:nonexistent
  When `tam validate`
  Then 退出码非 0
  And 输出包含错误码 E_HOOK_UNKNOWN_EVENT
  And 错误信息定位到 hook 文件路径与 event 字段
```
