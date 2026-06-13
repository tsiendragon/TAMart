# TAMart — 跨平台 Agent 资产市场设计文档

> ⚠️ **SUPERSEDED 提示(2026-06-13)**:本设计文档为早期版本,以下三处已被
> [`docs/product/PRD.md`](./product/PRD.md) v2.1 + [`specs/`](./product/specs/) **取代,以后者为规范**:
> 1. **hook 模型**:本文 §4.3/§5.2 的"中立事件 + 统一 stdin + exit 2"已被 **能力格 + 无损可移植子集 + fail-closed** 取代(PRD §4.2)。
> 2. **registry**:本文 §6.1 的"源目录 git registry + 阶段二托管"已被 **接收即物化不可变归档 + digest 签名**取代(PRD §4.3 / specs/02)。
> 3. **平台能力 & 安全**:本文 §2 矩阵(Codex 无 hook/skill 等)与 §9 安全级别已被 PRD §1.1/§4.2 收敛现状 + §5/specs/06 安全管线取代。
> 其余章节(资产模型、CLI、lockfile、映射表思路)仍有效。新实现请以 PRD + specs 为准,本文旧路径视为弃用。

> The Agent Marketplace:为 Claude Code、Codex、Cursor Agent、OpenCode 提供统一的
> rules / hooks / skills / agents / commands / MCP / plugin 分发市场。

## 1. 目标与定位

**核心问题**:每个 coding agent 都有自己的扩展体系和文件格式。同一份团队规范
(如 "Git 提交规范" rule、"代码评审" agent、"部署检查" hook)需要为每个工具维护
一份,格式互不兼容,无法统一分发、版本管理和更新。

**TAMart 的定位**:

1. **统一包格式**(Canonical Package):一次编写,声明式描述资产,与具体平台解耦。
2. **适配编译层**(Adapter):安装时把统一格式"编译"成各平台的原生文件。
3. **Registry + CLI + Web**:发布、检索、安装、更新、锁定版本的完整闭环。

**非目标**(至少 v1 不做):运行时代理/拦截层、修改各 agent 本身的行为、
托管 MCP server 运行环境。

## 2. 平台能力调研与差异矩阵

| 资产类型 | Claude Code | Cursor | Codex | OpenCode |
|---|---|---|---|---|
| **Rules** | `CLAUDE.md`、`.claude/rules` | `.cursor/rules/*.mdc`(MDC frontmatter,支持 glob 触发) | `AGENTS.md` | `AGENTS.md`、`opencode.json` instructions |
| **Hooks** | `settings.json` hooks(PreToolUse / PostToolUse / Stop / SessionStart…) | `.cursor/hooks.json`(beforeShellExecution / afterFileEdit / stop…) | ❌ 无通用 hook(仅 notify) | plugin JS 事件(`tool.execute.before` 等) |
| **Skills** | `.claude/skills/<name>/SKILL.md`(渐进式加载,可带脚本) | 支持 Agent Skills 格式 | ❌(可降级为 prompt) | 可降级为 command |
| **Agents(subagent)** | `.claude/agents/*.md` | 自定义 modes(能力较弱) | ❌ | `.opencode/agent/*.md` |
| **Slash Commands** | `.claude/commands/*.md` | `.cursor/commands/*.md` | `~/.codex/prompts/*.md` | `.opencode/command/*.md` |
| **MCP** | `.mcp.json` | `.cursor/mcp.json` | `config.toml [mcp_servers]` | `opencode.json` mcp 段 |
| **Plugin(打包机制)** | `.claude-plugin/`(plugin.json + marketplace.json) | ❌ | ❌ | `.opencode/plugin/*.{js,ts}` |

**关键观察**:

- `AGENTS.md` 已成为事实上的跨工具 rules 标准(Codex、Cursor、OpenCode 均支持),
  可作为 rules 的最大公约数降级目标。
- Hooks 语义差异最大:事件名、payload、阻断方式各不相同,必须做事件映射表;
  Codex 不支持 → 安装时警告并跳过。
- Skills(Anthropic Agent Skills 格式)正在被多家采纳,统一格式应向它对齐。
- 因此每类资产需要定义**支持级别**:`native`(原生支持)/ `translated`(可无损转换)
  / `degraded`(有损降级,如 skill→静态 prompt)/ `unsupported`(跳过并警告)。

## 3. 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                     Web Marketplace                      │
│        浏览 / 搜索 / 详情 / 评分 / 发布者主页              │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS API
┌───────────────────────────┴─────────────────────────────┐
│                    Registry Service                      │
│  包元数据 / 版本 / tarball 存储 / 搜索索引 / 签名校验      │
│  (MVP 可用 git repo + index.json 静态实现)                │
└───────────────────────────┬─────────────────────────────┘
                            │ tarball + manifest
