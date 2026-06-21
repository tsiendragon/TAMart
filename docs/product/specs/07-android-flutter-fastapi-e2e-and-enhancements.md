# 设计方案：e2e 测试能力 + 插件四项补全（Android Flutter + FastAPI）

> 配套 [`06-android-flutter-fastapi-plugin-design.md`](./06-android-flutter-fastapi-plugin-design.md)。
> 本文基于真实项目 [`finnotev2`](../../../../finnotev2) 的实际形态，补齐 `@tamart/android-flutter-fastapi` 插件在
> **e2e 测试**、**前端迁移**、**离线同步**、**i18n**、**CI/状态追踪** 上的缺口。
>
> 状态：Draft（待 Review，确认后进入实现）

---

## 一、背景与目标

### 1.1 参照系：finnotev2 的真实形态

| 维度 | 真实情况 |
|---|---|
| 前端 | Flutter ^3.6 + Riverpod(codegen) + GoRouter + **Drift(SQLite)** schema v22 |
| 后端 | FastAPI + SQLAlchemy 2.0 + **Alembic**(16 migrations) + MySQL + Redis |
| 核心复杂度 | **离线优先同步**：push/pull + tombstone + `sync_id` + `schema_version` + 冲突解决 |
| i18n | 三语 zh-CN / zh-TW / en-US，`.arb` + `AppLocalizations`，禁硬编码字符串 |
| 现有测试 | 后端 pytest 契约测试 + `test_sync_api_e2e.py`；前端 unit/widget/db 测试；CI `contract-tests.yml` |
| 缺口 | **UI 层 e2e**（无浏览器/无设备级全链路）、前端 Drift 迁移未纳入流程、同步无脚手架、插件无 i18n/CI/STATUS 约定 |

### 1.2 本设计的两块范围

- **A. e2e 测试 skill（分层混合）** —— 本文核心。
- **B. 插件四项补全** —— 前端 Drift 迁移流程、离线同步协议支持、i18n 强制、CI + STATUS 约定。

### 1.3 设计原则

1. **用对工具**：Flutter UI 不是 DOM，Playwright 不能当通用选择器用（§2.1）。
2. **测原生、非测代理**：APK 的最终保证来自原生路径，web 只是快速冒烟与可视化（§2.3）。
3. **可自愈**：e2e 发现问题 → 定位 → 修复 → 回归，形成闭环（§3.5）。
4. **与现有门控对齐**：复用 06 的 PRD→设计→DB→TASK→实现→测试→审查→发布 流水，不另起炉灶。

---

## 二、关键技术决策：为什么是"分层混合"

### 2.1 Flutter web + Playwright 的坑

现代 Flutter web 用 **CanvasKit / WASM** 渲染，整个 UI 画在单个 `<canvas>` 上，DOM 里**没有真实的 button/input/text 节点**。能产出语义 DOM 的旧 HTML renderer 已在 **Flutter 3.29 移除**。后果：

- Playwright 的 `getByRole` / `getByText` / CSS 选择器**抓不到 Flutter 控件**。
- 直接对 canvas 做坐标点击 → 极脆，分辨率/布局一变就废。

**可行解 —— 走 Flutter 语义树（semantics tree）**：
Flutter web 在开启无障碍时会生成 `<flt-semantics>` DOM 子树，带 `aria-label` / `role`，并支持 `Semantics(identifier: ...)` 输出**稳定的、与语言无关的测试 id**（这点与 i18n 补全天然契合 —— 用 identifier 而非可见文案定位）。

> **对 flutter-dev agent 的新约束**：关键交互控件必须挂 `Semantics(identifier: '<stable-test-id>')`（命名见 §3.2）。这是 e2e 可行的前提，纳入 lint/审查。

### 2.2 三层 e2e 金字塔

