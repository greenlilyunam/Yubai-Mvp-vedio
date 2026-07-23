import { chromium } from "playwright-core";
import path from "node:path";

const root = "C:/Users/18882/Documents/Codex/2026-07-17/w-x/work";
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu-sandbox"],
});

const page = await browser.newPage({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 1 });
const shot = (name) => page.screenshot({ path: path.join(root, `qa-${name}.png`), fullPage: true });

await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "开始感知" }).click();
await page.getByRole("button", { name: "让 AI 先理解我" }).click();
await page.waitForSelector("text=状态协商", { timeout: 5000 });
await page.getByRole("button", { name: "我想再安静一些" }).click();
await page.getByRole("button", { name: "这个理解可以继续" }).click();
await page.getByRole("button", { name: "准备好，一起出发" }).click();
await page.getByRole("button", { name: "此刻感觉怎么样？" }).click();
await page.getByRole("button", { name: /这里太吵/ }).click();
await page.waitForSelector("text=动态调整");
await shot("adjustment");
await page.getByRole("button", { name: "接受这次调整" }).click();
await page.waitForSelector("text=路线已避开嘈杂区域");
await page.getByRole("button", { name: "完成本次感知" }).click();
await page.waitForSelector("text=与 AI 一起整理，而不是被总结");
await page.getByRole("button", { name: /删除推断/ }).click();
await shot("reflection");

console.log(JSON.stringify({
  title: await page.title(),
  finalHeading: await page.locator("h1").first().textContent(),
  adjustmentScreenshot: path.join(root, "qa-adjustment.png"),
  reflectionScreenshot: path.join(root, "qa-reflection.png"),
}));

await browser.close();
