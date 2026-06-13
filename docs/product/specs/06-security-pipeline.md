# Spec 06 — 安全管线与 `G_OPEN` 门禁(规范性,开放上传前提)

> 状态:Draft。落实 PRD v2.1 §5 与安全审查重跑(对抗视角)的 7 项 blocker。
> **结论先行**:在本规范全部 pass 之前,**不得开放第三方上传**(`G_OPEN` 保持关闭)。
> 静态扫描只能作为信号,**不能**作为任意宿主执行代码的唯一准入控制。

## 1. 可执行资产的运行时边界(blocker 1/9)

- **定义**:`hook`、或 `skill` 含 `scripts/**` = **可执行资产**;其余为非可执行。
- Claude/Cursor 的 hook/skill 由**宿主工具直接执行**,TAMart 的 broker 管不到落盘后的原生脚本。因此开放上传下:
  - **要么**经 **TAMart wrapper** 落盘:wrapper 实际中介 file/env/network/exec(按 `enforced_permissions` 放行),宿主只调用 wrapper;
  - **要么禁止**该资产;若用户坚持安装未中介版本 → 标 `unsafe`、需显式 `--allow-unsafe` opt-in、**不得**获 `verified`/CI 批准徽章。
- manifest 分离 `declared_permissions`(自证,仅展示)与 `enforced_permissions`(wrapper 实际强制);信任徽章只认后者。
- 企业/CI 默认 **default-deny** 可执行 community 资产。

## 2. `G_OPEN` 门禁:可验证证据集(blocker 2/10)

开放上传**当且仅当**下列每项有自动化 pass/fail 证据且全绿:

| 门禁项 | 通过证据(pass/fail) |
|---|---|
| 敌意归档防御 | **绕过/敌意语料**(zip-slip、symlink、碰撞、注入样本)全部被拒 |
| 运行时边界 | **沙箱逃逸测试**:wrapper 内脚本无法越权访问未声明 file/env/network/exec |
| 扫描信号 | 已知恶意样本集召回 ≥ 阈值(仅作信号,不单独决定准入) |
| 签名/吊销 | **签名吊销演练**:吊销后 install/sync 在分钟级拒绝该 signer 的包 |
| takedown | **takedown 演练**:从报告到 denylist 生效 < 目标 SLA |
| 默认拒绝 | 企业策略 default-deny 可执行 community 包,生效可验证 |

`tam validate --gate` 与 CI 跑该证据集;任一 fail → `G_OPEN` 不可开。

## 3. 敌意归档防御(blocker 3/11)

归一化(Spec 02 §2)在安全维度必须额外:

- 拒绝绝对路径、`..` 逃逸、符号/硬链接逃出归档根;路径规范化后必须仍在根内。
- 检测 Unicode 规范化 / 大小写不敏感文件系统的**名称碰撞**;命中 → 拒绝。
- 固定文件模式,剥离 setuid/setgid/可执行位以外的特殊位。
- 对 `tam.yaml`/`README.md`/各 native manifest 字段做**按目标转义**,防元数据注入(如把控制序列注入 Cursor/Claude manifest)。
- **CLI 落盘前再归一化校验**:install/sync 在写盘前重跑路径/碰撞检查,不信任 registry 端结果。

## 4. 密钥与账号失陷(blocker 4/12)

- official/verified 发布者私钥用 **HSM/KMS**;不接受裸私钥签名进入这两级。
- registry **门限共签**(发布者签名 + registry 共签),单一账号失陷不足以发出"合法"恶意版本。
- 客户端可配置 **signer 吊销表**;`tam.lock` 记录 signer,吊销后 sync 拒绝。
- 维护者账号管控(2FA/OIDC 绑定)+ 失陷 playbook(冻结 scope、批量吊销、通知下游)。

## 5. scope 绑定 fail-closed(blocker 5/13)

- `tam.lock` 对每个依赖 pin:精确 registry URL + 命名空间 owner + `digest` + `signer`。
- **未绑定 scope → fail-closed**(拒绝解析,提示显式绑定),绝不隐式跨 registry fallback / first-match。
- 保留 vendor/official scope,禁止社区抢注;相似 scope 入人工队列。

## 6. 紧急吊销(blocker 6/14)

- 维护**签名 denylist/吊销表**,在 install、sync、以及 wrapper 运行时校验。
- 事件级目标 **分钟级**(非 24h);yank 时直接通知已安装用户/组织(CLI 警告 + 可选 webhook)。

## 7. 归档存储滥用治理(blocker 7/15)

- 入库前:大小 / 文件数配额、限流、滥用扫描(恶意/侵权/非法内容)、隔离队列。
- 合法删除:不可变原则的**例外路径** —— 以**密码学墓碑(tombstone)**替换内容(保留 digest 记录与"已删除"证明),
  使已锁安装得到明确失败而非静默 404,同时满足法律删除义务。
- 保留例外与审计日志留痕。

## 8. 验收(摘要)

```gherkin
Scenario: G_OPEN 不可在证据缺失时开启
  Given §2 证据集任一项为 fail
  When 尝试开放第三方上传
  Then 被拒,报告缺失门禁项

Scenario: 未中介可执行资产不得获信任徽章
  Given 一个含 hook 的包未经 wrapper 中介
  When 安装并尝试标记 verified
  Then 标 unsafe、需 --allow-unsafe、徽章被拒

Scenario: 吊销分钟级生效
  Given 某 signer 被加入吊销表
  When 之后 install/sync 取用该 signer 的包
  Then 分钟级内被拒
```
