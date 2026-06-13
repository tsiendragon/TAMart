# TAMart 产品需求文档(PRD)

> **The Agent Marketplace** — 跨平台 AI coding agent 组件市场。
> 一次编写,编译并安装到 Claude Code / Cursor / Codex / OpenCode 的原生格式;
> 开放的第三方发布生态,git 仓库即注册中心。

- **文档状态**:Draft v2.1(v2 吸收第一轮评审 8 项修复;v2.1 据 Codex v2 复评做范围传播 + 据安全重跑加固 §5)
- **最后更新**:2026-06-13
- **关联文档**:[`docs/DESIGN.md`](../DESIGN.md)(技术设计)、[`docs/product/REVIEW.md`](./REVIEW.md)(评审汇总)
- **定位决策**:最终愿景为公开开放市场(支持第三方上传);**v1 收窄为 Claude+Cursor、CLI 优先、只读授权索引**,开放上传由安全门禁解锁

### 版本变更(v1 → v2)

1. registry 改为"接收即物化**不可变归档**",指针仅作 provenance。
2. 路线图引入**安全发布门禁**:开放上传不得早于扫描+签名+yank+权限 broker。
3. hooks 采用**能力格 + 无损可移植子集 + fail closed**。
4. **收窄 v1**:Claude+Cursor、CLI 优先;Codex/OpenCode/开放上传/publish-through/hook 翻译后置。
5. 冷启动改为**合规优先**,主打"导入并编译我的配置 + 团队复现"。
6. 引入**北极星指标**(周留存可移植安装)与一组可测市场健康度指标。
7. 护城河重定位为遥测 + 信任数据 + 企业采用 + 作者关系(格式编译是 wedge 不是 moat)。

---

## 1. 背景与问题

### 1.1 市场现状(2026 年中)

四个主流 coding agent 各有扩展体系,且生态正在**部分收敛**:

- **Skills**:`SKILL.md` 格式(同样的 frontmatter:`description`、`disable-model-invocation`)
  已被 Claude Code、Cursor、Codex(2025-12 起)、OpenCode **四家原生读取**。
- **Rules**:`AGENTS.md` 成为 Linux Foundation(Agentic AI Foundation)治理的事实标准;
  Codex / Cursor / OpenCode 原生读取,Cursor 仅在 glob 触发时额外用 `.mdc`。
- **Commands**:四家均为 markdown。
- **Subagents**:Claude / Cursor(已原生)/ OpenCode 支持,仅 Codex 缺失。
- **Hooks**:**唯一仍显著分裂的维度** —— 事件名、payload、阻断语义各不相同
  (Cursor 对齐 Claude 事件集并新增 `beforeShellExecution`/`beforeMCPExecution`;
  Codex 通过 `codex_hooks=true` 实验开启;OpenCode 用 plugin JS 事件)。
- **原生市场**:Claude(`claude-plugins-official` + `claude-community`,git 多后端 + 审核 + 安全扫描)
  与 Cursor(2026-02 上线,`.cursor-plugin/marketplace.json`,5 类 primitive,人工审核 + 团队分发模式)
  的打包模型已**高度同构**。

### 1.2 真正的缺口

现有跨工具方案只解决了**一部分**:

- **仅同步 rules**:AgentSync(11 工具)、RuleSync —— 不覆盖 skills/agents/hooks/MCP。
- **仅 skills/MCP 商店**:Smithery(100K+)、LobeHub(169K+)、USK/AI Skill Store —— 不覆盖完整 primitive、不保证跨工具一致。
- **原生市场**:Claude / Cursor 各自封闭,组件不能跨工具安装。

**没有任何产品提供"完整 primitive 集 × 跨工具保证 × 安装进各工具原生格式"。**
这是 TAMart 的立足点。

### 1.3 一句话价值主张

> 在一个地方搜索**所有**生态的 agent 组件;无论它为哪个工具编写,都能**编译并安装到你正在用的工具**;发布一次,可同时分发到各原生市场。

---

## 2. 目标与非目标

### 2.1 目标(完整愿景)

> **重要**:本节是**完整愿景**目标(覆盖四工具 + 开放市场)。**v1 实际交付范围以 §2.3 为准**;
> 后文 §3–§8 多数章节描述完整能力面,每节标注的 "v1:" 限定即指 §2.3 的子集。