┌───────────────────────────┴─────────────────────────────┐
│                       tam CLI                            │
│   search / info / install / update / publish / sync      │
│              ┌──────── Adapter 编译层 ────────┐           │
│              │ claude-code │ cursor │ codex │ opencode │  │
└──────────────┴─────────────┴────────┴───────┴──────────┘
                            │ 写入原生格式文件
        .claude/   .cursor/   AGENTS.md / ~/.codex/   .opencode/
```

三个交付物:**Registry**(服务端)、**tam CLI**(客户端 + 适配层)、**Web 前端**。
适配层是整个系统的技术核心。

## 4. 统一资产模型(Canonical Package)

### 4.1 包结构

一个包(package)是分发单元,内含一个或多个资产(asset)。`plugin` 不是独立
资产类型,而是"包含多类资产的包"(bundle)。

```
my-package/
├── tam.yaml              # manifest(必需)
├── README.md             # 市场详情页展示(必需)
├── rules/
│   └── git-convention.md
├── skills/
│   └── deploy-check/
│       ├── SKILL.md
│       └── scripts/check.sh
├── agents/
│   └── code-reviewer.md
├── commands/
│   └── changelog.md
├── hooks/
│   └── block-force-push.yaml
├── mcp/
│   └── servers.yaml
└── overrides/            # 可选:平台特定覆盖
    └── cursor/
        └── rules/git-convention.mdc
```

### 4.2 manifest 规范(tam.yaml)

```yaml
schema: 1
name: "@okg/git-workflow"        # scoped 命名,scope = 发布者
version: "1.2.0"                 # semver,版本不可变
description: "OKG Git 工作流规范与自动化"
license: MIT
keywords: [git, workflow, convention]
repository: https://github.com/okg/git-workflow

# 声明支持的平台;adapter 据此编译。省略 = 全部尽力适配
targets: [claude-code, cursor, codex, opencode]

assets:
  - type: rule
    id: git-convention
    src: rules/git-convention.md
    # rule 级元数据,adapter 翻译成各平台触发机制
    scope: project              # project | user
    attach: { globs: ["**/*.ts"], alwaysApply: false }

  - type: skill
    id: deploy-check
    src: skills/deploy-check    # 目录,内含 SKILL.md(对齐 Agent Skills 规范)

  - type: agent
    id: code-reviewer
    src: agents/code-reviewer.md

  - type: command
    id: changelog
    src: commands/changelog.md

  - type: hook
    id: block-force-push
    src: hooks/block-force-push.yaml

  - type: mcp
    id: internal-tools
    src: mcp/servers.yaml

# 资产引用的可执行内容必须声明权限,供审核与安装时提示
permissions:
  exec: ["bash"]                # hook/skill 脚本需要执行权限
  network: []                   # 不访问网络

dependencies:
  "@okg/base-rules": "^2.0.0"
```

### 4.3 各资产类型的统一格式

**rule** — 带 frontmatter 的 markdown,正文即规则内容:

```markdown
---
description: Git 提交与分支规范
---
- 提交信息使用 conventional commits…
```

**hook** — 平台中立的事件声明,这是最需要抽象的部分:

```yaml
# hooks/block-force-push.yaml
event: pre-tool-use            # 统一事件名(见 5.2 映射表)
matcher:
  tool: shell                  # 统一工具名:shell | file-edit | file-write | *
  pattern: "git push.*--force"
action:
  run: scripts/check-push.sh   # 脚本收到统一 JSON stdin,exit 2 = 阻断
  timeout: 10
