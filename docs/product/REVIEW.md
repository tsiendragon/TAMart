# TAMart PRD 评审汇总(Review Round 1)

> 对 [`docs/product/PRD.md`](./PRD.md) v1 的多维度评审。
> 来源:Codex 子代理(架构 / 产品·GTM / PRD 质量)+ 直接补写(安全,因 Codex 安全子代理执行中途停滞)。
> 日期:2026-06-13。结论:**PRD v1 为合格的"评审用草稿",但非"可开工"状态**。

## 0. 结论速览

| 维度 | Blocker | Major | 总体判断 |
|---|---|---|---|
| 架构与可行性 | 2 | 8 | 模型方向成立,但 hook 抽象与 registry 指针模型有根本性缺陷 |
| 安全与信任 | 2 | 4 | 开放上传 + 任意代码执行,静态扫描远不够;需运行时边界 |
| 产品与 GTM | 2 | 7 | 定位有价值但护城河可被吸收;冷启动有合规风险;v1 过宽 |
| PRD 质量 | 4 | 14 | 缺验收标准/契约/可测指标,里程碑无法交付工程 |

**跨维度共识 blocker(必须先决策,不只是补写)**:

1. **指针模式破坏可复现性与持久性** —— 上游删除/转私有/force-push/LFS 丢失都会让 `tam.lock`/`tam sync` 失效。
2. **安全在 §5 是 Day-1、在 §9 落到 M4** —— 自相矛盾;开放发布不能早于扫描/隔离/签名/yank 管线。
3. **护城河可被平台吸收** —— skills/rules/commands 已收敛为 pass-through,差异化只剩最脆弱的 hooks/subagent/MCP 翻译。
4. **冷启动镜像涉嫌违反 ToS/AUP** —— Cursor 禁止抓取、Anthropic AUP;不能作为 Day-1 内容引擎裸用。

---

## 1. 架构与可行性(Codex)

- **[BLOCKER] hook 模型抹平了不同语义**:四家在 cadence(pre/post)、阻断 vs 非阻断、payload schema、输入可变性、权限覆盖模型上都不同。统一为"中立事件 + stdin JSON + exit 2"会丢语义。
  **修复**:用**能力格(capability lattice)**描述各维度,定义一个**无损可移植子集**,子集外**fail closed**,并要求平台特定的 hook 覆盖声明。
- **[BLOCKER] 指针式 registry 破坏可复现**:pinned sha 防替换,但挡不住上游删除/转私有/转移/force-push+GC/LFS·submodule 缺失。
  **修复**:接收入库时**物化为 TAMart 控制的不可变归档**(canonical package digest 寻址),repo+sha 仅作 provenance;yank 阻断新装但保留已锁归档(带安全告警)。
- **[MAJOR] 支持级别缺单一事实源**:PRD 与 DESIGN 已自相矛盾(Codex skills/hooks 状态)。→ `profiles/<tool>@<ver>.yaml` 作为矩阵/徽章/CLI/测试的生成源。
- **[MAJOR] pass-through 只对正文成立,不含安装语义**:rule 的 `.mdc`/`globs`/`alwaysApply`、脚本路径、frontmatter、合并行为都需翻译。→ 区分"正文 pass-through"与"安装语义编译",显式上报被丢弃字段。
- **[MAJOR] golden file 测不到运行时漂移**:只证明 TAMart 产出符合预期,测不到目标工具改 schema/改 hook 执行语义。→ 增加**对真实工具版本的定时金丝雀 CI**(安装、跑目标校验器、冒烟 hook 触发/阻断)。
- **[MAJOR] 漂移检测流程未定义**:无负责人/排程/上游监听。→ profile 责任人 + 定时金丝雀 + 上游 release 跟踪 + profile 过期时阻断 publish/install。
- **[MAJOR] `tam.lock` 写入非事务性**:并发或崩溃会导致生成文件与 lock 不一致。→ 按 scope 文件锁 + 临时文件原子 rename + journal,全部写成功后才更新 lock;sync 先修复未完成事务。
- **[MAJOR] 托管区块归属太弱**:`AGENTS.md` 通用标记会让两个包互相覆盖/误卸载。→ 标记含 package/asset/target/digest + lock 内归属索引;重复声明同区块需显式替换关系。
- **[MAJOR] 三方合并只命名未实现**:未存 base/current/desired 就无法判定状态。→ lock 内存 base digest + 归一化生成内容;用户改动管理区块时转移归属。
- **[MAJOR] 指针完整性 digest 欠定义**:commit SHA/tree SHA/归档字节/submodule/LFS 可能各端不一致。→ 定义唯一归档格式与 digest 算法,签名 digest+记录,lock 同时 pin 源 sha 与归档 digest。
- **[MINOR] 支持级别粒度太粗**:失败是按 feature 的(rule 正文 native 但 globs 不支持)。→ 按 required feature 报告,再以"最弱未支持项"汇总为包级徽章。

