# TAMart 设计评审 Round 2

> 评审范围：PRD v2.1 + specs 01–06（包含新增 spec 04 hook 能力格、spec 05 adapter profile）
> 日期：2026-06-13

---

## 0. 结论速览

| 维度 | BLOCKER 数 | MAJOR 数 | MINOR 数 | 总体判断 |
|------|-----------|---------|---------|---------|
| 架构与可行性 | 3 | 6 | 5 | 设计方向成立，但退出码命名空间混乱、pre:file-edit 三角矛盾、M1 校验标准互斥三项 BLOCKER 不解决将导致运行时静默失效，M1 不可直接开工 |
| 安全与信任 | 3 | 6 | 3 | shim 完整性无持续校验、profile 单点事实源缺完整性保护、ReDoS 可绕过安全 hook，三项均在 M1 阶段即可被利用，构成真实攻击面 |
| 产品与 GTM | 2 | 4 | 2 | 北极星指标在 M1/M2 不可测、tam-shim 工作量严重低估，两项 BLOCKER 合并将导致交付后无法度量价值且极大概率工程超支 |
| 规范质量与可实现性 | 3 | 8 | 5 | specs 01-03 整体可开工，specs 04-05 三项 BLOCKER（pre:file-edit 三角矛盾、_schema.yaml 缺失、shim 关键实现细节未定义）阻断工程实现 |

**综合结论：M1 当前不可开工。** 跨维度出现的 pre:file-edit 矛盾、shim 完整性与工作量边界、M1 校验标准冲突这三组问题必须在 kickoff 前解决，否则不同工程师将基于相互矛盾的 spec 写出行为不一致的代码。

---

## 1. 架构与可行性

### BLOCKER

**[BLOCKER-A1] tam-shim 在 blocking hook 中的退出码透传无法区分 shim 自身错误与脚本拒绝意图**

Spec 04 §6.3 规定 tam-shim 透传脚本的退出码给调用方，而 Claude Code 的 blocking 语义是 exit != 0 即取消工具调用。但 shim 自身在 payload 校验失败时也以 exit 1 退出（E_SHIM_PAYLOAD_INVALID）。当平台向 shim 发送格式不符预期的 payload（如 Claude Code 版本升级后字段名变化），shim 以 exit 1 退出，Claude Code 将其解释为"脚本拒绝执行"，造成安全假阳性、阻断用户操作。反向风险同样存在：若实现者将透传逻辑写错（固定返回 0），blocking hook 全面静默失效。Spec 04 既未区分 shim 内部错误码与脚本业务退出码的命名空间，也未规定 shim 自身故障时的 fail-open/fail-closed 策略。

> Fix：为 shim 定义独立内部错误退出码命名空间（如 64-78，参考 BSD sysexits），与脚本业务退出码（0/1/2）隔离。在 Spec 04 §6.3 明确：shim 自身故障时默认 fail-closed，stderr 打印 SHIM_INTERNAL_ERROR 标记。在 Spec 04 §8 增加金丝雀场景：shim 收到格式错误 payload 时的退出码与标记输出。

---

**[BLOCKER-A2] Spec 04 §3.2 将 pre:file-edit 映射到 afterFileEdit（post 语义），与 §4 可移植子集、Spec 05 cursor profile 形成三角矛盾**

Spec 04 §3.2 映射表：pre:file-edit → afterFileEdit（注"pre 语义仅部分匹配"）。afterFileEdit 是编辑完成后触发，不能阻断操作，而 pre:file-edit 的语义是编辑前触发并可选阻断。Spec 04 §4 可移植子集将 domain: file-edit 列为双平台完整支持。Spec 05 cursor@0.yaml 则标注 pre:file-edit 的 nativeName: null、blocking: unsupported。三处描述形成闭环矛盾：可移植（§4）vs unsupported（Spec 05）vs partial-match（§3.2）。工程师按任一 spec 实现都有 spec 依据，但行为相反。

> Fix：三处必须统一。架构决策：若 afterFileEdit 确为 post 语义，则 pre:file-edit 在 Cursor 上 unsupported——从 Spec 04 §4 可移植子集中删除 file-edit，从 §3.2 删除 afterFileEdit 映射行，保持与 Spec 05 cursor profile 一致。若决定接受 partial-match，则三处均需同步标注"Cursor 侧为 partial/post"，并在 Spec 05 profile 中补充 nativeName: afterFileEdit。必须先做架构决策再同步文档。

---

**[BLOCKER-A3] Spec 01 §3 与 Spec 04 对 M1 阶段 tam validate 的 hook 校验标准互斥**

Spec 01 §3 声明"M1 仅校验存在性 + on-unsupported"，Spec 04 的标题是"M1 便携子集"，其 §8 验收测试要求 tam validate 对 event: pre:nonexistent 返回 E_HOOK_UNKNOWN_EVENT。同一命令在同一里程碑存在两套互相矛盾的行为要求：按 Spec 01 实现则 Spec 04 验收测试失败；按 Spec 04 实现则 Spec 01 的"M1 仅校验存在性"描述是错的。