```
        ┌─────────────────────────────────────────────┐
  L3    │  原生 e2e（APK 真相层）                        │
        │  flutter integration_test  →  Android 模拟器   │
        │  按 Key/identifier 精确断言；测平台通道/原生DB   │
        └─────────────────────────────────────────────┘
        ┌─────────────────────────────────────────────┐
  L2    │  全链路冒烟 + 视觉（web 快速层）                │
        │  Flutter web  +  Playwright(语义树)            │
        │  agent 驱动流程/截图视觉校验/查网络/查DB         │
        └─────────────────────────────────────────────┘
        ┌─────────────────────────────────────────────┐
  L1    │  后端全栈 e2e（与客户端无关）                   │
        │  pytest 起真实 FastAPI + 测试库，跑端到端流程    │
        │  含同步 push/pull/冲突（已有 test_sync_api_e2e）│
        └─────────────────────────────────────────────┘
```

- **L1** 已基本具备，本设计将其纳入 e2e skill 统一编排。
- **L2** 是用户设想的"webui + Playwright + agent 看截图测交互测 DB"——价值在**快速反馈 + 可视化 + agent 自由探索路径**。
- **L3** 是"测 APK"的**唯一可信来源**，覆盖原生 SQLite(drift)、secure storage、path_provider、平台通道。

### 2.3 "web 通过 ≠ apk 通过"与同步策略

web 与原生在以下点行为不同，web 绿不代表 apk 绿：

| 能力 | web | 原生 APK |
|---|---|---|
| 本地 DB | wasm sqlite（IndexedDB 持久化） | drift_sqflite 原生 SQLite 文件 |
| 安全存储 | 受限/降级实现 | flutter_secure_storage 原生 keystore |
| 文件路径 | 无 path_provider | 真实文件系统 |
| 平台通道 | 多数不可用 | 原生插件可用 |

因此**"同步到 apk"不是自动的**。重定义为：

> **Promote 流程**：L2 在 web 上验证通过的用户流程 → 转写/复用为 L3 的 `integration_test` 用例 → 在 Android 模拟器上回归。L2 的 spec（步骤序列 + identifier + 断言）作为 L3 用例的**单一来源**，由 e2e skill 维护一份共享的 `flow spec`，两层共用，避免双写漂移。

---

## 三、e2e 测试 skill 设计

### 3.1 skill 形态

新增插件 skill：**`e2e`**（命令 `/e2e`）+ 配套 agent **`e2e-tester`**。

| 子命令 | 作用 |
|---|---|
| `/e2e web <feature>` | 起后端测试栈 + 构建 Flutter web + Playwright 驱动 L2 流程，截图 + DB 断言，产出报告 |
| `/e2e native <feature>` | 起后端 + 启动模拟器 + 跑 L3 `integration_test`，精确断言 |
| `/e2e backend <feature>` | 仅 L1 后端全栈 e2e |
| `/e2e full <feature>` | L1→L2→L3 全跑，生成合并报告 + promote 检查 |
| `/e2e promote <feature>` | 把通过的 L2 flow spec 物化为 L3 用例（web→apk 同步动作） |

### 3.2 L2：Web e2e harness（Playwright + 语义树）

**测试入口（test build）**：新增 `frontend/lib/main_e2e.dart`，强制开启语义并指向测试后端：

```dart
// main_e2e.dart —— 仅用于 e2e web 构建，不进生产
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SemanticsBinding.instance.ensureSemantics();   // 强制生成语义 DOM
  // baseUrl 指向 e2e 测试后端（见 §3.4）
  runApp(const ProviderScope(overrides: [/* apiBaseUrl→test */], child: App()));
}
```

构建：`flutter build web --target=lib/main_e2e.dart --profile`，本地 `serve`。

**identifier 命名约定**（flutter-dev 必须遵守，reviewer 校验）：
```
<feature>-<element>-<action?>   例：txn-save-btn / account-list-item / login-email-field
```
Playwright 通过 `flt-semantics-identifier` 定位（语言无关，规避 i18n 文案漂移）：
```ts
await page.locator('[id="txn-save-btn"]').click();   // 经语义树映射
```

**e2e-tester agent 能力**：
1. 按 `flows/<feature>.flow.yaml`（共享 flow spec，§3.3 复用）逐步驱动；
2. 每步 `screenshot` → 作为**视觉回归基线**（首次建基线，后续 diff）；
3. 读 Playwright network 事件断言请求/响应（code/字段）；
4. 查 DB 断言落库（§3.4）；
5. 失败时抓 console + 截图 + 当前语义树快照，写入失败 fixture。