## 2. 安全与信任(直接补写,对抗视角)

> 前提:**公开开放上传 + hooks/skill 脚本在开发者机器上以工具事件触发执行任意代码**,风险高于 npm。

- **[BLOCKER] 静态扫描可被轻易绕过,不能作为准入闸**:fetch-then-exec、混淆、时间/逻辑炸弹、env/CI 条件触发的 payload 都能过扫描。静态扫描是减速带,不是门。
  **修复**:把信任建立在**运行时边界**上 —— 对 tam 托管的 hook/skill 脚本套**权限 broker/沙箱 shim**(限制网络与文件域,按声明放行);静态扫描结果仅作风险分级与人工队列触发。明确告知用户"已扫描 ≠ 安全"。
- **[BLOCKER] 权限声明是自证、不可验证**:声明 `exec: bash` 的脚本照样能开网络外联,没有任何机制强制。
  **修复**:声明必须可被运行时 broker **强制**(沙箱内只放行声明过的能力),否则只能标注为"未验证声明"并降低信任级;不可让其撑起"verified"语义。
- **[MAJOR] 指针模式的供应链面**:即便 pin sha —— 上游账号被接管后发新版、tag 漂移(若只 pin tag)、依赖混淆(包依赖 `@okg/*` 被解析到错误 registry)。
  **修复**:不可变归档 + 对 digest 的发布者签名 + **scope↔registry 绑定**的确定性解析顺序。
- **[MAJOR] publish-through 会"洗"信任**:经 TAMart 弱标准扫描的包自动提交到 Claude/Cursor,或把 TAMart 徽章带入原生生态,造成背书误导与声誉风险。
  **修复**:publish-through 产物不得隐含原生市场背书;徽章语义限定在 TAMart 自身,跨市场提交走各自审核。
- **[MAJOR] "沙箱化 hook 脚本"在多数情况下不现实**:Claude/Cursor/Codex 的 hook 由宿主工具直接以 shell 执行,TAMart 无法沙箱宿主已落盘脚本;唯一可控点是 tam 注入的 shim 包装器。
  **修复**:诚实区分 ——「tam 托管 hook(经 shim,可加边界)」vs「原生落盘脚本(只能扫描+签名+告警,无法运行时沙箱)」;文档明确两者信任差异。
- **[MINOR] secret 与 CLI/adapter 自身供应链**:`${ENV_VAR}` 好,但 skill 仍可读环境变量外泄;CLI 及其 npm 依赖本身是攻击面。→ 安装预览强制展示网络/文件访问声明;CLI 依赖锁定 + 自身签名发布。

## 3. 产品与 GTM(Codex)

