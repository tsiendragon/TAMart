# Spec 02 — Registry 索引、不可变归档与 Package Digest(M1,规范性)

> 状态:Draft for M1。落实 PRD v2 §4.3「git-repo 索引 + 接收即物化不可变归档」。

## 1. 两个事实源

1. **索引(git repo)**:`registry.json` —— 可读、可 PR、可审计;承载元数据与指针。
2. **归档存储(content-addressed)**:接收入库时把包归一化为 canonical archive,按 `digest` 寻址存储。
   `tam install` 永远从归档取内容,**不依赖发布者上游 repo 的可用性**。

> v1:索引为只读授权集合;开放第三方 PR 在 `G_OPEN`(PRD §9)后开启。

## 2. Canonical Package Archive 与 Digest

- **归一化**:按字典序排序条目、固定权限位(文件 0644 / 目录 0755)、剥离时间戳、统一 LF、UTF-8;
  仅纳入 `tam.yaml` + `assets[].src` 引用到的文件 + `README.md`。submodule/LFS 必须在归一化前解析为实体内容,
  无法解析 → `E_ARCHIVE_UNRESOLVABLE`(拒绝入库)。
- **格式**:确定性 tar(USTAR,固定字段)→ 命名 `tam-pack/1`。
- **digest**:`sha256` of 归一化 tar;表示为 `sha256:<hex>`。
- 相同输入在任意机器产出相同 digest(可复现);CI 校验"重算 digest == 记录值"。
- **敌意输入防御(安全强化,见 [Spec 06 §3](./06-security-pipeline.md))**:归一化必须拒绝绝对路径、`..` 逃逸、
  符号/硬链接逃出根、Unicode/大小写名称碰撞;剥离特殊文件位;对 manifest/README/native manifest 字段做按目标转义防注入。
  **CLI 落盘前再归一化校验**,不信任 registry 端结果。

## 3. `registry.json` schema

```jsonc
{
  "schemaVersion": 1,
  "name": "tamart-official",
  "packages": {
    "@okg/git-workflow": {
      "scope": "okg",
      "versions": {
        "1.2.0": {
          "digest": "sha256:ab12…",          // 必填,指向归档,内容寻址
          "archiveUrl": "https://cas.tamart.dev/sha256/ab12…",
          "provenance": {                       // 仅溯源,非完整性来源
            "repo": "https://github.com/okg/git-workflow",
            "commit": "9f3c…",
            "tag": "v1.2.0"
          },
          "signature": "sigstore-bundle…",      // 对 digest+记录 的发布者签名
          "publishedAt": "2026-06-13T00:00:00Z",
          "yanked": false,
          "compat": {                            // 由 profile 生成,见 Spec 03
            "claude-code": "native",
            "cursor": "translated"
          }
        }
      }
    }
  }
}
```

| 不变量 | 规则 | 违反 |
|---|---|---|
| 版本不可变 | 同 `@scope/name@version` 一经写入,`digest` 不可改 | CI 拒绝改动既有版本块 |
| digest 必填且自洽 | 重算归档 digest 必须等于记录值 | `E_DIGEST_MISMATCH` |
| 签名有效 | sigstore bundle 校验通过且签名者属于 `scope` 的认证发布者 | `E_SIGNATURE_INVALID` |
| yank 单向 | `yanked` 只能 false→true;阻断新装,保留已锁归档可取回(带告警) | — |

## 4. 命名空间与解析(防依赖混淆)

- `scope` 全局唯一,绑定一个或多个认证发布者身份(域名验证)。
- CLI 配置 registry 列表 + **scope↔registry 绑定**:`@okg/* → 内网 registry` 优先且**确定**。
  **未绑定 scope → fail-closed**(拒绝解析并提示显式绑定),**绝不**隐式跨 registry fallback / first-match。
  `tam.lock` 对每依赖 pin 精确 registry URL + owner + `digest` + `signer`。杜绝"同名包从错误 registry 解析"。
- typosquatting:相似 scope/name 入库进人工队列(`W_NAME_SIMILAR`)。

## 5. 解析与安装期校验链

```
tam install @okg/git-workflow@^1.2
  1. 按 scope 绑定选定 registry
  2. semver 解析 → 选版本 → 取 {digest, archiveUrl, signature, provenance}
  3. 下载归档 → 重算 digest == 记录?否则 E_DIGEST_MISMATCH(中止)
  4. 校验 signature?否则 E_SIGNATURE_INVALID(中止)
  5. 若 yanked → 仅当已在 tam.lock 锁定才允许,且打印安全告警;否则 E_YANKED
  6. 进入编译(Spec 03)
```

## 6. 验收标准

```gherkin
Scenario: 上游 repo 删除后仍可复现
  Given 一个已入库版本,其 provenance.repo 已被删除
  When 另一台机器 `tam sync`(lock 含该版本 digest)
  Then 从归档存储取回内容、digest 校验通过、安装成功

Scenario: 同版本内容偷换被拒
  Given 试图用不同内容重写既有 @scope/name@1.2.0
  When 提交 PR / 调发布 API
  Then 被拒,报 E_DIGEST_MISMATCH 或"版本不可变"

Scenario: 依赖混淆
  Given 默认 registry 存在同名 @okg/foo,而 @okg/* 绑定到内网 registry
  When 解析 @okg/foo
  Then 从内网 registry 解析,不被默认 registry 抢占
```
