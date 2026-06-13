# Git Workflow — Branch 管理和并行开发

## Branch 策略（4 层）

```
main          # 生产环境，只接受来自 release/* 的 PR，打 tag
  └── develop       # 集成分支，所有功能合入点，CI 触发
        └── feature/<name>   # 单功能开发（Worktree 并行）
        └── release/<version>  # 发布分支（从 develop 切出）
```

### 各分支规则

| 分支 | 允许直接 push | 允许合并来源 | 用途 |
|------|-------------|------------|------|
| `main` | ❌（只接受 PR） | `release/*` only | 生产部署触发点 |
| `develop` | ✅（通过 PR） | `feature/*`, `release/*` | 集成测试基准 |
| `feature/<name>` | ✅ | — | 单功能开发 |
| `release/<version>` | ✅ | — | 发布准备、hotfix |

## 单功能开发流程

```bash
# 1. 从 develop 切出 feature 分支
git checkout develop && git pull
git checkout -b feature/<feature-name>

# 2. 开发（单任务节奏，每任务一 commit）
# 每个 commit: git commit -m "feat(scope): T-XX 描述"

# 3. 推送
git push -u origin feature/<feature-name>

# 4. 发 PR 到 develop
# gh pr create --base develop --title "feat: <feature-name>"

# 5. PR 合并后删除 feature 分支
git branch -d feature/<feature-name>
git push origin --delete feature/<feature-name>
```

## 并行开发（Worktree）

当多个功能需要**同时开发**时，使用 Git Worktree 避免频繁切换分支：

```bash
# 准备阶段（在 develop 分支完成 Tech Design + DB Design 后）
git checkout develop

# 创建 feature A 的 worktree
git worktree add ../worktrees/feature-user-profile \
  -b feature/user-profile origin/develop

# 创建 feature B 的 worktree
git worktree add ../worktrees/feature-notifications \
  -b feature/notifications origin/develop

# 在各自 worktree 中独立开发
cd ../worktrees/feature-user-profile
# ... 开发 user-profile ...

cd ../worktrees/feature-notifications
# ... 开发 notifications ...

# 查看所有 worktree
git worktree list

# 功能完成后删除 worktree
git worktree remove ../worktrees/feature-user-profile
```

### Worktree 规则

1. **设计文档优先**：创建 Worktree **之前**，Tech Design + DB Design 必须在 develop 分支完成并确认
2. **设计文档只读**：feature Worktree 分支不能修改 `docs/design/DATABASE.md`、`docs/design/ARCHITECTURE.md`、`docs/design/BACKEND_API.md`（hook 会阻断）
3. **定期 rebase**：每天从 develop rebase 一次，保持同步
4. **独立 state 目录**：每个 Worktree 有独立的 `.claude/state/` 目录

## Commit Message 格式

格式：`type(scope): description`

| Type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 仅文档 |
| `test` | 测试代码 |
| `chore` | 构建/依赖/配置 |
| `refactor` | 重构（不改变功能） |
| `style` | 格式（不改变逻辑） |
| `ci` | CI/CD 配置 |
| `perf` | 性能优化 |

示例：
```
feat(auth): T-06 add JWT refresh token endpoint
fix(user-profile): T-12 handle empty avatar gracefully
docs(database): add user_profiles table design
test(auth): add integration tests for token refresh
chore(ops): record v1.2.0 deployment 2026-06-14
```

## Release 流程

```bash
# 1. 从 develop 切出 release 分支
git checkout develop && git pull
git checkout -b release/v1.2.0

# 2. 更新版本号
# backend/VERSION: 1.2.0
# frontend/pubspec.yaml: version: 1.2.0+45

# 3. 最终测试（/test-feature all）

# 4. PR → main
# gh pr create --base main --title "release: v1.2.0"

# 5. 合并后打 tag
git checkout main && git pull
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0

# 6. 反向合并 release → develop（保持同步）
git checkout develop && git merge release/v1.2.0
git push
```