> Fix：在 Spec 01 §3 明确 M1 对 hook 的校验范围至少包括 Spec 04 §5.2 所有 E_* 级别校验（event 合法值、invalid combo、missing matcher）。将"M3 落地"改为"M3 扩展到完整 capability profile 与平台映射校验"，消除歧义。同步更新 Spec 01 §6 验收场景，补充 hook 字段校验场景。

---

### MAJOR

**[MAJOR-A1] tap/1 schema 强制要求 tool.input，但 session-start/session-stop/user-prompt 事件无对应工具字段**

Spec 04 §6.1 tap/1 JSON schema 要求 tool 对象必填且 tool.input 必填。但对 pre:session-start、pre:session-stop、pre:user-prompt 事件，不存在被调用的工具，tool.name 和 tool.input 没有平台字段来源。shim 要么无法通过自身 schema 校验，要么必须虚构占位符值，破坏 tap/1 作为标准化 payload 的语义。

> Fix：修改 tap/1 schema 将 tool 字段改为可选（或对非工具事件允许 tool: null），在映射表中为生命周期事件给出明确的 tool 字段填充规则。同步更新 §8 Gherkin 场景，覆盖非工具事件的 shim 输出验证。

**[MAJOR-A2] Cursor 的 hookFileFormat: json-replace 在多包安装时后装包会覆盖先装包的 hook 配置**

Spec 05 §3.2 cursor@0.yaml 标注 hookFileFormat: json-replace（整文件替换）。用户先后安装两个 tam 管理的 hook 包时，第二次 install 生成的 .cursor/hooks.json 会覆盖整个文件，第一个包的条目消失。Spec 03 §5 的冲突检测基于 baseDigest，检测"用户是否修改了生成文件"，而非"两个 tam 托管包是否争用同一文件"——两个包都认为自己是该文件的所有者，每次 sync 都重写对方条目。

> Fix：Spec 03 和 Spec 05 必须定义 .cursor/hooks.json 的多包共存模型：tam 在 sync 时收集所有包的 hook 条目并合并生成完整 hooks.json（tam 成为该文件的唯一写入者）。明确 .cursor/hooks.json 的"所有权"是 tam 全局而非单包。

**[MAJOR-A3] Spec 05 §4.2 的 fail-closed 计算公式遗漏 exec_model 维度，且与 Spec 04 §2 的 8 个能力维度不对齐**

Spec 05 §4.2 fail-closed 规则枚举了 blocking、input_mutability、output_mutability 三个维度，遗漏了 exec_model。若平台对 exec_model: async 标注 unsupported，当前公式不会阻止生成配置。此外 Spec 04 §2 定义的 8 个能力维度中，payload_schema 完全未出现在 Spec 05 的 profile schema 中。

> Fix：Spec 05 §4.2 的 fail-closed 规则扩展到全部 8 个能力维度（含 exec_model）。在 profile 的 events 配置中为每个事件补充 exec_model 字段。在 _schema.yaml 中强约束 profile 声明的维度集合必须与 Spec 04 §2 完全对齐。

**[MAJOR-A4] 金丝雀 CI 步骤 4"验证 blocking hook 阻断"在 headless CI 中对 Claude Code 不可行**

Spec 05 §6.2 步骤 4 要求在 CI 中构造触发条件验证 blocking hook 确实阻断目标操作。Claude Code 是交互式 CLI agent，其 PreToolUse hook 的触发需要 Claude Code 进程运行并调用工具，headless CI 无法通过正常路径触发。若 CI 直接调用 shim 绕过 Claude Code 进程，验证的只是 shim 行为，测不到"平台的 blocking 语义"漂移——这恰恰是最关键的安全属性，实际上是空测试。

> Fix：在 Spec 05 §6.2 中区分格式合法性测试（可在 headless CI 中通过 schema 校验实现）和运行时语义测试（承认此步骤只能在手动 QA 环境中运行，标注为 M3 才落地）。不得在 spec 中描述一个在 CI 中不可自动化执行的验收标准。

**[MAJOR-A5] Spec 04 §7 生成的 settings.json 中 matcher 值为"Bash"，所有 Bash 调用均路由给 shim，无性能目标定义**

编译输出将 matcher 设为"Bash"（工具级匹配），所有 Bash 工具调用都会启动 tam-shim 进程，由 shim 内部执行 pattern 正则过滤后再决定是否调用脚本。对高频 Bash 调用，shim 启动延迟在 blocking 模式下直接叠加到每次调用上。Spec 04 没有任何性能目标或最坏情况延迟估算。

> Fix：在 Spec 04 §7 给出可接受延迟上限（如 shim 启动 + 匹配判断 < 50ms）。若 Claude Code 的 matcher 支持正则，优先使用平台层过滤，只在平台 matcher 不支持所需模式时才回退到 shim 内部过滤。在 Spec 05 §6.2 金丝雀 CI 中增加延迟基准测试步骤。

**[MAJOR-A6] Spec 05 profile 中 .claude/settings.json 使用 json-merge，但多包写入同一 hooks 事件类型时的合并语义未定义**

当两个包都注册 PreToolUse hooks 时，json-merge 语义未定义：是数组追加、后者覆盖还是报 E_BLOCK_OWNERSHIP？Spec 03 §5 的冲突检测基于文件粒度 digest，无法区分"哪个包的 hook 条目"，与 Cursor json-replace 问题是同一根因的两个变种，且发生在 Claude Code（M1 主平台）上。