- **G1 跨工具编译**:统一资产模型 → Claude/Cursor/Codex/OpenCode 原生文件,带支持级别报告。(v1:仅 Claude+Cursor)
- **G2 开放市场**:第三方可发布;git-repo 索引,PR 即提交 + 审核 + 审计。(v1:只读授权索引,开放上传后置)
- **G3 冷启动**:**合规优先**地索引(opt-in/官方 feed/宽松许可)并编译现有生态组件,提供兼容性徽章;**不裸抓取**(见 §4.5)。
- **G4 团队级一致性**:`tam.lock` + `tam sync`,一份配置跨工具复现(企业 wedge)。
- **G5 安全可信**:**红线与原则从 M1 即 Day-1 生效**(权限声明、明文 secret 禁止、不可变归档 + digest 签名);
  **完整开放上传管线**(扫描队列/信任分级/紧急吊销/takedown)在 **M4 `G_OPEN`** 达成——因为这些控制只在"开放第三方上传"时才需要。两者不矛盾(见 §5/§9)。
- **G6 发布直通(publish-through)**:一次 `tam publish` 可额外生成 Claude/Cursor 原生包并发起提交。**(后置,见 §2.3)**

> **护城河说明**:格式编译是**进入 wedge**,不是可持续护城河(skills/rules/commands 已收敛、平台会自带)。
> 可持续护城河 = 跨工具**兼容性遥测** + **信任/声誉数据** + **企业 lockfile 采用** + **作者 fan-out 关系**。
> 路线图与指标据此设计。

### 2.2 非目标(至少 v1 不做)

- 运行时代理 / 拦截层,不修改各 agent 本身行为。
- 不托管 MCP server 运行环境。
- 不做付费托管 IDE / 云执行。
- ~~不自建二进制对象存储~~ → **已撤销**:registry 接收时必须物化不可变归档(见 §4.3),否则破坏 `tam.lock` 可复现性。

### 2.3 v1 范围收窄(评审结论)

完整愿景覆盖四工具 + 全 primitive + 开放上传,对 v1 过宽。**v1 明确边界**:

- **平台**:仅 **Claude Code + Cursor**(打包模型近孪生,编译成本最低)。Codex / OpenCode 后置。
- **形态**:**CLI 优先**(install / sync / lock / validate);Web 为只读浏览 + 兼容性徽章。
- **内容**:**只读授权索引**(opt-in / 官方 feed / 宽松许可),pass-through skills/rules/commands/MCP。
- **后置到 v2+**:开放第三方上传、评分、publish-through、hook 跨工具翻译、Codex/OpenCode adapter。
- **解锁条件**:开放上传必须在安全门禁(§9)全部就绪后才打开。

---

## 3. 用户与场景

### 3.1 Persona

| Persona | 诉求 | 关键功能 |
|---|---|---|
| **个人开发者(消费者)** | 想给自己的工具加能力,不在乎它原本为哪家写的 | 搜索、兼容性徽章、一行安装、跨工具编译 |
| **组件作者(生产者)** | 写一次,触达四个生态的用户 | `tam publish`、发布直通、版本管理、下载/评分 |
| **团队 / 平台工程(企业)** | 全团队跨工具配置一致、可审计、可强制 | `tam sync`、`tam.lock`、enforcement 策略、私有 registry |
| **市场运营 / 审核者** | 控制恶意组件、维护信任分级 | 扫描队列、yank/takedown、信任标识 |

### 3.2 核心用户故事

1. 作为消费者,我搜索 "code review",看到一个为 Claude 写的 skill 标注"Cursor✓(已编译)/ Codex⚠(hook 不支持)",一行命令装进我的 Cursor。
2. 作为作者,我 `tam publish @me/test-gen`,它通过扫描后出现在市场,并可选地同时向 Claude-community 发起提交。
3. 作为平台工程,我把 `tam.lock` 提交进团队仓库,新人 clone 后 `tam sync` 即获得全套规范(无论他用哪个工具)。
4. 作为审核者,我在 PR CI 上看到某包读取 `~/.ssh`,自动进入隔离队列等待人工复核。

---

## 4. 产品范围与功能需求

### 4.1 资产模型(Canonical Package)

沿用 `docs/DESIGN.md` §4:一个 package = 分发单元,含一个或多个 asset
(rule / skill / agent / command / hook / mcp);`plugin` 即"含多类资产的 bundle"。
manifest 为 `tam.yaml`(name/version/description/targets/assets/permissions/dependencies)。

