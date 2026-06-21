---
name: status
description: 更新/查看开发进度追踪（STATUS.md），与 VERSION 对齐；feature 完成时同步登记 e2e 结果与门控状态
---

## 用法

```
/status                      # 查看当前 STATUS.md 摘要
/status update <feature>     # feature 推进后更新 STATUS.md（+ 按需 bump VERSION）
```

## 执行步骤

**查看（无参数）**
- 读 `docs/STATUS.md`，输出：当前版本 / 阶段 / 进行中 / 下一步 / 未通过的门控

**更新（update <feature>）**
1. 读 `docs/STATUS.md`（不存在则用 `templates/STATUS_TEMPLATE.md` 创建）
2. 更新「进行中 / 已完成 / 下一步」三段，登记该 feature 的：
   - 门控状态（PRD/Design/DB/TASK/QA/Review）
   - e2e 结果（L1/L2/L3 各自 ✅/❌/跳过）
3. 若对外可见版本变化 → 同步 bump `VERSION`（SemVer）
4. **与功能改动同提交**：
   ```bash
   git add docs/STATUS.md VERSION
   git commit -m "chore(status): <feature> 推进至 <阶段>"
   ```

## 约定（强制）
- STATUS.md 与 VERSION **同提交**更新（AGENTS.md）
- 完成态的 feature 必须登记 e2e 结果；关键路径未跑 L3 不得标"完成"
- 冻结/删除的模块进「冻结 / 已删除」表，注明阶段，未重新设计不得复活