> Fix：定义 .claude/settings.json 在 TAMart 管理下的写入模型：tam 必须成为 hooks 键的唯一写入者，在 sync 时从 tam.lock 收集所有包的 hook 条目合并写入。profile 中 hookFileFormat: json-merge 需配套定义"合并键路径"（hooks.PreToolUse[] 数组追加）和"去重规则"。在 Spec 03 §5 增加 config-merge 模式文件的多包归属处理规则。

---

### MINOR

- **[MINOR-A1]** Spec 04 §5.2 on-unsupported 字段校验违规时错误码复用了 E_HOOK_UNKNOWN_EVENT，语义混乱，应定义新错误码 E_HOOK_INVALID_FIELD_VALUE。
- **[MINOR-A2]** Spec 05 §7 breaking change 定义中"hook 事件新增/删除"未被列入触发条件，平台新增或废弃事件是否触发 breaking change 没有明确规定。
- **[MINOR-A3]** Spec 04 §6.3 将 shim 描述为 shell script，但 Windows 下无法直接运行，spec 对 Windows 的 shim 格式和回退路径完全未定义。
- **[MINOR-A4]** Spec 05 §4.4 在 lastCanaryPass 为 null 时使用 profile 文件 mtime 作为 stale 判断代理，但 git clone 后 mtime 被重置为 clone 时间，导致虚假"最新"状态。应改为 lastCanaryPass 为 null 时直接触发 W_PROFILE_STALE。
- **[MINOR-A5]** Spec 01 §2 name 字段正则允许 scope 以数字开头（如 @1okg/foo），与主流包管理器约定不一致，扩大视觉混淆型 typosquatting 攻击面。

---

## 2. 安全与信任

### BLOCKER

**[BLOCKER-S1] .tam/shims/ 文件完整性无持续校验，篡改后 sync 不检测不修复**

Spec 04 §6.3 规定 tam sync 只重建"缺失"的 shim，对"存在但已被篡改"的 shim 无任何检测或修复。.tam/shims/ 列入 .gitignore、不受版本控制，也不在 tam.lock 的 digest 追踪范围内。攻击路径：任何能向 .tam/shims/ 写文件的本地进程（CI 脚本、恶意编辑器插件）可替换 shim，此后每次 Claude/Cursor 触发 hook 时均执行攻击者代码，且 tam sync 不会发现也不会修复。M1 只读授权索引阶段，本地其他进程即可利用此向量，不依赖开放上传。

> Fix：(1) tam.lock 中记录每个 shim 文件的内容 digest；(2) tam sync 对已存在的 shim 执行 digest 校验，不匹配则强制重建；(3) shim 文件权限设为 0755 仅属 owner，检测到 world-writable 时告警并拒绝执行；(4) 明确将此项纳入 Day-1 红线，不得晚于 M1。

---

**[BLOCKER-S2] profile 作为唯一事实源，自身无完整性保护，篡改可静默重定向所有文件写入路径**

Spec 05 §4.3 明确 adapter 的 FileOp 生成（targetDir 等）、市场徽章、registry.json compat 字段均直接从 profile YAML 生成，禁止硬编码。Spec 05 §7.4 仅要求"PR + 1 名维护者审查"，无任何运行时完整性校验（无签名、无独立 hash 记录、无 CODEOWNERS 要求安全审查）。攻击路径一：攻陷一名维护者账号，提交将 targetDir 改为 ~/.ssh/ 的 PR，单一审查通过后，所有用户 tam install 均向该路径写文件。攻击路径二：攻陷金丝雀 CI runner，篡改 lastCanaryPass 后将 profile 标为"最新通过"，掩盖漂移。

> Fix：(1) profile 文件纳入 CODEOWNERS，要求安全团队必须参与审查；(2) profile 发布时对文件内容签名（sigstore bundle，与包签名同机制），CLI 安装前校验 profile 签名；(3) 将 targetDir、configFile 等路径字段列为"高危字段"，变更时触发额外告警和延迟发布（安全审查窗口）；(4) 将此项纳入 M1 Day-1 红线。

---

**[BLOCKER-S3] matcher.pattern（ECMA 正则）无 ReDoS 防护，恶意包可挂起 shim 进程导致阻断所有工具调用**

Spec 04 §5.1 只要求 matcher.pattern 为"合法 ECMA 正则"，无复杂度限制。恶意包可提交 ReDoS 型正则（如 `(a+)+`），shim 在每次工具调用时执行该正则匹配，触发指数级回溯，挂起 shim 进程。Spec 04 §5.1 的 timeout 字段限制的是脚本执行时间，不覆盖 shim 内部的正则匹配阶段。在 blocking hook 上，shim 挂起等价于阻断所有用户的工具调用，造成 DoS。此攻击在 M1 只读索引阶段即可发动（攻击者只需绕过只读限制提交一个包），且无需代码执行权限。

> Fix：(1) tam validate 在校验 pattern 合法性的同时，运行基准输入集的超时测试（如 1000 个字符重复串，100ms 超时）；(2) 对已知 ReDoS 模式做静态检测（exponential backtracking detector，参考 safe-regex 库）；(3) shim 在正则匹配阶段也套超时保护（与 action.timeout 独立，建议 10ms）；(4) 此项纳入 tam validate 的 E_* 级别校验，发布时拒绝。