> Playwright MCP（环境已挂 `mcp__plugin_playwright_playwright__*`）可直接用于 agent 交互式驱动与截图；脚本化回归用 `@playwright/test`。

### 3.3 L3：原生 e2e harness（integration_test + 模拟器）

- 用例位置：`frontend/integration_test/<feature>_e2e_test.dart`。
- 复用同一 `flows/<feature>.flow.yaml` 描述（步骤/identifier/断言），通过一个轻量 runner 把 flow 映射为 `WidgetTester` 操作（`find.bySemanticsIdentifier` / `find.byKey`）。
- 运行：`flutter test integration_test/<feature>_e2e_test.dart -d <emulator>` 或 `flutter drive`。
- 断言原生侧：drift DB 实际行、secure storage、文件产物。

**flow spec（两层单一来源）示例**：
```yaml
# flows/transaction-create.flow.yaml
feature: transaction
steps:
  - tap: login-email-field
  - type: { id: login-email-field, value: "$E2E_USER" }
  - tap: login-submit-btn
  - expect_screen: home
  - tap: txn-add-btn
  - type: { id: txn-amount-field, value: "12.50" }
  - tap: txn-save-btn
db_assert:
  - table: transactions
    where: { amount_cents: 1250 }
    expect: exists
```

### 3.4 数据库断言层（L1/L2/L3 通用）

- **后端 DB**：起一次性测试库（SQLite `:memory:` 或 docker MySQL），e2e 跑完用只读连接断言行/约束/`sync_id`/tombstone 状态。复用 finnotev2 `conftest.py` 的 fixture 风格。
- **前端原生 DB（L3）**：用 drift 的 `AppDatabase.forTesting` 或导出 DB 文件后查询。
- 提供 `assert-db` 辅助脚本：输入 `table/where/expect`，输出 PASS/FAIL，供三层共用。

### 3.5 自愈循环（发现 → 修复 → 回归）

e2e-tester agent 的闭环（受 06 门控约束，不绕过 PRD/设计）：
```
跑 flow → 失败
  → 归类：UI(identifier缺失/渲染) | 逻辑(provider/service) | 契约(API字段) | DB(约束/迁移)
  → 定位最小范围（≤3 文件，符合 TASK 粒度）
  → 修复 + 补/改对应层单测（回归护栏）
  → 重跑该 flow + 相关层测试
  → 仍失败 N 次 → 升级为人工，产出失败 fixture + 诊断报告
```
> 修复严守边界：涉及 schema/同步协议/API 字段变更时，**不得静默改**，必须回到 db-design / architect 门控（§五、§六真实项目里这些是冻结资产）。

### 3.6 产物与目录结构（落到目标项目）

```
frontend/
  lib/main_e2e.dart                 # e2e web 入口
  integration_test/<f>_e2e_test.dart
e2e/
  flows/<feature>.flow.yaml         # 两层共享 flow spec
  playwright/<feature>.spec.ts      # L2 回归脚本
  baselines/<feature>/*.png         # 视觉基线
  reports/E2E_REPORT_<f>_<date>.md
  fixtures/failures/                # 失败快照/语义树/console
backend/
  tests/e2e/test_<f>_e2e.py         # L1 全栈
```

### 3.7 对插件的新增/改动文件

| 文件 | 动作 |
|---|---|
| `commands/e2e.md` | **新增** —— `/e2e` 子命令分发 |
| `agents/e2e-tester.md` | **新增** —— L1/L2/L3 编排 + 自愈循环 |
| `scripts/e2e-web-run.sh` | **新增** —— 构建 web + 起后端 + Playwright |
| `scripts/e2e-native-run.sh` | **新增** —— 起模拟器 + integration_test |
| `scripts/e2e-backend-run.sh` | **新增** —— L1 全栈 |
| `scripts/assert-db.sh` | **新增** —— DB 断言辅助 |
| `scripts/e2e-promote.sh` | **新增** —— L2 flow → L3 用例物化 |
| `templates/FLOW_SPEC_TEMPLATE.yaml` | **新增** —— flow spec 模板 |
| `templates/E2E_REPORT_TEMPLATE.md` | **新增** —— e2e 报告模板 |
| `agents/flutter-dev.md` | **改** —— 加 `Semantics(identifier:)` 约定 |
| `agents/reviewer.md` | **改** —— 校验关键控件 identifier 覆盖 |
| `tam.yaml` | **改** —— 注册新命令/agent/脚本/模板 |

