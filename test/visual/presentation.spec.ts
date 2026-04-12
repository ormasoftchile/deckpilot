/**
 * Visual regression tests for the web preview (http://localhost:5175).
 *
 * Run:  npx playwright test
 * Update snapshots:  npx playwright test --update-snapshots
 *
 * The tests load decks from the examples/ directory and assert that:
 * - Fragment steps reveal correctly (step-by-step visibility)
 * - Link styles match design (no browser-default underline at rest)
 * - Table and list presentation styles are consistent
 */

import { test, expect, Page } from '@playwright/test';

// ─── helpers ──────────────────────────────────────────────────────────────────

async function loadDeck(page: Page, deckName: string): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('#deck-list');
  const item = page.locator('.deck-picker-item', { hasText: deckName });
  await item.first().click();
  // Wait for slide content to render
  await page.waitForSelector('#slide-content h1, #slide-content h2', { timeout: 5000 });
}

async function nextFragment(page: Page): Promise<void> {
  await page.keyboard.press('ArrowRight');
  // Small wait for CSS transition
  await page.waitForTimeout(80);
}

/** Press right until the slide indicator shows the target slide number */
async function goToSlide(page: Page, slideNum: number): Promise<void> {
  for (let i = 0; i < 300; i++) {
    const indicator = await page.locator('#slide-indicator').textContent();
    const current = parseInt(indicator?.split('/')[0].trim() ?? '0');
    if (current >= slideNum) { break; }
    await nextFragment(page);
  }
}

// ─── Fragment system ──────────────────────────────────────────────────────────

test.describe('Fragment system', () => {
  test('tight list — reveals one bullet at a time', async ({ page }) => {
    await loadDeck(page, 'list-fragment-test');
    const slide = page.locator('#slide-content');

    // Step 0: only h1 visible, no bullets revealed
    await expect(slide).toHaveScreenshot('fragment-tight-list-step0.png');

    // Step 1: first bullet visible
    await nextFragment(page);
    await expect(slide).toHaveScreenshot('fragment-tight-list-step1.png');

    // Step 2: second bullet visible
    await nextFragment(page);
    await expect(slide).toHaveScreenshot('fragment-tight-list-step2.png');

    // Step 3: all bullets visible
    await nextFragment(page);
    await expect(slide).toHaveScreenshot('fragment-tight-list-step3.png');
  });

  test('table — appears as a single fragment step', async ({ page }) => {
    await loadDeck(page, 'table-fragment-bug');
    const slide = page.locator('#slide-content');

    await expect(slide).toHaveScreenshot('fragment-table-step0.png');

    // Go to slide 2 (past all fragments on slide 1)
    await goToSlide(page, 2);
    await expect(slide).toHaveScreenshot('fragment-table-slide2-step0.png');

    // Reveal the table
    await nextFragment(page);
    await expect(slide).toHaveScreenshot('fragment-table-revealed.png');
  });
});

// ─── Link styles ─────────────────────────────────────────────────────────────

test.describe('Link styles', () => {
  test('regular links — no browser-default underline at rest', async ({ page }) => {
    await loadDeck(page, 'showcase');

    // GitHub links are on slide 35 — jump there directly
    await goToSlide(page, 35);

    // Reveal all fragments on this slide
    for (let i = 0; i < 10; i++) {
      const hasLink = await page.locator('#slide-content a[href^="https://github.com"]').count();
      if (hasLink > 0) { break; }
      await nextFragment(page);
    }

    const link = page.locator('#slide-content a[href^="https://github.com"]').first();
    await expect(link).toBeVisible();

    const textDecoration = await link.evaluate(el =>
      window.getComputedStyle(el).textDecorationLine
    );
    expect(textDecoration).toBe('none');

    await expect(page.locator('#slide-content')).toHaveScreenshot('link-styles-rest.png');
  });
});

// ─── Table presentation styles ────────────────────────────────────────────────

test.describe('Table presentation styles', () => {
  test('table renders with styled borders and header', async ({ page }) => {
    await loadDeck(page, 'table-fragment-bug');

    // Go to slide 2 which has the Comparison Table (past all fragments on slide 1)
    await goToSlide(page, 2);

    // Reveal the table fragment
    await nextFragment(page);

    const table = page.locator('#slide-content table').first();
    await expect(table).toBeVisible();

    const headerBg = await table.locator('th').first().evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    // Header should have a non-transparent background (styled)
    expect(headerBg).not.toBe('rgba(0, 0, 0, 0)');

    await expect(page.locator('#slide-content')).toHaveScreenshot('table-styles.png');
  });
});