---

### MAJOR

**[MAJOR-S1] tam-shim 向脚本透传 env: {} 空对象，但未明确禁止平台将进程环境变量注入 env 字段**

Spec 04 §6.1 定义 env 字段为"空对象（保留扩展）"，但未规定 shim 是否将宿主进程的环境变量（含 API key、凭证、token 等）传递给脚本。若实现者为"方便调试"将 process.env 合并进 tap/1 env 字段，用户脚本即可无声地读取宿主环境的全部凭证，构成凭证泄漏风险。

> Fix：Spec 04 §6.3 明确禁止 shim 将宿主进程环境变量传入 tap/1 env 字段；脚本如需环境变量，须在 tam.yaml permissions.network/env 中声明，由 shim 按声明选择性传入。

**[MAJOR-S2] Spec 06 对"原生直执资产"的 wrapper 要求与 Spec 04/05 中 shim 落盘路径存在设计冲突**

Spec 06 §1 要求可执行资产"要么经 TAMart wrapper 落盘（中介 file/env/network/exec），要么禁止"。Spec 04 §7 的编译输出显示 shim 只中介 payload 转换（stdin），不中介 file/env/network/exec。脚本本身仍由 Claude Code 直接执行，shim 不拦截脚本的系统调用。两个 spec 对"wrapper 的中介边界"定义不一致：Spec 06 要求完整沙箱，Spec 04 只做 payload 适配。

> Fix：在 Spec 04 §6.3 明确 shim 是"payload 转换层"而非"权限 broker"；显式声明 M1/M2 的 shim 不提供 Spec 06 §1 所述的运行时沙箱能力；完整权限 broker 为 M4 目标。同时在 Spec 06 §1 补充"原生直执资产在 G_OPEN 前的处置策略"（如标 unsafe-unmediated，需 --allow-unsafe 安装）。

**[MAJOR-S3]** profile lastCanaryPass 由金丝雀 CI runner 直接写入，单一 runner 被攻陷可伪造通过记录，掩盖真实漂移。→ Fix：lastCanaryPass 变更须经独立签名（与运行 CI 的 runner 密钥分离），CLI 校验签名后才信任该时间戳。

**[MAJOR-S4]** Spec 04 §6.3 shim 文件为 shell script，shell 注入路径未分析：若 script-path 或 platform 参数包含 shell 特殊字符，shim 命令行拼接可能导致命令注入。→ Fix：shim 调用脚本时使用 execve（不经过 shell 解释），参数作为独立 argv 传入，不拼接字符串。

**[MAJOR-S5]** Spec 05 §6.3 的 SECURITY_DRIFT 标签仅靠"人工在 24h 内评估"，无自动降级措施。若值班人员响应不及，受影响 hook 继续对所有用户生效。→ Fix：SECURITY_DRIFT 自动触发 blocking hook 降级为 warn-only 模式（不阻断，仅告警），直至人工确认修复。

**[MAJOR-S6]** Spec 04 §4 fail-closed 表格将 post:shell 在 Cursor 标为 unsupported，但 Spec 05 cursor@0 profile 定义了 post:file-edit 对应 afterFileEdit。若用户将 post:file-edit hook 用于安全审计（如扫描写入的凭证），Cursor 侧 afterFileEdit 的 non-blocking 语义会使该 hook 永远无法阻断，制造虚假安全感。→ Fix：在 Spec 04 §4 和 Spec 05 明确标注：Cursor 侧所有 post 事件均为 non-blocking，不得用于安全关键的阻断场景；tam validate 对用 post 事件声明 blocking:true 的 hook 资产在 Cursor target 上发出 W_SECURITY_DEGRADED。

---

### MINOR

- **[MINOR-S1]** Spec 04 §6.1 tap/1 schema 使用 $schema 引用 `https://tamart.dev/schemas/tap/1/hook-payload.json`，但该 URL 在 M1 阶段不存在，shim 实现者若运行时 fetch schema 做校验将产生网络依赖和失败。→ 明确 schema 引用仅用于文档，shim 校验使用内嵌 schema，不发起网络请求。
- **[MINOR-S2]** Spec 01 §4 的 permissions.network 声明为"声明值"，但 shim 不中介网络（见 MAJOR-S2），所以该声明在 M1 阶段完全不可执行，用户看到"已声明网络权限"会误以为有保护。→ 在 permissions 说明中注明"M1 阶段仅作展示，运行时强制为 M4 目标"。
- **[MINOR-S3]** Spec 04 §6.3 shim 生成位置 .tam/shims/ 在项目根目录，若用户有多个 TAMart 管理的项目在同一机器，不同项目的 shim 相互隔离，但跨项目的 shim 版本可能不一致。→ 明确 shim 版本与 tam CLI 版本绑定，tam upgrade 时重建所有 shim。

---

## 3. 产品与 GTM

### BLOCKER

**[BLOCKER-P1] 北极星指标"周留存可移植安装"在 M1/M2 阶段实际不可测量**