**收敛带来的简化(对 DESIGN.md 的更新)**:

- skill(`SKILL.md`)、rule(`AGENTS.md`)、command(markdown)→ **pass-through,不翻译**。
- adapter 真正工作量集中在:**hooks 事件映射**、**subagent frontmatter**、**MCP 配置格式**、
  **打包进各 target 的 manifest**(`.claude-plugin/` 与 `.cursor-plugin/` 近孪生,一个 emitter 双 profile)。

### 4.2 平台支持级别(支持级别矩阵)

每类资产对每个平台标注:`native` / `translated` / `degraded` / `unsupported`。

| 资产 | Claude Code | Cursor | Codex | OpenCode |
|---|---|---|---|---|
| Rule | native | native(+`.mdc` glob) | native(AGENTS.md) | native(AGENTS.md) |
| Skill | native | native | native | native |
| Command | native | native | native(prompts) | native |
| Subagent | native | native | unsupported | native |
| Hook | native | translated | translated-experimental(`codex_hooks`) | translated(plugin JS) |
| MCP | native | native | native(TOML) | native |

**支持级别按 feature 报告、按"最弱未支持项"汇总为包级徽章**(避免 rule 正文 native 但 `globs` 不支持却标 native)。
hook **不采用单一中立事件模型**,改用**能力格(capability lattice)**:cadence(pre/post)、tool domain、payload 字段、
阻断模式、输入/输出可变性、同步/异步、权限覆盖。定义一个**无损可移植子集**,子集内编译、**子集外 fail closed**
(标 unsupported + warn,不输出可能错误的产物),平台特定行为需显式 hook 覆盖声明。

### 4.3 注册中心(git-repo 索引 + 不可变归档)

- 一个公开 git 仓库承载**索引**(`registry.json`),同时是合法的 Claude / Cursor marketplace。
- **接收入库即物化不可变归档(关键修正)**:入库时把包归一化为**唯一 canonical package 归档格式**,
  按 **package digest** 内容寻址存档于 TAMart 控制的存储;发布者 repo + commit sha 仅作 **provenance**。
  这样上游删除 / 转私有 / force-push+GC / LFS·submodule 丢失都**不影响**已 `tam.lock` 的复现。
- **版本不可变**:同 `@scope/name@version` 一经入库不可重传;只能发新版本或 **yank**
  (阻断新装、保留已锁归档、安装时安全告警)。指针变更不改变已归档内容。
- **完整性**:`tam.lock` 同时 pin **源 commit sha** 与 **归档 digest**;digest + registry 记录由发布者签名(sigstore)。
- **PR = 提交 + 审计**:CI 跑静态扫描 + `tam validate` + 归一化校验,合并即上架(**仅在开放上传解锁后**,见 §9)。
- 多 registry:CLI 可配置官方 + 私有(企业内网);**scope↔registry 绑定**确定解析顺序,防依赖混淆。

> v1 仅承载只读授权索引;开放第三方提交在安全门禁就绪后开启。

### 4.4 CLI(`tam`)

```
tam init / validate                  # 脚手架 + manifest 校验 + 目标平台 dry-run 报告(v1:Claude+Cursor)
tam search "<q>" --type --target     # 搜索(类型/目标平台过滤)
tam info <pkg>                       # 详情 + 兼容性矩阵
tam install <pkg> [--target --scope] # 自动探测已装工具,编译落盘 + 写 lock
tam list / outdated / update [pkg]
tam uninstall <pkg>                  # 凭 lock 精确清理生成文件
tam sync                             # 按 tam.lock 重建(CI / 新人入职)
tam publish [--also-native]          # 打包 + 扫描 + 上传/发 PR;可选发布直通
tam registry add/list/remove
```

要点:**target 自动探测**;`project`/`user` 双 scope;安装前展示**适配报告 + 权限声明 + 文件 diff**;
`--yes` 供 CI;生成文件带托管标记注释,sync 幂等、绝不动手写文件。

### 4.5 Web 市场

- **元索引(冷启动核心,合规优先)**:**不裸抓取**。仅从 opt-in 索引、官方 API/feed、源仓库指针、
  宽松许可(permissive license)GitHub 内容起步;逐源法务审查通过前不镜像他人 README/资产/包/安装元数据
  (Cursor ToS 禁抓取、Anthropic AUP 约束)。在授权范围内 `tam build` 并展示兼容性。
