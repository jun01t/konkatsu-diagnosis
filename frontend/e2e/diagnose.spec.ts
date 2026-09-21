import path from "node:path";
import { expect, test } from "@playwright/test";

const evidenceDir = path.join(__dirname, "evidence");

test.describe("婚活偏差値診断 E2E", () => {
  test("トップに設問が表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "婚活偏差値診断（AI）" })).toBeVisible();
    await expect(page.locator("fieldset.q")).toHaveCount(8);
    await expect(page.getByRole("button", { name: "結果を見る" })).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "01-top-questions.png"),
      fullPage: true,
    });
  });

  test("未回答で送信するとエラーになる", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "結果を見る" }).click();
    await expect(page.locator("p.error")).toHaveText("すべての設問に回答してください。");
    await page.screenshot({
      path: path.join(evidenceDir, "02-validation-error.png"),
      fullPage: true,
    });
  });

  test("全問いちばん上の選択でスコア70になり共有ページが開ける", async ({
    page,
    request,
  }) => {
    const questions = await request.get("/api/questions");
    expect(questions.ok()).toBeTruthy();
    const list = (await questions.json()) as { id: string; options: { value: string }[] }[];
    expect(list).toHaveLength(8);

    await page.goto("/");
    await expect(page.locator("fieldset.q")).toHaveCount(8);

    for (const q of list) {
      await page.locator(`input[name="${q.id}"][value="1"]`).check();
    }
    await page.getByRole("button", { name: "結果を見る" }).click();

    await expect(page.getByRole("heading", { name: "診断結果" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(".scoreline")).toContainText("70");
    await expect(page.locator(".headline")).toContainText("土台は良いので");
    await expect(page.locator(".summary")).toBeVisible();
    await expect(page.getByRole("heading", { name: "カテゴリ別の見立て" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "今週やること" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "初回メッセージの例" })).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "03-result-score-70.png"),
      fullPage: true,
    });

    const share = page.getByRole("link", { name: "Xで結果を共有" });
    await expect(share).toBeVisible();
    const href = await share.getAttribute("href");
    expect(href).toContain("twitter.com/intent/tweet");
    expect(href).toContain(encodeURIComponent("/share/"));

    const sharePathMatch = decodeURIComponent(href ?? "").match(/\/share\/[A-Za-z0-9_-]+/);
    expect(sharePathMatch).toBeTruthy();
    const sharePath = sharePathMatch![0];

    const shareRes = await page.goto(sharePath);
    expect(shareRes?.ok()).toBeTruthy();
    await expect(page.locator(".bigscore")).toHaveText("70");
    await expect(page.getByRole("link", { name: "診断をやってみる" })).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "04-share-page-70.png"),
      fullPage: true,
    });
  });

  test("API: 全問4はスコア40、全問1より低い", async ({ request }) => {
    const all1: Record<string, string> = {};
    const all4: Record<string, string> = {};
    for (let i = 1; i <= 8; i++) {
      all1[`q${i}`] = "1";
      all4[`q${i}`] = "4";
    }

    const r1 = await request.post("/api/diagnose", { data: { answers: all1 } });
    const r4 = await request.post("/api/diagnose", { data: { answers: all4 } });
    expect(r1.ok()).toBeTruthy();
    expect(r4.ok()).toBeTruthy();
    const j1 = await r1.json();
    const j4 = await r4.json();
    expect(j1.score).toBe(70);
    expect(j4.score).toBe(40);
    expect(j1.score).toBeGreaterThan(j4.score);
    expect(j1.sharePath).toMatch(/^\/share\//);
  });

  test("全問4の共有ページはスコア40", async ({ page, request }) => {
    const answers: Record<string, string> = {};
    for (let i = 1; i <= 8; i++) answers[`q${i}`] = "4";
    const res = await request.post("/api/diagnose", { data: { answers } });
    const json = await res.json();
    expect(json.score).toBe(40);
    await page.goto(json.sharePath);
    await expect(page.locator(".bigscore")).toHaveText("40");
    await page.screenshot({
      path: path.join(evidenceDir, "05-share-page-40.png"),
      fullPage: true,
    });
  });
});