PRD §7 定义北极星指标为"将某包安装进非原生 target 且 7/30 日后仍在的安装数"。在 M1（只读授权索引，少量种子包）和 M2（邀请制 beta）阶段，可移植安装绝对数量极低，无法区分"指标低"是产品问题还是分母太小。更根本的问题：tam.lock 的存活率如何跨机器/跨仓库追踪？没有遥测设计（用户是否同意上报？上报什么信号？如何识别"仍在"），北极星无法在 M1/M2 建立基线。M2 的"出：北极星建基线"里程碑出口标准在技术上不可达。

> Fix：在 PRD §7 或新增 Telemetry Spec 中定义：(1) 可追踪的最小遥测信号（用户 opt-in，仅上报 tam install/sync 事件和 target 类型，不含内容）；(2) M1/M2 的代理指标（proxy metric）：tam.lock 中非原生 target 的安装记录数、beta 用户 sync 成功率；(3) 北极星的分母目标（先定义"足够大的分母"才能有意义的留存率）。M2 出口标准改为"遥测基础设施就绪 + 代理指标建基线"。

---

**[BLOCKER-P2] tam-shim 是隐藏的高工作量组件，未出现在任何里程碑的范围定义中**

tam-shim 需要：独立 CLI 二进制、多平台构建（macOS/Linux/Windows）、payload 格式转换逻辑、退出码命名空间、完整性验证（见 BLOCKER-S1）、版本管理、CI 自动化测试。这些工作量接近于实现一个完整的小型 CLI 工具。PRD §9 M1 范围描述"CLI(init/validate/install/sync) + claude-code & cursor adapter"，完全未提及 shim。工程师估算 M1 工作量时将严重低估，导致 M1 延期或功能削减。

> Fix：在 PRD §9 M1 范围中显式列出 tam-shim 作为独立交付物，并给出其 MVP 约束（如"M1 仅支持 macOS/Linux，Windows shim 为 M2"）。在 Spec 04 §6.3 补充 shim 的版本管理策略（shim 版本与 tam CLI 版本绑定还是独立发布？）。

---

### MAJOR

**[MAJOR-P1] "导入并编译我的配置"工作流缺乏具体的 Day-1 内容，M2 冷启动路径不清晰**

PRD §4.5 将 Day-1 主打工作流定为"导入我的 Claude/Cursor 配置 → 编译到另一个工具"，但没有说明 M2 上线时 registry 里有哪些包可以"导入"。授权索引（opt-in / 官方 feed / 宽松许可）的具体来源和数量未定义，用户打开 TAMart 看到空列表或 5 个包时会立即流失。M2 的"邀请制作者 beta（自有策展供给）"意味着供给完全依赖手动运营，缺乏系统性的内容来源规划。

> Fix：在 PRD §4.5 或新增 Content Strategy 文档中定义：M2 上线时的最小包数量目标（如 20-50 个）、内容来源（如 TAMart 团队自建 5 个示范包、来自 claude-community 仓库的 opt-in 转入、Cursor 官方 skill 仓库的 opt-in 包）、每个来源的合规审查状态。

**[MAJOR-P2] Spec 05 的 profile 演进协议（§7）要求"安全团队参与审查"但 PRD 路线图中无对应的安全团队资源规划**

见 BLOCKER-S2 Fix 引入的安全审查要求。企业在 M1/M2 阶段可能没有专职安全团队，这个要求会在实操中被跳过。

> Fix：在 PRD §9 或 §5 中明确安全审查的最低门槛（如"至少一名有安全背景的维护者审查高危字段变更"），给出在早期团队中可操作的替代方案。

**[MAJOR-P3] M2/M3 即引入付费私有 registry，但安全门禁（G_OPEN）未解锁时私有 registry 的付费价值主张是否成立存疑**

PRD §9 注释"M2/M3 即可引入付费私有 registry"，但私有 registry 的核心企业价值（审计日志、策略强制、可追溯的包来源）与 G_OPEN 安全基础设施高度重叠。在 M4 之前，私有 registry 可能只是一个未加固的 git 仓库，企业采购决策者不会为此付费。

> Fix：明确 M2/M3 私有 registry 的付费价值边界（如"仅 lockfile 复现 + scope 隔离"，不包含审计日志）。若企业要求审计日志，标注为 M4+ 功能，避免在 M2 销售中造成预期落差。

**[MAJOR-P4] spec 04 hook 系统的复杂度对 M1 用户来说过高，没有"零配置钩子"的快速入门路径**

hook 能力格（8 个维度、tap/1 schema、shim 安装、blocking 语义）对于想"直接用一个现成 hook 包"的用户是不必要的复杂度暴露。M1 的用户故事（PRD §3.2 故事 1）是消费者搜索并安装 hook，但当前设计假设用户理解 tap/1、shim 和能力格。

> Fix：在 CLI 的用户面层面隐藏 hook 复杂度：tam install 对 hook 包只展示"此包含有 X 个 hook，需要执行权限"，不暴露 tap/1 细节。将能力格和 spec 04 细节定位为"作者/高级用户文档"，消费者不需要理解。

---

### MINOR

- **[MINOR-P1]** PRD §7 的健康度指标"兼容性失效上报"需要用户主动反馈，在 M1/M2 流量极低时几乎不会有数据。→ 补充"自动化兼容性失效检测"（金丝雀 CI 失败率即为一种自动信号）作为代理指标。
- **[MINOR-P2]** PRD §10 的"演进触发条件"（如"index 超数千包才上 Meilisearch"）是延迟决策点而非具体计划，团队可能在达到阈值时才发现迁移成本远超预期。→ 在 M2 结束时做一次"hosted 迁移预演"，提前验证数据迁移路径，不等到真正触发。