- **[BLOCKER] 护城河可被吸收**:差异化只剩 hooks/subagent/MCP 翻译,且最脆弱。→ 把**可持续护城河**重定位为:兼容性遥测 + 信任/声誉数据 + 企业 lockfile 采用 + 作者 fan-out 关系;格式编译是 wedge 不是 moat。
- **[BLOCKER] 冷启动镜像的合法性**:Cursor ToS 禁止抓取、Anthropic AUP 约束。→ 仅从 opt-in 索引、官方 API/feed、源仓库指针、宽松许可 GitHub 内容起步;逐源法务审查前不镜像他人 README/资产/包/安装元数据。
- **[MAJOR] 差异化翻译区即最脆弱区**:→ 把"certified portable"兼容性、golden 测试、快速漂移响应做成产品承诺,公开兼容性测试语料与历史 break/fix 时延作为信任证据。
- **[MAJOR] "搜索一切+编译到我的工具"对个人开发者不够强**:Claude 一键插件+认证徽章、Cursor 活跃市场、LobeHub 体量远超 5000。→ Day-1 主打更锐利的工作流:**"导入我的 Claude/Cursor 配置 → 编译到另一个工具 → 提交 tam.lock"**;通用搜索次要,迁移与团队复现为主。
- **[MAJOR] 双边排序**:镜像供给(无主 listing)只造成浏览,不带来作者承诺/更新/支持。→ **先种子消费侧**:20–30 个混合工具的工程团队用 `tam sync`/`tam.lock`,配一份策展授权供给。
- **[MAJOR] 作者侧不应拖到 M4**:否则无自有供给与作者学习,原生平台保留分发关系。→ M2 起做**邀请制作者 beta**(30–50 个高意图包:code review/测试生成/安全/云文档/design-to-code),给作者跨工具安装遥测+兼容报告+发布直通。
- **[MAJOR] 缺北极星指标**:§7 偏重索引量/编译率/基线活动,均可虚增。→ 北极星 = **周留存可移植安装**(装入非原生 target 且 7/30 日后仍在,按个人/仓库/组织分层)。
- **[MAJOR] 市场健康度指标缺失**:→ 增加 搜索→安装转化、预览后安装成功率、卸载原因、兼容性失效上报、≥3 个独立组织安装的包数、作者复更率、安装集中度、漂移后修复时延。
- **[MAJOR] 变现拖到 M5,而安全是 Day-1 成本**:→ M2/M3 引入最小可行收入:付费团队/私有 registry、策略强制、认证发布者费、安全审查费、企业审计日志;公开搜索与 CLI 免费保增长。
- **[MAJOR] v1 范围过宽**:→ 砍到 Claude+Cursor、CLI 优先 install/sync/lock、只读授权索引、pass-through skills/rules/commands/MCP + 明确 unsupported;Codex/OpenCode、评分、开放上传、publish-through、hook 翻译后置。

## 4. PRD 质量与可执行性(Codex)

- **[BLOCKER] 安全 Day-1 与路线图冲突**:§2.1 G5/§5 称 Day-1,§9 落到 M4。→ 定义各控制项落在哪个里程碑 + 阻断公开发布的发布门禁。
- **[BLOCKER] 开放发布的版本不可变未解**:§4.3 指针+sha 与 §11 公开问题冲突。→ 明确不可变版本策略、tag/sha 形态、再发布规则、provenance 校验、指针变更时 install/update 行为。
- **[BLOCKER] 上游删除/yank 持久性未解**:§5.6 与 §2.2"v1 不自建 blob 存储"冲突。→ 决定是否缓存源工件、保留策略、删除/yanked 包的安装行为与审计。
- **[BLOCKER] 核心路径无验收标准**:`validate/install/sync`/adapter 产物/registry 提交/web listing/publish-through/安全审查均无"done"定义。→ 每功能每里程碑补可测验收(输入/期望产出/失败态/发布证据)。
- **[MAJOR](多项)规格欠定义**:canonical `tam.yaml` schema、`registry.json` 契约、CLI 执行契约(flags/exit code/幂等/dry-run/CI/auth)、install/sync 边界态(冲突/回滚/部分失败/并发)、web 市场流程(排序/空错态/审核态/分页/a11y/i18n)、元索引合规闸、publish-through 生命周期、安全扫描策略与审核工作流、指标公式与样本量、"零误导降级"的 QA 协议、里程碑进出标准。
- **[MAJOR] 指标不可测**:"示意/建立基线"、"≥90% 资产非 unsupported"缺分母/语料/时间窗/是否计入 degraded。
- **[MAJOR] §7"≥5000 索引"与 §10"数千包后才上 hosted 搜索"矛盾**:v1 需要被 §9 推到 M5 的 hosted 搜索。
- **[MAJOR] 团队/企业强制是孤儿需求**:G4/§3.1/§4.3/§5.7 提到但 §4/§9 无具体功能。→ 定义策略文件、允许的 registry/信任级、CI 强制模式、失败行为、审计输出、v1 私有 registry 范围。
- **[MINOR] 缺文档/支持计划、a11y/i18n 要求**。

---

## 5. 建议的 PRD v2 修订项(按优先级)

