---
name: gen-docs
description: 从 FastAPI 应用导出 openapi.json，使用 redoc 渲染 HTML，清除 openapi.stale 标记
---

## 用法

```
/gen-docs
```

运行后会更新：
- `docs/api/openapi.json`（API 字段快照，Flutter client 生成依据）
- `docs/api/index.html`（给人阅读的 Redoc API 文档）

## 执行步骤

**步骤 1 — 导出 openapi.json**

```bash
cd backend

# 方法 A：直接从 FastAPI app 对象导出（无需启动服务）
python3 -c "
import json
import sys
sys.path.insert(0, '.')
from app.main import app

spec = app.openapi()
with open('../docs/api/openapi.json', 'w', encoding='utf-8') as f:
    json.dump(spec, f, indent=2, ensure_ascii=False)
print('openapi.json exported successfully')
print(f'Endpoints: {len(spec[\"paths\"])}')
"
```

**步骤 2 — 渲染 HTML**

```bash
# 使用 @redocly/cli（推荐）
npx @redocly/cli build-docs docs/api/openapi.json \
  --output docs/api/index.html \
  --title "API Reference"

# 备选：redoc-cli
# npx redoc-cli bundle docs/api/openapi.json \
#   -o docs/api/index.html \
#   --title "API Reference"
```

**步骤 3 — 清除 stale 标记**

```bash
rm -f .claude/state/openapi.stale
echo "openapi.stale cleared"
```

**步骤 4 — 输出摘要**

```
docs/api/openapi.json 已更新
  端点总数: N
  最后修改: YYYY-MM-DD HH:MM

docs/api/index.html 已渲染（可浏览器打开查看）

openapi.stale 已清除 ✅

下一步：如需更新 Flutter Dart client，运行 /gen-client
```

## 何时运行

以下操作后应运行 `/gen-docs`：
- 新增/修改 Pydantic schema（`backend/app/schemas/`）
- 新增/修改 FastAPI router（`backend/app/routers/`）
- 收到 hook 警告 `openapi.stale`

## 集成到 Makefile

项目应包含：
```makefile
gen-docs:
	cd backend && python3 -c "import json; from app.main import app; open('../docs/api/openapi.json','w').write(json.dumps(app.openapi(), indent=2, ensure_ascii=False))"
	npx @redocly/cli build-docs docs/api/openapi.json -o docs/api/index.html --title "API Reference"
	rm -f .claude/state/openapi.stale
	@echo "✅ openapi.json + index.html updated"
```
