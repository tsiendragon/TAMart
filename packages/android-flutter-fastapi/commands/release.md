---
name: release
description: 发布命令：后端 Docker 部署（含 Alembic migration）或 Flutter AAB 构建上架 Play Store；前置条件全部满足才执行
---

## 用法

```
/release backend [version]    # 部署后端到 Docker
/release flutter [version]    # 构建 AAB 上架 Play Store
/release all [version]        # 后端 + 前端一起发布
```

示例：
```
/release backend v1.2.0
/release flutter 1.2.0+45
/release all v1.2.0
```

## 前置条件（全部满足才执行）

```
[ ] /test-feature 已运行，结论：PASS
[ ] /review 已运行，结论：APPROVED（无 BLOCKER）
[ ] .claude/state/openapi.stale 不存在
[ ] .claude/state/migration.stale 不存在
[ ] 当前分支为 release/* 或 main
```

如任一不满足，输出具体缺失项并停止。

## 发布前版本确认

```bash
# 后端版本（修改 backend/VERSION 或 pyproject.toml）
cat backend/VERSION

# Flutter 版本（frontend/pubspec.yaml）
grep "^version:" frontend/pubspec.yaml
# 格式：version: 1.2.0+45  （1.2.0 = versionName，45 = versionCode/buildNumber）
```

## 后端部署（Docker）

以 `devops` agent 角色执行：

```bash
# 1. 确认 migration 已创建
ls backend/alembic/versions/ | tail -5

# 2. 拉取最新镜像
docker compose -f backend/docker-compose.prod.yml pull api

# 3. 运行 Alembic 迁移
docker compose -f backend/docker-compose.prod.yml run --rm api \
  alembic upgrade head

# 4. 滚动重启
docker compose -f backend/docker-compose.prod.yml up -d api

# 5. 健康检查
sleep 30
curl -sf https://${PROD_DOMAIN}/health \
  && echo "✅ 健康检查通过" \
  || { echo "❌ 健康检查失败"; \
       docker compose -f backend/docker-compose.prod.yml rollback; \
       exit 1; }

# 6. 记录部署
DEPLOY_DATE=$(date +%Y-%m-%d)
DEPLOY_VERSION=${version:-"latest"}
echo "| ${DEPLOY_DATE} | ${DEPLOY_VERSION} | <feature> | DEPLOYED |" \
  >> docs/ops/DEPLOY_PLAYBOOK.md
```

## Flutter AAB 构建

以 `devops` agent 角色执行：

```bash
cd frontend

# 1. 确认版本号
VERSION=$(grep "^version:" pubspec.yaml | awk '{print $2}')
echo "构建版本: ${VERSION}"

# 2. 最终测试
flutter analyze && flutter test

# 3. 确认 key.properties 存在（不入 git，CI 注入）
[ -f android/key.properties ] || { echo "❌ key.properties 不存在"; exit 1; }

# 4. 构建 AAB
flutter build appbundle --release \
  --build-name=$(echo $VERSION | cut -d+ -f1) \
  --build-number=$(echo $VERSION | cut -d+ -f2)

# 5. 验证产物
AAB="build/app/outputs/bundle/release/app-release.aab"
[ -f "$AAB" ] || { echo "❌ AAB 构建失败"; exit 1; }
echo "✅ AAB 大小: $(du -sh $AAB | cut -f1)"

# 6. 上传（Fastlane 或手动）
echo "上传至 Play Console：https://play.google.com/console"
# fastlane supply --aab $AAB --track internal  # 先到内部测试
```

## 发布后必须更新

```bash
# 后端
echo "| $(date +%Y-%m-%d) | <version> | <feature/scope> | DEPLOYED |" \
  >> docs/ops/DEPLOY_PLAYBOOK.md

# Flutter
echo "| $(date +%Y-%m-%d) | <versionName> | <buildNumber> | Play Console Internal |" \
  >> docs/ops/PLAY_STORE_GUIDE.md

git add docs/ops/
git commit -m "chore(ops): record release <version>"
git push
```

## Play Store 发布路径

1. 上传 AAB → 内部测试（直接到测试设备验证）
2. 确认无问题 → 封闭测试（邀请测试员）
3. 确认无问题 → 开放测试（可选）
4. 正式发布 → 分阶段推送（1% → 10% → 50% → 100%）

## 禁止
- 测试或 review 未通过时部署
- 硬编码 keystore 密码到命令行
- keystore 文件或 key.properties 入 git
- 跳过健康检查直接声明"部署成功"
- force push 任何分支