- **Day-1 主打工作流(而非通用搜索)**:**"导入我的 Claude/Cursor 配置 → 编译到另一个工具 → 提交 `tam.lock`"**;
  迁移与团队复现为先,通用搜索次要(对个人开发者比"搜索一切"更有拉力)。
- 列表/搜索:按类型、目标平台、标签过滤;目标平台 × 三态兼容性徽章(v1:Claude+Cursor 两列)。
- 详情页:README、资产清单、**权限声明高亮**、版本历史、一行安装。(下载量/评分为 v2,依赖 hosted stats)
- 发布者主页 + 认证标识(组织域名验证)。(v2,随开放上传)

### 4.6 发布直通(publish-through)

> **v2 功能(v1 不做)**,且受 §5.8 信任约束:TAMart 徽章不得带入原生市场。

`tam publish --also-native`:在登记到 TAMart 的同时,额外 emit Claude-plugin + Cursor-plugin,
并(可选)发起原生市场提交。TAMart 成为**上游**,向各原生市场 fan-out,而非与之竞争。

---

## 5. 安全与信任模型

> hooks / skill 脚本是**在开发者机器上执行的任意代码**;开放上传意味着恶意投放是常态,
> 风险高于 npm(后者不会在每个工具事件上自动运行)。安全是基建,不是后期功能。
>
> **Day-1 vs `G_OPEN` 的界定(解 Day-1/M4 矛盾)**:**红线与原则从 M1 即生效**——
> 第 1(权限声明)、3(provenance)、4(安装预览)、5(凭据红线)、11(敌意归档)、13(scope fail-closed)项,
> 因为只读授权索引阶段也要安全落盘与可复现。**开放第三方上传专属的控制**——
> 第 2、6、7、9、10、12、14、15 项(扫描队列/吊销/信任分级自动化/native 直执处置/门禁验证/密钥失陷/滥用治理)——
> 构成 **M4 `G_OPEN`** 门禁,开闸前必须全部就绪。详见 [specs/06](./specs/06-security-pipeline.md)。

> **核心认知(评审修正)**:静态扫描**可被轻易绕过**(fetch-then-exec、混淆、时间/条件炸弹),
> 是风险分级的减速带,**不是准入闸**。信任必须建立在**运行时边界**与**provenance**上,且"已扫描 ≠ 安全"必须对用户明示。
> 同时诚实区分两类脚本的可控性:**tam 托管 hook(经 shim 包装,可加权限边界)** vs **原生落盘脚本(宿主工具直接执行,只能扫描+签名+告警,无法运行时沙箱)**。

1. **权限声明 + 运行时强制**:未声明 `exec`/`network` 却含脚本的包发布即拒;对 tam 托管脚本,声明由
   **权限 broker/沙箱 shim 强制**(沙箱内只放行声明过的能力),无法强制处一律标注"未验证声明"并降信任级——
   声明本身不得撑起 `verified` 语义。
2. **自动静态扫描(PR CI)**:命中凭据路径读取、网络外联、混淆 → 隔离队列,等人工复核(仅作分级触发,非门)。
3. **Provenance**:scope 命名空间防 typosquatting + 域名验证发布者 + sigstore 签名 + 内容寻址 pin。
4. **安装预览**:落盘前展示待写文件 + 权限 + diff;条件允许时沙箱化 hook 脚本。
5. **凭据红线**:manifest / 资产 / 生成配置一律禁止明文 secret,MCP env 仅允许 `${ENV_VAR}`。
6. **撤回**:yank/takedown + 对已安装 yanked 包的 CLI 安全告警。
7. **信任分级**:official / verified(认证组织)/ community;CLI 可配置策略(如企业内只允许 official + 私有 registry)。
   **可执行资产(hook/带脚本 skill)永不自动合并**——无论信任级,均需人工复核 + 信誉延迟;
   仅**非可执行**资产允许 verified 发布者在扫描通过后自动上架(与 §10 一致)。
8. **publish-through 不洗信任**:向 Claude/Cursor 的转提交不得隐含原生市场背书,TAMart 徽章按 **registry/审核者分别标注**,
   原生提交中剥离/重标 TAMart 徽章,安装时展示 **chain-of-custody**(谁签名、谁审核、来自哪个 registry)。