1. **registry 改为"接收即物化不可变归档"**,指针仅作 provenance(解 blocker 1/架构 2/PRD 2·3)。
2. **里程碑安全门禁**:开放上传前必须先有扫描+签名+yank+权限 broker;重排 §9(解 blocker 安全/PRD 1)。
3. **hook 能力格 + 无损可移植子集 + fail closed**(解架构 1)。
4. **收窄 v1**:Claude+Cursor、CLI 优先、只读授权索引;后置 Codex/OpenCode/开放上传/publish-through/hook 翻译(解 GTM v1)。
5. **冷启动改为合规优先**:opt-in/官方 feed/宽松许可;主打"导入并编译我的配置 + 团队复现"工作流(解 GTM 冷启动)。
6. **北极星 = 周留存可移植安装** + 一组市场健康度指标,全部给出公式(解 GTM 指标/PRD 指标)。
7. **每功能补验收标准 + schema/契约**(`tam.yaml`、`registry.json`、CLI 契约、安装/同步边界态)(解 PRD blocker 4 及多 major)。
8. **护城河重定位**为遥测+信任数据+企业采用+作者关系,文档化(解 GTM moat)。

---

# Review Round 2(对 PRD v2 的复评 + 安全审查重跑)

> 两个 Codex 子代理:v2 复评(核验 blocker 闭合)+ 安全审查重跑(上一轮停滞,本轮完成)。
> 产出 → 已落为 **PRD v2.1** + 新增 [specs/06](./specs/06-security-pipeline.md)。

## R2.1 v2 复评结论(blocker 闭合核验)

- **4 个跨维度 blocker**:#1 指针/可复现 **CLOSED**;#3 护城河 **CLOSED**;#4 冷启动合规 **CLOSED**;
  #2 安全 Day-1/M4 **PARTIAL** → v2.1 §5 增加 Day-1 vs `G_OPEN` 明确界定,**已闭合**。
- **8 项修复**:5 项 CLOSED;v1 范围未传播 / 冷启动 §2.1 矛盾 / 北极星健康度公式缺 / schema 待补 → **v2.1 已逐条修复**
  (§2.1 正名为"完整愿景"+ 全文加 v1 限定、§2.1 G3 改合规、§7 健康度补公式、specs/01–03 补 schema 与验收)。
- **v2 新引入的不一致(复评 PART 3)**:§2.3 收窄未传播、§6 图仍画指针、§12 仍称 mirroring、§5↔§10 自动合并冲突、
  PRD↔DESIGN 三处分叉 → **v2.1 全部修复**(范围传播、§6 图改归档、§12 措辞、§5.7/§10 统一"可执行资产恒人工"、DESIGN 头部加 supersession)。

## R2.2 安全审查重跑结论(对抗视角)

**判定:当前安全模型不足以解除 `G_OPEN`。** 7 个 blocker + 4 个 major,已固化进 PRD §5.9–§5.15 与 specs/06:

1. **原生直执脚本绕过 broker** → 开放上传下,可执行 native-direct 资产须经 wrapper 中介,否则禁止/标 unsafe 无徽章。
2. **`G_OPEN` 不可独立验证** → 定义 pass/fail 证据集(绕过语料/沙箱逃逸/吊销演练/takedown 演练/default-deny)。
3. **敌意归档防御欠缺** → zip-slip/symlink/碰撞/模式/元数据注入防御 + 落盘前再校验。
4. **签名未覆盖账号/密钥失陷** → HSM/KMS + registry 门限共签 + signer 吊销 + playbook。
5. **scope 绑定太松** → `tam.lock` pin URL+owner+digest+signer,未绑定 fail-closed,禁隐式 fallback。
6. **非门扫描 + 自动合并放行规避代码** → 可执行包恒人工 + 信誉延迟,企业 default-deny。
7. **不可变归档滥用面** → 配额/滥用扫描/限流 + 带密码学墓碑的合法删除路径。
8–11(major):publish-through 展示性洗信任、自证权限、takedown SLA 太慢(需分钟级吊销)、DESIGN 残留 v1 弱模型。

## R2.3 当前状态

- **已闭合**:第一轮全部 blocker + v2 复评新发现的一致性问题。
- **新增前置(specs/06,开放上传前必须实现)**:安全重跑 7 项 blocker —— 这是**实现层**门禁,非文档矛盾。
- **PRD 状态**:从"评审用草稿"推进到 **v2.1 = 可决策 / 可 spec-out**(M1 已具 specs/01–03);
  开放上传相关(M4 `G_OPEN`)在 specs/06 落地并通过证据集前不可开闸。
