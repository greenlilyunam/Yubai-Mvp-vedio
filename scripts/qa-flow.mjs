import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /开始感知/ }).click();
await page.getByRole("button", { name: /开始本次状态输入/ }).click();
await page.getByRole("button", { name: /让“余白”理解我/ }).click();
await page.waitForSelector("text=我先试着理解你");
await page.getByRole("button", { name: /这个理解可以继续/ }).click();
await page.getByRole("button", { name: /准备好，一起出发/ }).click();
await page.getByRole("button", { name: /此刻感觉怎么样/ }).click();
await page.getByRole("button", { name: /这里太吵/ }).click();
await page.getByRole("button", { name: /继续漫游/ }).click();
await page.getByRole("button", { name: /完成当前节点/ }).click();
await page.getByRole("button", { name: /完成本次感知/ }).click();
await page.getByRole("button", { name: /不保存，直接结束/ }).click();
await page.getByRole("button", { name: /查看今日余白卡/ }).click();
await page.getByRole("button", { name: /保存到余白地图/ }).click();
await page.getByRole("button", { name: /添加一处余白/ }).click();
await page.getByRole("button", { name: /添加到余白地图/ }).click();
await page.getByRole("button", { name: /自画像/ }).click();
console.log(`PASS: ${await page.locator("h1").first().textContent()}`);
await browser.close();