**以下为安全审查重跑(对抗视角)补充的硬性要求,均为开放上传(`G_OPEN`)前必须满足:**

9. **原生直执资产的运行时边界或硬禁止**:Claude/Cursor 的 hook/skill 由宿主工具直接执行,broker 管不到。
   开放上传下,**可执行 native-direct 资产要么经 TAMart wrapper 落盘(真正中介 file/env/network/exec),要么禁止**;
   未中介者标 `unsafe`、需显式 opt-in、不得获 `verified`/CI 批准徽章。`declared` 与 `enforced` 权限在 manifest 分离表达。
10. **`G_OPEN` 必须可独立验证**:每项门禁配硬性 pass/fail 证据——绕过语料测试、沙箱逃逸测试、签名吊销演练、
    takedown 演练、默认拒绝(default-deny)安装策略;全部通过方可开闸(见 [specs/06](./specs/06-security-pipeline.md))。
11. **敌意归档防御**:canonical 归一化必须防 zip-slip、symlink/hardlink 逃逸、Unicode/大小写碰撞、文件模式诡计、
    manifest/README/native-manifest 元数据注入;CLI 落盘前**再归一化校验**(详见 [specs/02](./specs/02-registry.md) 强化项)。
12. **密钥/账号失陷处理**:仅发布者签名不够——需 registry **门限共签**、official/verified 用 HSM/KMS、
    客户端可吊销签名者、维护者账号管控、失陷 playbook;否则被接管账号可发出"合法签名"的恶意不可变版本。
13. **scope 绑定 fail-closed**:`tam.lock` pin 精确 registry URL + 命名空间 owner + digest + signer;
    **未绑定 scope 一律 fail-closed**,保留 vendor/official scope,禁止隐式跨 registry fallback(见 [specs/02](./specs/02-registry.md) §4)。
14. **分钟级紧急吊销**:仅 <24h takedown 不够(恶意 hook 首次执行即窃据)——需**签名 denylist/吊销表**,
    在 install/sync 与 wrapper 处校验,事件级目标为分钟级,并在 yank 时直接通知已安装用户/组织。
15. **归档存储滥用治理**:不可变 + 保留已锁内容会带来滥用面——需大小/文件数配额、入库前滥用扫描、隔离、限流、
    **带密码学墓碑(tombstone)的合法删除路径**与保留例外。

---

## 6. 系统架构(摘要)

```
┌────────────── Web Marketplace ──────────────┐  浏览/搜索/徽章/元索引/一行安装
└───────────────────┬──────────────────────────┘
                    │ 读 registry.json(+ 可选 hosted index/stats)
┌───────────────────┴──────────────────────────┐
│  Registry = git 索引 + 不可变归档存储          │  registry.json + marketplace.json(claude/cursor)
│  + GitHub Actions(scan + validate + 索引)    │  入库即物化归档(digest 寻址);repo+sha 仅作 provenance
└───────────────────┬──────────────────────────┘
                    │ 归档(digest 寻址)+ manifest + 签名 + integrity
┌───────────────────┴──────────────────────────┐
│  tam CLI  ── Adapter 编译层(双 profile emitter)│
│  claude-code │ cursor │〔codex │ opencode 后置〕│
└───────────────────┴──────────────────────────┘
                    │ 写原生文件 + tam.lock
        .claude/  .cursor/  AGENTS.md/.codex/  .opencode/
```

详见 `docs/DESIGN.md` §3/§5/§6。adapter 用 **capability profile**(`profiles/<tool>@<ver>.yaml`)
描述各平台能力,平台变更 = 改 profile 而非改代码;配 **golden-file 快照测试**(同一包 → 各目标产物,v1 两平台)
+ **对真实工具版本的金丝雀 CI**(golden 只证明产出,金丝雀证明在目标工具上能装能跑),平台漂移在 CI 显式失败。

---

## 7. 关键指标(成功度量)

**北极星(North-Star)= 周留存可移植安装(Weekly Retained Portable Installs)**:
将某包安装进**非原生 target**(靠 TAMart 编译才能用)且 **7/30 日后仍在**的安装数,按个人/仓库/组织分层。
它直接度量"跨工具保证"这一独有价值,且无法靠索引量/编译率虚增。