---

## 四、补全 1：前端 Drift 迁移流程

**问题**：插件 `db-design`/architect 只懂后端 Alembic；finnotev2 一次 schema 变更要**同一 commit 改 4 处**：`DATABASE.md` + Drift 迁移(`schemaVersion`+`MigrationStrategy`) + Alembic 迁移 + 测试。

**改动**：
- `agents/architect.md` + `commands/db-design.md`：DB 设计产出**双侧迁移清单**（后端 Alembic op + 前端 Drift step），并要求 `schemaVersion` bump。
- `templates/DATABASE_TEMPLATE.md`：新增「前端 Drift 迁移」段（表/列 → Drift table 类 + migration step）。
- `scripts/post-write-validate.sh`：检测 `frontend/lib/**/tables/**` 或 drift 表变更 → 标记 `drift-migration.stale`（对齐现有 `migration.stale`）。
- `agents/agents-rules.md`：写入「schema 变更原子提交 4 件套」铁律。
- e2e L3 增加 **Drift 迁移测试**（旧版本 → 升级 → 数据保全），对齐 finnotev2 `simple_database_test.dart` 风格。

---

## 五、补全 2：离线同步协议支持

**问题**：同步是 finnotev2 的核心复杂度，插件零覆盖。

**改动**：
- `templates/SYNC_DESIGN_TEMPLATE.md`：**新增** —— push/pull 契约、`sync_id`/`schema_version`/tombstone 语义、冲突解决策略、`object_type` 枚举。
- `agents/architect.md`：涉及可同步实体的设计必须填同步字段（`sync_id`、`updated_at`、`deleted`/tombstone、版本）。
- `agents/fastapi-dev.md` + `agents/flutter-dev.md`：实现同步端点/客户端代理时遵循协议模板。
- e2e：新增 **同步 e2e flow**（设备A写 → push → 设备B pull → 改同一条 → 冲突 → resolve），L1 复用 finnotev2 `test_sync_api_e2e.py` 模式，L2/L3 验证客户端 UI 冲突解决。
- `rules/project-rules.md`：同步协议为**冻结契约**，变更需走设计门控。

---

## 六、补全 3：i18n 强制

**问题**：flutter-dev 无 i18n 规则，会写死字符串；真实项目三语且禁硬编码。

**改动**：
- `agents/flutter-dev.md`：UI 文案一律走 `AppLocalizations`，新增文案同步更新 `.arb`（zh-CN/zh-TW/en-US 占位）。
- `scripts/post-write-validate.sh`：检测 `frontend/lib/**` 中 Widget 内**裸字符串字面量**（`Text('中文'/'English')`）→ 警告/拦截（保留 identifier、Key、日志等白名单）。
- `rules/project-rules.md` + `templates/FEATURE_TEMPLATE.md`：设计阶段列出文案 key 清单。
- 与 §3.2 协同：e2e 定位用 `identifier`（语言无关），文案校验用 `AppLocalizations` key，两者解耦。

---

## 七、补全 4：CI + STATUS 约定

**问题**：插件不发 CI 模板，也无状态/版本追踪约定；finnotev2 有 `contract-tests.yml` + `STATUS.md` + `VERSION` + 阶段化 `IMPLEMENTATION_PLAN.md`。

**改动**：
- `templates/ci/`：**新增** GitHub Actions 模板 —— 后端 pytest+契约、前端 `flutter analyze`+test、（可选）L1 e2e；PR 触发。
- `templates/STATUS_TEMPLATE.md` + `templates/IMPLEMENTATION_PLAN_TEMPLATE.md`：**新增** 阶段化进度追踪。
- `commands/gen-docs.md` / 新 `commands/status.md`：feature 完成时同步更新 `STATUS.md` + bump `VERSION`（对齐 finnotev2 AGENTS.md「STATUS 与 VERSION 同提交」）。
- `agents/devops.md`：发布前校验 CI 绿 + STATUS/VERSION 已更新。

