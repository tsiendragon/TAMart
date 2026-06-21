// ============================================================================
// PLAYWRIGHT SPEC — L2 web e2e 回归脚本
// 安装位置：<project>/e2e/playwright/<feature>.spec.ts
//
// 注意：Flutter web 渲染到 <canvas>，DOM 里没有真实控件。
// 只能通过 Flutter 的【语义树】定位 —— main_e2e.dart 已 ensureSemantics()，
// 控件需挂 Semantics(identifier: '<id>')，在 DOM 中表现为 <flt-semantics id="<id>">。
// 定位一律用 identifier（语言无关），禁止依赖可见文案或坐标点击。
// ============================================================================

import { test, expect, Page } from '@playwright/test';

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:8080';
// 截图名用 [FEATURE, '<name>.png'] 数组形式 → 基线落到 e2e/baselines/<feature>/<name>.png
// （阈值在 playwright.config.ts 的 expect.toHaveScreenshot 全局设置）
const FEATURE = '<feature>';

// 语义节点定位辅助：identifier → <flt-semantics id="...">
function byId(page: Page, id: string) {
  return page.locator(`flt-semantics[id="${id}"], [flt-semantics-identifier="${id}"]`);
}

test.describe('<feature> e2e', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(WEB_URL);
    // 等 Flutter 引擎挂载语义树（首帧后 <flt-semantics-host> 出现）
    await page.waitForSelector('flt-semantics-host', { timeout: 30_000 });
  });

  test('创建一笔交易并核对 UI/网络/视觉', async ({ page }) => {
    // ── 登录 ──
    await byId(page, 'login-email-field').click();
    await page.keyboard.type(process.env.E2E_USER ?? 'e2e@example.com');
    await byId(page, 'login-submit-btn').click();
    await expect(byId(page, 'home')).toBeVisible();

    // 视觉基线（入库于 e2e/baselines/<feature>/after-login.png）
    await expect(page).toHaveScreenshot([FEATURE, 'after-login.png']);

    // ── 新建交易（同时断言网络请求）──
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/v1/transactions') && r.request().method() === 'POST'),
      (async () => {
        await byId(page, 'txn-add-btn').click();
        await byId(page, 'txn-amount-field').click();
        await page.keyboard.type('12.50');
        await byId(page, 'txn-save-btn').click();
      })(),
    ]);
    expect(resp.status()).toBe(200);
    expect((await resp.json()).code).toBe(0);

    await expect(byId(page, 'txn-list-item-amount')).toContainText('12.50');
    await expect(page).toHaveScreenshot([FEATURE, 'after-create-txn.png']);

    // ── DB 断言（在测试外用 scripts/assert-db.sh，或经后端只读接口）──
    // bash scripts/assert-db.sh --table transactions --where '{"amount_cents":1250}' --expect exists
  });
});
