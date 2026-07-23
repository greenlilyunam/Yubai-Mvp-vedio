import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu-sandbox"],
});

const cases = [
  { button: /这里太吵/, title: "为你换一条更安静的路", result: "路线已避开嘈杂区域" },
  { button: /有点累了/, title: "让余下的路轻一点", result: "已缩短剩余步行时间" },
  { button: /想继续探索/, title: "在余白里再多走一点", result: "已加入一段可选探索" },
];

for (const item of cases) {
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "开始感知" }).click();
  await page.getByRole("button", { name: "让 AI 先理解我" }).click();
  await page.waitForSelector("text=状态协商", { timeout: 5000 });
  await page.getByRole("button", { name: "这个理解可以继续" }).click();
  await page.getByRole("button", { name: "准备好，一起出发" }).click();
  await page.getByRole("button", { name: "此刻感觉怎么样？" }).click();
  await page.getByRole("button", { name: item.button }).click();
  await page.waitForSelector(`text=${item.title}`);
  await page.getByRole("button", { name: "接受这次调整" }).click();
  await page.waitForSelector(`text=${item.result}`);
  console.log(`PASS: ${item.title} -> ${item.result}`);
  await page.close();
}

await browser.close();