| 维度 | 指标 | 公式 / 口径 | v1 目标 |
|---|---|---|---|
| **北极星** | 周留存可移植安装 | distinct(pkg×非原生target×环境)且 T+7 仍在 lock | 建基线后定增长目标 |
| 编译质量 | 编译成功率 | (语料中 native+translated 资产数) / (总资产数);degraded 不计入分子;语料=v1 索引快照;周报 | ≥ 90% |
| 转化 | 搜索→安装转化率 | 安装事件 / 详情页访问;预览后安装成功率 | 建基线 |
| 团队 | 采用 `tam sync` 的仓库数、≥3 独立组织安装的包数 | 去重计数 | 建基线 |
| 留存 | 安装后 7/30 日留存、卸载率、卸载原因 | lock 存活率 | 建基线 |
| 健康度 | 作者复更率 = 90 日内发新版的活跃包 / 活跃包总数;安装集中度 = top-10 包安装数 / 总安装数(HHI);兼容性失效上报 = 用户标记"装了不工作"事件计数 / 周 | 见左 | 建基线 |
| 安全 | 平均 takedown 时延、漂移后修复时延 | 事件时间戳 | takedown < 24h |

> 内容密度(索引组件数)降级为**输入型**指标,不作为成功标准,避免 vanity。

---

## 8. 用户体验原则

- **零误导降级**:宁可 `skip + warn`,不输出看似可用实则错误的降级产物。
- **幂等可逆**:托管标记 + lock hash,`uninstall`/`sync` 绝不触碰手写文件。
- **一处发布,处处可装**:同一 git repo 既是 TAMart 包,又是 Claude/Cursor 原生 marketplace。
- **安装即透明**:落盘前永远先展示文件 diff + 权限。

---

## 9. 里程碑路线图(已按风险重排)

> 关键调整:**元索引 + 编译器先于开放上传** —— 它既是冷启动解药与护城河,
> 又能让安全管线先在已知种子集上验证,再开放第三方上传。

> **发布门禁(Release Gate)**:`G_OPEN` = 开放第三方上传**当且仅当**以下全部就绪 ——
> 静态扫描+隔离队列、不可变归档+digest 签名、权限 broker(tam 托管脚本)、yank/takedown(<24h)、信任分级。
> 在 `G_OPEN` 之前,registry 只承载**只读授权索引**。

| 阶段 | 范围 | 进出标准 / 验证目标 |
|---|---|---|
| **M1 编译核心** | 包格式 + `tam`(init/validate/install/sync)+ Claude & Cursor adapter + 不可变归档 registry(只读授权)| 出:同一包→两平台 golden 产物通过;`install`/`sync` 幂等+原子;每命令有验收标准 |
| **M2 迁移 + 冷启动(合规)** | "导入并编译我的配置"工作流 + 团队 `tam.lock` 复现 + 合规元索引 + Web 只读浏览/徽章 + 邀请制作者 beta(自有策展供给)| 出:20–30 混合工具团队用 sync;北极星建基线 |
| **M3 补齐平台 + 降级** | Codex & OpenCode adapter + hook 能力格/shim + capability profile + 金丝雀 CI + lockfile 冲突/三方合并 + uninstall/update | 出:四平台金丝雀 CI 绿;降级"零误导"QA 协议通过 |
| **M4 安全管线 + 开放发布** | PR CI 扫描/隔离 + sigstore 签名 + 权限 broker + 信任分级 + yank → **达成 `G_OPEN`,开放上传** + publish-through | 出:`G_OPEN` 全部就绪;takedown<24h 演练通过 |
| **M5 规模化与运营** | hosted index/search/stats + 评分 + 组织认证 + 私有 registry 商业化(付费团队/策略强制/审计日志)| 生态运营与企业变现 |

> **最小可行收入前置**:M2/M3 即可引入付费私有 registry / 策略强制 / 企业审计日志,
> 因为安全是 Day-1 常设成本,不应等到 M5 才有收入支撑。

---

## 10. 演进触发条件(何时从 git-repo 毕业到 hosted)

| 痛点 | 触发 | 演进到 |
|---|---|---|
| 搜索慢/弱 | index 超数千包 | Meilisearch/pg_trgm 前置(repo 仍为 source of truth) |
| 需下载量/评分 | 需排序 | 小型 API + Postgres,read-through 到 repo |
| PR 审核跟不上 | 提交量上升 | 分级信任:**仅非可执行资产**的已扫描 PR 可自动上架;**可执行资产恒人工 + 信誉延迟**(见 §5.7/§5.9) |