on-unsupported: warn           # warn | fail | skip
```

**skill / agent / command** — 直接采用 Anthropic Agent Skills / subagent /
slash command 的 markdown + frontmatter 格式作为规范格式(它是表达能力最强、
被采纳最广的),其他平台由 adapter 降级。

**mcp** — 统一的 server 声明(command/args/env 或 url),翻译为各平台配置格式。

## 5. 适配层(Adapter)设计

### 5.1 职责与原则

- 每个平台一个 adapter,实现统一接口:
  `plan(assets) -> FileOps[]`(纯函数,先 dry-run 再落盘)。
- **生成的文件可识别、可重建**:文件头部写入标记注释
  (`<!-- generated by tam: @okg/git-workflow@1.2.0 -->`),
  `tam sync` 时凭标记安全地覆盖/清理,绝不动用户手写的文件。
- 无法翻译时按资产的 `on-unsupported` 策略处理,安装结束输出适配报告
  (哪些 native / degraded / skipped)。

### 5.2 映射规则(核心表)

**rule 映射**:

| 平台 | 落盘方式 |
|---|---|
| claude-code | `.claude/rules/<id>.md`(或追加进 CLAUDE.md 的托管区块) |
| cursor | `.cursor/rules/<id>.mdc`,`attach.globs` → MDC `globs`,`alwaysApply` 直接映射 |
| codex | 合并进 `AGENTS.md` 的托管区块(`<!-- tam:begin -->…<!-- tam:end -->`) |
| opencode | 同 codex,走 `AGENTS.md` |

**hook 事件映射**:

| 统一事件 | claude-code | cursor | opencode | codex |
|---|---|---|---|---|
| `pre-tool-use` | PreToolUse | beforeShellExecution / beforeMCPExecution | `tool.execute.before` | ❌ |
| `post-tool-use` | PostToolUse | afterFileEdit | `tool.execute.after` | ❌ |
| `session-start` | SessionStart | — | `session.created` | ❌ |
| `stop` | Stop | stop | `session.idle` | ❌ |
| `prompt-submit` | UserPromptSubmit | beforeSubmitPrompt | `chat.message` | ❌ |

hook 脚本约定统一 stdin JSON(tam 注入轻量 shim 做各平台 payload → 统一 schema
的转换),exit code 语义统一(0 放行 / 2 阻断)。opencode 的 hook 编译为一个
tam 生成的 plugin JS 包装器。

**skill 映射**:claude-code、cursor 原生;codex 降级为 `~/.codex/prompts/<id>.md`
(把 SKILL.md 正文内联,脚本引用改为相对路径说明);opencode 降级为 command。

**agent 映射**:claude-code、opencode 原生(frontmatter 字段转换:
`tools`/`model` 映射);cursor 降级为 rule(注明"以下为 code-reviewer 角色规范")
或 skip,默认 skip + warn;codex skip。

**mcp 映射**:四个平台全部原生支持,纯配置格式转换(JSON / TOML / MDC)。
env 中的 secret 一律写成 `${ENV_VAR}` 引用,**绝不落盘明文凭据**。

### 5.3 安装产物与 lockfile

```
project/
├── tam.lock          # 已装包、版本、integrity、每个文件的归属与 hash
├── .claude/…         # 各 adapter 生成的原生文件
├── .cursor/…
└── AGENTS.md         # 含 tam 托管区块
```

`tam.lock` 记录每个生成文件的 sha256,`tam sync` 时检测到用户手改过的生成文件
会提示冲突(保留 / 覆盖 / 转为本地 override),类似包管理器的三方合并策略。

## 6. Registry 设计

### 6.1 两阶段演进

**阶段一(MVP):git-based registry。** 一个 git 仓库即一个 registry:
`registry.json` 索引 + 各包源码目录(与 Claude Code marketplace 模式同构,
便于直接兼容)。优点:零运维、PR 即审核流程、天然版本历史。团队/企业可以
自建私有 registry(内网 git 仓库),`tam registry add <git-url>` 即接入。

**阶段二:hosted registry 服务。**

- API(REST):
  - `GET /v1/search?q=&type=&target=` — 搜索(按资产类型、目标平台过滤)
  - `GET /v1/packages/{scope}/{name}` — 元数据 + 版本列表
  - `GET /v1/packages/{scope}/{name}/{version}` — manifest + tarball URL + integrity
  - `PUT /v1/packages/{scope}/{name}/{version}` — 发布(token 鉴权)
  - `GET /v1/packages/{scope}/{name}/stats` — 下载量/评分
- 存储:Postgres(元数据)+ 对象存储(tarball,内容寻址 sha256)+
  Meilisearch/pg trgm(搜索)。
- **版本不可变**:同版本号不可重传,只能发新版本或 yank(撤回但不删除,
  已锁定的安装仍可复现)。
- 多 registry 支持:CLI 配置 registry 列表(官方 + 私有),scope 可绑定
  registry(`@okg/* → 内网 registry`),解析顺序确定。

### 6.2 命名与版本

- 包名:`@scope/name`,scope 即发布者(个人或组织),防 typosquatting。
- semver;`tam install @okg/git-workflow@^1.2` 语义与 npm 一致。
- 依赖解析:扁平、仅一层语义(包可依赖包,冲突时取最高兼容版本;
  资产 id 冲突时后装者失败,提示 `--force`)。

## 7. tam CLI 设计

```bash
tam init                          # 在包目录生成 tam.yaml 脚手架
tam validate                      # 校验 manifest + 各平台适配 dry-run 报告
tam search "code review" --type agent --target cursor
tam info @okg/git-workflow        # 详情 + 兼容性矩阵
tam install @okg/git-workflow     # 自动探测项目里有哪些 agent(.claude/.cursor/…)
tam install @okg/git-workflow --target claude-code,cursor --scope user
tam list / tam outdated / tam update [pkg]
tam uninstall @okg/git-workflow   # 凭 lock 精确清理生成文件
tam sync                          # 按 tam.lock 重建所有生成文件(适合 CI / 新人入职)
tam publish                       # 打包 + 校验 + 上传
tam registry add/list/remove
```

设计要点:

- **target 自动探测**:扫描项目和用户目录中存在哪些 agent 的配置痕迹,
  默认只为检测到的平台编译,`--target` 显式覆盖。
- **scope**:`project`(默认,写入项目目录,可提交进 git 团队共享)/
  `user`(写入 `~/.claude`、`~/.codex` 等用户级目录)。
- 安装前展示**适配报告 + 权限声明**(该包含 N 个 hook、要求 exec 权限),
  用户确认后落盘;`--yes` 供 CI 使用。
- `tam.lock` 提交进 git 后,新成员 clone 下来跑 `tam sync` 即获得全套配置——
  这是团队场景的核心卖点。

## 8. Web Marketplace

- 列表/搜索页:按资产类型、目标平台、标签过滤;兼容性徽章
  (四个平台图标 × native/degraded/unsupported 三态)直接显示在卡片上。
- 详情页:README 渲染、资产清单(每个资产展开看源内容)、**权限声明高亮**
  (含 hook/脚本的包显著标示)、版本历史、安装命令一键复制、下载量与评分。
- 发布者主页 + 认证标识(组织域名验证)。
- 技术选型建议:Next.js + Registry API,SSG 缓存列表页。

## 9. 安全与信任模型

hooks 和 skill 脚本是**任意代码执行**,这是市场最大的风险面:

1. **权限声明强制**:含可执行内容的包必须在 manifest 声明 `permissions`,
   未声明却包含脚本的包发布时被拒绝;安装时向用户展示。
2. **静态扫描**:发布管道扫描脚本(网络外联、读取凭据路径、混淆代码等
   危险模式),命中即进入人工审核队列。
3. **完整性**:tarball 内容寻址(sha256),lock 锁 integrity,杜绝同版本
   内容偷换;可选 sigstore 签名,CLI 校验发布者身份。
4. **凭据红线**:manifest、资产文件、生成的配置中一律禁止明文 secret,
   MCP env 只允许 `${ENV_VAR}` 引用;`tam validate`/`tam publish` 强制检查。
5. **信任分级**:official(官方维护)/ verified(认证组织)/ community;
   CLI 可配置策略(如企业内只允许 official + 私有 registry)。
6. **撤回机制**:恶意包 yank 后,`tam outdated`/`install` 给出安全警告。

## 10. MVP 路线图

| 阶段 | 范围 | 验证目标 |
|---|---|---|
| **M1** | 包格式规范 + `tam` CLI(init/validate/install/sync)+ claude-code & cursor 两个 adapter + git-based registry | 统一格式 + 适配编译这条核心路径是否成立 |
| **M2** | codex & opencode adapter + hook 抽象层(shim)+ lockfile 冲突处理 + uninstall/update | 降级策略的实际体验 |
| **M3** | hosted registry + publish 流程 + 静态扫描 + Web 前端 | 分发闭环 |
| **M4** | 评分/统计、签名、组织认证、私有 registry 商业化特性 | 生态运营 |

技术选型建议:CLI 用 TypeScript(Node ≥ 20,与 opencode plugin 生态同语言,
且四个平台用户必有 Node)单二进制可后续用 bun build;Registry 用同栈
(Hono/Fastify + Postgres)。

## 11. 风险与开放问题

- **各平台格式演进快**:adapter 与平台格式版本绑定,manifest 的 `schema` 字段
  + adapter 内 capability 探测,留好升级空间;映射表(5.2)需要持续维护,
  应配 e2e 快照测试(同一包在四平台的编译产物 golden file)。
- **agent/skill 在弱平台上的降级体验**:降级产物质量决定口碑,M2 要做真实
  用户验证,宁可 skip 也不输出误导性的降级产物。
- **与 Claude Code 官方 plugin marketplace 的关系**:格式上保持可互转
  (`tam export --format claude-plugin`),把官方生态当作入口而非竞品。
- **AGENTS.md 托管区块的写入冲突**:多工具同时编辑该文件,需要稳健的
  区块标记解析与幂等写入。
