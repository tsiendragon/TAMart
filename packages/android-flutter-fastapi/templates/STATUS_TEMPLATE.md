# STATUS.md — 开发进度追踪

> 与功能改动**同提交**更新；与 `VERSION` 保持一致（AGENTS.md）。
> 这是项目当前状态的唯一真源：在做什么、已完成什么、下一步。

**当前版本：** vX.Y.Z（见 VERSION）
**当前阶段：** <阶段名 / IMPLEMENTATION_PLAN 中的 phase id>
**更新日期：** YYYY-MM-DD

---

## 进行中

| Feature | 阶段 | 负责 agent | 门控状态 | 备注 |
|---------|------|-----------|---------|------|
| <feature> | 实现 T-03/T-08 | flutter-dev | DB✅ / 测试⏳ | |

## 已完成（最近）

| 日期 | Feature | 版本 | e2e | 备注 |
|------|---------|------|-----|------|
| YYYY-MM-DD | <feature> | vX.Y.Z | L1✅ L2✅ L3✅ | |

## 下一步

- [ ] <下一个 feature / 任务>

## 冻结 / 已删除

| 项 | 状态 | 阶段 | 说明 |
|----|------|------|------|
| <模块> | 冻结 | <phase> | 不可在未重新设计前复活 |

## 门控速查（每个 feature 推进前对照）

- [ ] PRD 确认
- [ ] Tech Design 确认
- [ ] DB 设计确认（Schema 冻结，含前端 Drift 映射）
- [ ] TASK_LIST 确认
- [ ] QA PASS + Reviewer 无 BLOCKER
- [ ] e2e（按风险：L1 必跑 / 关键路径 L2+L3）
- [ ] STATUS.md + VERSION 已更新
