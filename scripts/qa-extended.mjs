import { chromium } from "playwright-core";
import path from "node:path";

const root = "C:/Users/18882/Documents/Codex/2026-07-17/w-x/outputs/yubai-mvp/.public-preview";
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu-sandbox"],
});

const screens = ["splash", "home", "world", "resonance", "card", "map", "mapAdd", "mapEntry", "profile"];
for (const screen of screens) {
  const page = await browser.newPage({ viewport: { width: 1220, height: 980 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:4173/?screen=${screen}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(root, `${screen}.png`), fullPage: true });
  const metrics = await page.evaluate(() => {
    const phone = document.querySelector(".phone-shell");
    const activeScreen = document.querySelector(".screen");
    const scrollArea = document.querySelector(".hub-scroll, .scroll-screen");
    return {
      title: document.querySelector("h1")?.textContent?.trim() ?? "",
      phone: phone ? { width: phone.clientWidth, height: phone.clientHeight } : null,
      screen: activeScreen ? { width: activeScreen.clientWidth, height: activeScreen.clientHeight } : null,
      scroll: scrollArea ? { height: scrollArea.clientHeight, scrollHeight: scrollArea.scrollHeight } : null,
    };
  });
  console.log(screen, JSON.stringify(metrics));
  await page.close();
}

const flow = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1 });
await flow.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await flow.getByRole("button", { name: /开始感知/ }).click();
await flow.getByRole("button", { name: /开始本次状态输入/ }).click();
await flow.getByRole("button", { name: /让“余白”理解我/ }).click();
await flow.waitForSelector("text=我先试着理解你", { timeout: 5000 });
await flow.getByRole("button", { name: /这个理解可以继续/ }).click();
await flow.getByRole("button", { name: /准备好，一起出发/ }).click();
await flow.getByRole("button", { name: /此刻感觉怎么样/ }).click();
await flow.getByRole("button", { name: /这里太吵/ }).click();
await flow.waitForSelector("text=为你换一条更安静的路");
await flow.getByRole("button", { name: /继续漫游/ }).click();
await flow.getByRole("button", { name: /完成当前节点/ }).click();
await flow.getByRole("button", { name: /完成本次感知/ }).click();
await flow.getByRole("button", { name: /不保存，直接结束/ }).click();
await flow.getByRole("button", { name: /查看今日余白卡/ }).click();
await flow.getByRole("button", { name: /保存到余白地图/ }).click();
await flow.getByRole("button", { name: /添加一处余白/ }).click();
await flow.getByRole("button", { name: /添加到余白地图/ }).click();
await flow.getByRole("button", { name: /自画像/ }).click();
console.log("flow", await flow.locator("h1").first().textContent());
await flow.close();

await browser.close();