repo 永不丢弃,hosted 服务作为前置 cache/index 叠加。

---

## 11. 风险与开放问题

- **平台格式漂移**:hooks/subagent frontmatter 会持续变化 → capability profile + golden 快照 + adapter 版本绑定。
- **安全是持续成本**:扫描队列 + 审核人力 + 工具链是常设职能,非一次性投入。
- **冷启动竞争**:面对 Smithery/LobeHub/原生市场,必须靠元索引 Day-1 提供独有价值。
- **元索引的合规/署名**:抓取并展示他人组件需保留来源署名与许可证,尊重 robots/ToS。
- **与原生市场关系**:保持可互转 + 发布直通,把原生生态当入口而非竞品。
- **AGENTS.md 托管区块写入冲突**:多工具同时编辑,需稳健的区块标记解析与幂等写入。
- **已决(v2)**:版本不可变 + 上游删除兜底 → **接收即物化不可变归档**(§4.3),指针仅作 provenance,撤销"不自建存储"非目标。
- **已决(v2)**:安全 Day-1 与里程碑冲突 → 引入 `G_OPEN` **发布门禁**(§9),开放上传前必须就绪。
- **已决(v2)**:护城河 → 遥测 + 信任数据 + 企业采用 + 作者关系(§2.1),格式编译为 wedge。
- **已补(M1 specs,见 [`specs/`](./specs/))**:
  - `tam.yaml` schema + `tam validate` 验收 → [specs/01](./specs/01-tam-manifest.md)。
  - `registry.json` schema + 不可变归档 + digest + 解析链 → [specs/02](./specs/02-registry.md)。
  - `install`/`sync` 执行契约 + 事务/幂等/三方合并 + 验收 → [specs/03](./specs/03-cli-install-sync.md)。
- **仍待办(交工程前必须补)**:
  - `publish` 命令契约;hook 能力格(specs/04)、adapter profile + 金丝雀 CI(specs/05)、安全管线(specs/06)。
  - 元索引的**逐源合规清单**与移除流程;"零误导降级"的 QA 测试语料与协议。
  - 团队/企业**强制功能**的具体形态(策略文件、CI 强制模式、审计输出、v1 私有 registry 范围)。
  - 调和 §7 内容量与 §10 hosted 搜索触发(git-backed 搜索在 v1 的性能目标)。
- **安全审查重跑(对抗)新增、待 specs/06 固化的硬性问题**(详见 [`REVIEW.md`](./REVIEW.md) 更新版与 §5.9–§5.15):
  原生直执资产的运行时边界/硬禁止、`G_OPEN` 可验证证据集、敌意归档防御、密钥失陷与门限共签、scope fail-closed、分钟级吊销、归档滥用治理(含合法删除)。**结论:当前安全模型不足以解除 `G_OPEN`,上述项为开闸前提。**
- **DESIGN.md 同步(待办)**:DESIGN §2/§4.3/§5.2/§6.1 仍为 v1 旧模型(中立 hook 事件、源目录 git registry、Codex 无 hook/skill),
  与本 PRD v2 的能力格 / 不可变归档 / 平台收敛**已分叉**;需将 PRD v2 决策回写为 DESIGN 的规范,旧路径标弃用(已在 DESIGN 头部加 supersession 提示)。

---

## 12. 附:与 DESIGN.md 的差异说明

本 PRD 在原设计基础上的主要更新:

1. 平台矩阵更新为 2026 年中的收敛现状(SKILL.md/AGENTS.md 近通用;Cursor/Codex 不再是弱平台;hooks 是唯一真分裂)。
2. 明确定位为**公开开放市场**,并采用 **git-repo-as-registry** 作为起步形态(同孪生于 Claude/Cursor 原生 marketplace)。
3. 新增**合规优先的元索引冷启动策略**(不裸抓取),并在路线图中**前置**于开放上传。
4. 新增**发布直通(publish-through)**(v2 功能,且不洗信任,见 §5.8)。
5. 将**安全红线 Day-1 生效、开放上传管线由 `G_OPEN` 门禁解锁**(解 Day-1/M4 矛盾)。
6. adapter 引入 **capability profile + golden 快照 + 金丝雀 CI**作为低维护核心机制。
7. (v2.1)按两轮 Codex 评审收窄 v1 范围、传播 §2.3 限定、并吸收安全重跑的 7 项 blocker。