---

## 4. 规范质量与可实现性

### BLOCKER

**[BLOCKER-Q1] pre:file-edit 三角矛盾（与 BLOCKER-A2 同根）阻断工程实现**

（见 BLOCKER-A2，不重复展开。）结论：开工前必须有一个明确的架构决策文档，说明 pre:file-edit 在 Cursor 侧的处置，三个文件同步修改。

**[BLOCKER-Q2] Spec 05 §2 引用的 _schema.yaml 未定义，而 profile YAML 是 adapter 的运行时依赖**

Spec 05 §2 提到 `profiles/_schema.yaml`（profile 的 JSON Schema）但完全未定义其内容。该文件是：(1) adapter 代码的运行时校验依据；(2) CI pipeline 在 golden 测试前必须通过的校验步骤（Spec 05 §5.3）；(3) profile 演进协议的执行基础（Spec 05 §7.4）。在 _schema.yaml 不存在的情况下，adapter 实现者无法知道如何校验 profile 的合法性，CI 的"E_PROFILE_INVALID"报错无法触发，Spec 05 本身的验收场景 1（支持级别从 profile 生成）无法被自动化验证。

> Fix：在 Spec 05 §3 之后新增 §3.3 节，定义 _schema.yaml 的完整 JSON Schema（最低要求：顶层字段类型约束、assets 下每种类型的必填字段、events 下每个事件的必填维度字段、合法枚举值与 Spec 04 §2 对齐）。_schema.yaml 本身作为 M1 交付物列入 Spec 05 §8 验收标准。

**[BLOCKER-Q3] Spec 04 §6.3 shim 的关键实现细节未定义，工程师无法据此实现**

Spec 04 §6.3 描述 shim 为"shell script"，调用方式为 `tam-shim tap/1 <platform> <script-path>`，但以下实现关键细节全部缺失：(1) shim 是 shell script 还是编译二进制？（Windows 兼容性、分发方式不同）；(2) shim 由 tam CLI 哪个子命令生成，生成时机和生命周期是什么？；(3) shim 自身版本如何管理（与 tam CLI 版本耦合还是独立？）；(4) shim 文件的内容模板是什么（具体如何读取 stdin、执行转换、调用脚本）？；(5) .tam/shims/ 目录的 .gitignore 条目是 tam init 自动创建还是手动？；(6) shim 在 CI 环境（无 tam CLI 的机器）如何处理？

> Fix：在 Spec 04 新增 §6.4 shim 实现规范，覆盖上述六点。最低要求：明确 shim 的二进制格式（建议：Node.js script，与 tam CLI 同语言，由 `tam install` 写入 .tam/shims/，内容从 CLI 内嵌模板生成）；tam.lock 中记录每个 shim 的生成版本（tam CLI 版本 + 目标 platform）；.tam/shims/ 条目由 `tam init` 自动写入 .gitignore。

---

### MAJOR

**[MAJOR-Q1] Spec 03 §4 的"事务性与幂等"与 Spec 05 §5 的 golden 幂等断言在 config-merge 模式下存在测试盲区**

Spec 03 §4 定义的幂等性：对同一 lock 重复 sync 产生零 FileOp。Spec 05 §5.2 golden 测试断言"对已安装状态再次运行 sync 产生零 FileOp"。这两个断言对 mode: file 资产成立（文件内容不变，则 FileOp 为空）。但对 mode: config-merge 资产（如 .claude/settings.json 的 hook 条目），若两次 sync 的合并算法不稳定（如 JSON key 顺序不一致），第二次 sync 会检测到 digest 变化，产生非零 FileOp，golden 测试失败但行为"正确"。spec 未定义 config-merge 产物的规范化（canonicalization）要求。

> Fix：在 Spec 03 §4 明确 config-merge 产物的规范化规则（JSON key 排序、缩进格式固定），确保相同逻辑内容产生相同 bytes。在 Spec 05 §5.2 golden fixtures 中增加一个含 config-merge 资产的 fixture（hook-multipack），验证多次 sync 幂等。

**[MAJOR-Q2] Spec 04 §3.1 的"session-stop 映射到 Claude Code Stop"与 Spec 05 claude-code@0 的 nativeName 不一致**

Spec 04 §3.1：pre:session-stop → nativeName: Stop（Claude Code）。Spec 05 §3.1 claude-code@0 profile：session-stop → nativeName: SessionStop。两个 spec 对同一字段给出不同值，工程师按 spec 04 实现时 profile 校验会失败，反之亦然。（此问题已在 spec 05 修正将 nativeName 改为 Stop，但需确认两处完全对齐。）

> Fix：确认 Claude Code 实际事件名（通过官方文档），统一到一个值，并在 _schema.yaml 中做枚举约束，禁止自由文本。两个 spec 同步引用 _schema.yaml 而非各自硬编码枚举值。

**[MAJOR-Q3] Spec 04 §5.1 YAML Schema 缺少对 `capabilities` 子字段与 `event` cadence 的联合校验**