---

## 八、对现有插件文件的改动清单（汇总）

| 文件 | 新增/改 | 涉及章节 |
|---|---|---|
| `commands/e2e.md` | 新增 | §3 |
| `commands/status.md` | 新增 | §7 |
| `agents/e2e-tester.md` | 新增 | §3 |
| `agents/flutter-dev.md` | 改 | §3.2 §5 §6 |
| `agents/fastapi-dev.md` | 改 | §5 |
| `agents/architect.md` | 改 | §4 §5 |
| `agents/reviewer.md` | 改 | §3.2 |
| `agents/devops.md` | 改 | §7 |
| `agents/agents-rules.md` | 改 | §4 |
| `rules/project-rules.md` | 改 | §5 §6 |
| `scripts/e2e-*.sh`, `assert-db.sh` | 新增 | §3 |
| `scripts/post-write-validate.sh` | 改 | §4 §6 |
| `templates/FLOW_SPEC_TEMPLATE.yaml` | 新增 | §3 |
| `templates/E2E_REPORT_TEMPLATE.md` | 新增 | §3 |
| `templates/SYNC_DESIGN_TEMPLATE.md` | 新增 | §5 |
| `templates/DATABASE_TEMPLATE.md` | 改 | §4 |
| `templates/FEATURE_TEMPLATE.md` | 改 | §6 |
| `templates/STATUS_TEMPLATE.md`, `IMPLEMENTATION_PLAN_TEMPLATE.md` | 新增 | §7 |
| `templates/ci/*` | 新增 | §7 |
| `tam.yaml` | 改 | 全部（注册） |
| `docs/.../06-...-design.md` 或本文 | 互链 | — |

---

## 九、里程碑与交付顺序

1. **M-A（地基）**：§3.2 identifier 约定 + §6 i18n 规则 + flow spec 模板。（两者是 e2e 可行前提）
2. **M-B（e2e 三层）**：L1 backend → L2 web+Playwright → L3 integration_test → `/e2e` 命令 + e2e-tester agent + 自愈循环。
3. **M-C（数据/同步）**：§4 前端 Drift 迁移流程 + §5 同步协议模板与 e2e flow。
4. **M-D（工程化）**：§7 CI 模板 + STATUS/VERSION 约定。
5. **M-E（验证）**：在 finnotev2 真实跑通一条端到端 flow（如「登录→建账户→记一笔→对账 DB」），跨 L1/L2/L3。

---

## 十、决策记录（已确认）

| # | 议题 | 决策 |
|---|---|---|
| 1 | 落点 | **先在插件内出脚手架**（命令/agent/脚本/模板齐备），finnotev2 真跑通（M-E）放到脚手架完成后。 |
| 2 | Playwright 形态 | **两者都要**：交互探索用 Playwright MCP（agent 即时驱动/截图/查网络），回归用 `@playwright/test`（脚本化、入 CI）。 |
| 3 | L3 进 CI | **L3 进 CI**：CI 接 `reactivecircus/android-emulator-runner` 跑 `integration_test`（接受耗时），与 L1/L2 一同作为 PR 门禁。 |
| 4 | 视觉基线 | **基线 PNG 入库**（`e2e/baselines/`）。默认 diff 阈值：`maxDiffPixelRatio: 0.01` + `threshold: 0.2`（抗锯齿容差），按 feature 可覆盖。基线更新需显式 `--update-snapshots` 并在 PR 说明。 |
| 5 | DB 引擎口径 | 插件 DB 约定从 PostgreSQL **统一改为 MySQL 8 / InnoDB**（对齐 finnotev2）：`BIGINT AUTO_INCREMENT`、`DATETIME`(存 UTC)、`utf8mb4_0900_ai_ci`、禁原生 `ENUM`、外键索引由 InnoDB 自动建。前端 Drift(SQLite) 不变。改动覆盖 DATABASE_TEMPLATE / db-design / architect / SYNC_DESIGN / DEPLOY_PLAYBOOK。 |
