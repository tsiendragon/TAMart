#!/usr/bin/env bash
# session-start-rules.sh — SessionStart hook.
# Plugins cannot auto-inject a CLAUDE.md; a SessionStart hook is the supported way
# to add always-on context. This one SELF-GATES: it only emits the workflow rules
# when the current repo looks like a Flutter+FastAPI project, so unrelated repos
# stay clean even though the plugin is enabled globally (user scope).
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"

# Heuristic for a Flutter frontend + FastAPI backend monorepo.
if [ -f "$ROOT/frontend/pubspec.yaml" ] && [ -d "$ROOT/backend/app" ]; then
  cat <<EOF
[@tamart/android-flutter-fastapi 已激活] 本仓库为 Flutter + FastAPI 全栈项目，请遵循插件工作流：
- 流程门控：文档优先 → DB 设计(含前端 Drift 双侧迁移) → TASK_LIST → 实现 → 测试(分层 e2e L1/L2/L3) → 审查 → 发布
- 硬规则：schema 变更 4 件套同提交；同步协议为冻结契约；关键控件挂 Semantics(identifier:)；文案走 AppLocalizations；API code-first(Pydantic→openapi.json)
- 命令：/new-feature /db-design /plan-feature /implement /test-feature /e2e /review /gen-docs /status /release
- 完整规则按需读取：${CLAUDE_PLUGIN_ROOT}/rules/project-rules.md 与 ${CLAUDE_PLUGIN_ROOT}/rules/agents-rules.md
EOF
fi
exit 0