Spec 04 §2 定义 output_mutability: mutable 要求 cadence: post，blocking: false 与 input_mutability: mutable 互斥。但 §5.1 的 YAML Schema 只是一个结构性示例，未展示如何对这些跨字段约束进行机器可校验的表达（YAML 本身不支持 if/then/else 约束，需要额外的校验逻辑）。Gherkin 场景 §8 中没有覆盖"output_mutability: mutable + cadence: pre"这一互斥场景。

> Fix：在 Spec 04 §5.2 字段校验规则中，明确"跨字段约束由 tam validate 的命令式校验逻辑执行，而非 YAML schema 声明"，并在 §8 增加两个 BLOCKER Gherkin 场景：(1) output_mutability: mutable + cadence: pre → E_HOOK_INVALID_COMBO；(2) blocking: false + input_mutability: mutable → E_HOOK_INVALID_COMBO。

**[MAJOR-Q4] Spec 02 §5 的解析校验链（5 步）与 Spec 03 §3 的 install 流程（7 步）对校验步骤的划分有重叠和歧义**

Spec 02 §5 定义了"解析 → semver → 下载 → digest 校验 → signature 校验 → yanked 检查 → 进入编译"的链，Spec 03 §3 的 install 流程第 1 步是"解析 + 归档校验（Spec 02 §5）"，其余步骤包括 adapter.plan、报告、冲突检查、事务落盘。两个 spec 均未明确"进入编译"的边界：adapter.plan 是"编译"的一部分还是独立步骤？tam.lock 的冲突检查在 Spec 02 之前还是之后？当 Spec 02 step 5 检查 yanked 失败时，Spec 03 的事务如何回滚？

> Fix：在 Spec 03 §3 中引用 Spec 02 §5 时，明确两者的职责分界：Spec 02 §5 = "包完整性与注册中心校验"（纯读操作，无副作用）；Spec 03 §3 步骤 1 结束后进入"编译与落盘"阶段（有副作用）。在 Spec 03 §7 补充"Spec 02 yanked 检查失败"的 Gherkin 场景，定义事务回滚行为。

**[MAJOR-Q5]** Spec 05 §6.2 步骤 5 要求金丝雀 CI "写入 profile 的 lastCanaryPass"，但 profile 文件在 git 版本库中，CI 写入需要 git commit + push，这个操作在 spec 中完全未规定（需要哪个 bot 账号？PR 还是直接 push main？与 Spec 05 §7.4 的"所有变更需 PR + 审查"是否冲突？）。→ Fix：在 Spec 05 §6.2 明确 lastCanaryPass 更新的 git 操作规范（建议：CI bot 直接 push 到 main 的豁免规则，仅允许 lastCanaryPass 字段变更，其余字段变更仍需 PR）。

**[MAJOR-Q6]** Spec 01 §3 对 `hook` 类型的 src 校验说"M1 仅校验存在性 + on-unsupported"，但 Spec 04 §5.2 的字段校验（E_HOOK_UNKNOWN_EVENT、E_HOOK_MISSING_MATCHER 等）均为 E_* 级别（即 tam validate 应该执行的校验）。两处对 M1 校验范围的界定冲突（见 BLOCKER-A3）。→ Fix：同 BLOCKER-A3。

**[MAJOR-Q7]** Spec 03 §5 三方合并逻辑引入了"归属转移"（用户编辑托管区块后，后续 sync/uninstall 不再当作生成内容），但转移后该内容的命运未定义：是永久转为用户所有？还是下次 update 时弹出冲突？→ Fix：在 Spec 03 §5 定义"归属转移"的完整状态机：转移后的内容如何与后续版本更新交互，以及转移是否可以逆转（如 `tam adopt` 命令重新将用户内容纳入托管）。

**[MAJOR-Q8]** Spec 04 §4 可移植子集声明 domain: session-stop 在 Cursor 上为"partial：生成 stop 事件绑定，阻断语义不保证"，但这违反了子集的定义（"双平台均完整支持"），且 fail-closed 规则表将其归为"partial"而非"不生成任何配置"，造成子集内包含"部分支持"项的矛盾。→ Fix：将 session-stop 从可移植子集中移除（与 session-start 同等处理），或在子集定义中新增"partial"层级并明确其语义（partial 下生成配置，但 tam install 打印 W_PARTIAL_SUPPORT）。

---

### MINOR

