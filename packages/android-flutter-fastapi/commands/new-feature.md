---
name: new-feature
description: 开启新功能开发流程：接收需求描述，调用 pm agent 生成 PRD，更新 FUNCTIONAL_LIST，等待用户确认
---

## 用法

```
/new-feature <功能名称> [需求描述]
```

示例：
```
/new-feature user-profile 用户可以查看和编辑个人资料，包括头像、昵称、手机号
```

## 执行步骤

以 `pm` agent 身份运行，按以下顺序执行：

**步骤 1 — 读取上下文**
- 读 `docs/product/PRD.md`（了解全局范围和版本规划）
- 读 `docs/product/FUNCTIONAL_LIST.md`（获取最新功能编号）

**步骤 2 — 生成 PRD**
- 按 `templates/PRD_TEMPLATE.md` 创建 `docs/product/PRD_<feature>.md`
- 功能名从参数 `<功能名称>` 获取，需求描述来自 `[需求描述]` 参数
- 如未提供需求描述，向用户询问：
  - 核心用户场景（who/what/why）
  - 明确的边界（不做什么）
  - 验收成功标准

**步骤 3 — 更新清单**
- 追加新条目到 `docs/product/FUNCTIONAL_LIST.md`：`F-XXX | <feature-name> | <优先级> | TODO`
- 如涉及用户流程变化，更新 `docs/product/UX_FLOW.md`

**步骤 4 — 输出 Handoff**
```
## PM Handoff → Architect
功能: <feature-name>
功能 ID: F-<XXX>
PRD: docs/product/PRD_<feature>.md
优先级: P? （请确认）
核心 AC: [列出全部 AC]
关键约束: [最重要的业务规则]

---
PRD 已创建，请 Review 后输入 /tech-design <feature> 进入技术设计阶段
或输入"修改 PRD：[修改意见]"要求调整
```

## 门控
- 必须等待用户确认 PRD 后，才能进入 `/tech-design` 或 `/db-design`
- PRD 文件不存在时，禁止运行 `/implement`
