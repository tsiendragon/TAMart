# PLAY_STORE_GUIDE — Android 发布手册

## 发布路径

```
AAB 构建（scripts/build-aab.sh）
  └── Play Console 内部测试（<100 人）
        └── 封闭测试（邀请测试员）
              └── 开放测试（可选）
                    └── 正式发布（分阶段推送）
                          1% → 10% → 50% → 100%
```

## 版本号约定

格式：`versionName+versionCode`（`pubspec.yaml` 中的 `version` 字段）

```yaml
# frontend/pubspec.yaml
version: 1.2.0+45
#         │     └── versionCode (Android): 每次发布递增，不可重复
#         └── versionName (用户可见): SemVer
```

**规则：**
- `versionCode`（build number）每次上传 Play Console 必须大于上次，否则拒绝上传
- `versionName` 可以相同（hotfix 同版本多 build）

## Keystore 管理

```
文件：frontend/android/keystores/release.jks（不入 git）
引用：frontend/android/key.properties（不入 git）

key.properties 格式：
  storePassword=<来自 CI secret>
  keyPassword=<来自 CI secret>
  keyAlias=<alias>
  storeFile=keystores/release.jks

CI 注入方式：
  1. 将 release.jks 转为 base64: base64 -i release.jks
  2. 存入 CI secret: KEYSTORE_BASE64
  3. CI 步骤:
     echo "$KEYSTORE_BASE64" | base64 -d > frontend/android/keystores/release.jks
     创建 key.properties 文件（用 STORE_PASSWORD / KEY_PASSWORD / KEY_ALIAS 环境变量）
```

**Keystore 安全原则：**
- keystore 文件和 key.properties 永远不入 git（已在 .gitignore）
- keystore 密码使用强随机密码（>24 字符）
- 备份 keystore 文件到多个安全位置（丢失后无法重新签名同一 App）

## 构建命令

```bash
# 标准构建
bash scripts/build-aab.sh

# 指定版本号
bash scripts/build-aab.sh 1.2.0 45

# 输出路径
# frontend/build/app/outputs/bundle/release/app-release.aab
```

## 上传 Play Console

**手动上传：**
1. 登录 https://play.google.com/console
2. 选择 App → 发布管理 → 内部测试
3. 创建新版本 → 上传 AAB
4. 填写中英文版本说明
5. 提交审核（内部测试无需审核，直接可用）

**Fastlane 自动化（可选）：**
```bash
# Gemfile 中添加 fastlane
cd frontend/android
fastlane supply \
  --aab build/app/outputs/bundle/release/app-release.aab \
  --track internal \
  --json_key <path-to-service-account.json>
```

## 发布记录

| 日期 | versionName | versionCode | 轨道 | 状态 |
|------|-------------|-------------|------|------|
| YYYY-MM-DD | 1.0.0 | 1 | internal | Released |