- **[MINOR-Q1]** Spec 01 §3 中 skill 的校验"frontmatter 必须有 description"，但未规定 description 的最小/最大长度，空字符串可以通过校验。→ 补充 `description: 1-500 字符` 约束。
- **[MINOR-Q2]** Spec 02 §2 归一化步骤要求"仅纳入 tam.yaml + assets[].src 引用的文件 + README.md"，但未规定 README.md 缺失时的行为（error？warning？跳过？）。→ 在 Spec 01 §2 中将 README.md 设为必填字段，与 Spec 02 §2 的假设对齐。
- **[MINOR-Q3]** Spec 03 §1 的退出码定义（0/1/2/3）与 Spec 04 §5.2 shim 的 BSD sysexits 建议（64-78）之间的关系未说明，消费 tam CLI 的脚本可能混淆两套退出码。→ 在 Spec 04 明确：shim 退出码 namespace（64-78）专属于 shim 内部错误，不与 tam CLI 退出码（0/1/2/3）冲突，平台只看到 0/1/2（脚本业务码）。
- **[MINOR-Q4]** Spec 03 §7 的 dry-run 场景声明"文件系统与 tam.lock 均无改动"，但 Spec 03 §4 的崩溃恢复需要读取 tam.lock.journal，dry-run 是否跳过 journal 修复未定义。→ 明确 dry-run 下 journal 修复步骤的处理方式（建议：只读模拟，不修改 journal 或 lock）。
- **[MINOR-Q5]** Spec 05 §3 的 profile owner 字段定义为邮箱格式，但 §7.3 说"负责监听上游 release、响应金丝雀告警"——个人邮箱不适合作为告警路由目标（人员变动后失效），应改为团队邮件列表或 issue tracker 标签。

---

## 5. 跨维度共识（最高优先级问题）

以下问题被多个维度独立指出，优先级最高：

1. **pre:file-edit 三角矛盾（A2 / Q1 / Q2）**：三个 spec 对同一事件给出相互矛盾的定义，是真正的架构分叉点。任何工程师开始实现 Cursor hook 适配器都会立即遇到此问题，且无法自行决策。**必须在 kickoff 会议前做出架构决策并同步三处文档。**

2. **tam-shim 工作量边界未定义（A1 / P2 / Q3）**：shim 在架构、产品、规范三个维度均被独立识别为关键缺失。它是 hook 系统的运行时基础设施，却完全不在任何里程碑的范围描述中，且实现细节（格式、生命周期、平台支持）未规范化。**M1 估算必须将 shim 作为独立工作流列入。**

3. **profile 完整性保护（S2 / Q2）**：profile 作为"唯一事实源"同时也是"单点故障"：一旦 profile 被篡改，所有 adapter 行为随之改变。安全和规范质量两个维度均指出这一风险没有技术对策（无签名、无独立 hash、审查要求未落地）。**纳入 Day-1 红线。**

4. **金丝雀 CI 可行性（A4 / Q5）**：blocking hook 的运行时语义测试（Spec 05 §6.2 步骤 4）在 headless CI 中不可自动化，CI 结果写回 git 的操作未规范化。一个无法在 CI 中运行的验收标准等同于无验收标准。**Spec 05 §6.2 必须在 M1 前修订，明确哪些步骤是自动化的，哪些是手动 QA。**

5. **M1 校验范围冲突（A3 / Q6）**：Spec 01 和 Spec 04 对 tam validate 在 M1 阶段对 hook 的校验范围描述相互矛盾，导致实现者无法确定实现目标。**与 pre:file-edit 矛盾并列为开工前必须消除的歧义。**

---

## 6. 建议行动清单

### M1 开工前必须解决（BLOCKER）

| # | 问题 | 涉及文件 | 负责人 |
|---|------|---------|-------|
| B1 | pre:file-edit 架构决策 + 三处同步（Spec 04 §3.2/§4、Spec 05 cursor@0） | spec 04, spec 05 | 架构负责人 |
| B2 | Spec 01/Spec 04 M1 hook 校验范围统一 | spec 01, spec 04 | 规范负责人 |
| B3 | tam-shim 实现规范（Spec 04 §6.4：格式/生成/版本/平台） | spec 04 | 规范负责人 |
| B4 | Spec 05 §3.3 补充 _schema.yaml 定义 | spec 05 | 规范负责人 |
| B5 | shim 退出码命名空间隔离（Spec 04 §6.3） | spec 04 | 规范负责人 |
| B6 | shim 完整性：tam.lock 记录 shim digest + sync 校验 | spec 04, spec 03 | 安全/规范负责人 |
| B7 | profile 完整性：签名机制或 CODEOWNERS 强制审查 | spec 05 | 安全负责人 |
| B8 | ReDoS 防护：tam validate 对 pattern 做复杂度检测 + shim 内部超时 | spec 04 | 安全负责人 |
| B9 | 北极星指标：定义 M1/M2 代理指标 + 遥测基础设施规划 | PRD §7 | 产品负责人 |
| B10 | PRD §9 M1 范围补充 tam-shim 作为独立交付物 | PRD | 产品负责人 |
| B11 | tap/1 schema 修复：tool 字段对非工具事件改为可选 | spec 04 §6.1 | 规范负责人 |

### M1 期间跟进（MAJOR，不阻断开工但影响完成质量）

- json-replace/json-merge 多包共存模型（Spec 03 + Spec 05）
- Spec 05 §4.2 fail-closed 公式补全 exec_model + payload_schema 维度
- 金丝雀 CI §6.2 步骤 4 修订为可自动化的测试范围
- shim 向脚本的 env 传递策略明确（禁止传递宿主环境变量）
- lastCanaryPass 更新的 git 操作规范
- config-merge 产物规范化定义（保证幂等）
- Spec 03 §5 归属转移状态机完整化

### 可后置（MINOR）

- Windows shim 支持（M2）
- tap/1 $schema URL 为内嵌校验（实现阶段处理）
- scope 命名正则限制字母开头（Spec 01 §2）
- M2 私有 registry 付费价值边界明确
- profile owner 改为邮件列表
