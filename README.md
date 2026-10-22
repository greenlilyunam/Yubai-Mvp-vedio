# 余白 · AI 精神漫游 MVP

面向深圳南山区大学城地铁站周边的可运行移动端 Demo。当前版本已接入高德天气、POI 与步行路线，并提供隐私最小化的阿里云百炼状态理解接口。

## 当前真实链路

1. 用户选择能量、可用时间、社交边界和行动倾向。
2. 前端只把这四个结构化字段提交给 `POST /interpret`；自由文本、姓名、历史记录和位置不会提交给百炼。
3. 百炼返回可修正的状态摘要及路线偏好，不进行心理诊断。
4. 路线接口结合百炼偏好、实时天气、高德真实地点和步行规划选择节点。
5. 用户确认后进入感知路径，可打开高德查看每一段真实步行路线。
6. 地点节点可留下照片、最多 20 秒声音或一句话；结束时形成一份当前会话内的漫游档案。
7. 余白卡、首页历史、个人自画像和余白地图读取同一份漫游档案，不再使用互不关联的静态示例内容。
8. 用户关闭“加入个人精神地图”时不会写入地图；之后也可以从余白卡明确选择加入。
9. 余白地图支持高德 JS API 真实底图、坐标标记和设备定位打卡；手动选点与设备定位核验会被清楚区分。
10. 漫游期间仅在页面开启时判断用户与当前节点的距离；进入约 120 米范围且定位精度合格后，节点会标记为“设备定位抵达”。现场照片、声音和文字通过节点 ID 与该地点一一对应，跳过的节点不会进入余白地图。

如果百炼没有配置或暂时不可用，前端会自动使用本地安全规则继续生成路线，不会阻断演示。

## API

阿里云函数计算入口：

- `GET /`：服务状态及接口目录
- `GET /weather`：南山区实时天气
- `GET /places`：大学城地铁站 C 口周边候选地点
- `POST /interpret`：百炼状态理解，仅接收四个最小化字段
- `GET /route?energy=30&minutes=40&social=low&preference=calm`：真实地点与步行路线

`POST /interpret` 请求示例：

```json
{
  "energy": 30,
  "minutes": 40,
  "social": "独处",
  "action": "散步"
}
```

## 阿里云函数环境变量

必须配置：

- `AMAP_WEB_KEY`：高德 Web 服务 Key
- `DASHSCOPE_API_KEY`：阿里云百炼 API Key，只保存在函数计算服务端

建议配置：

- `AMAP_DEFAULT_ADCODE=440305`
- `BAILIAN_MODEL=qwen-flash`
- `BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`

不要把百炼 Key 或高德 Web 服务 Key 写入前端、截图、GitHub 仓库或测试记录。

## 余白地图网页配置

真实地图需要单独创建一个高德「Web 端（JS API）」Key，不能复用函数计算中的 `AMAP_WEB_KEY`。本地开发时复制 `.env.example` 为 `.env.local` 并填写：

- `VITE_AMAP_JS_KEY`：Web 端（JS API）Key
- `VITE_AMAP_SECURITY_CODE`：该 JS API 应用对应的安全密钥

GitHub Pages 构建时，在仓库 Settings → Secrets and variables → Actions 中添加变量 `AMAP_JS_KEY` 和 Secret `AMAP_SECURITY_CODE`。高德控制台应把可用域名限制为 `greenlilyunam.github.io` 和本地开发域名。网页端 Key 会随前端资源下发，因此域名白名单是必要的安全边界。

若未配置网页地图 Key，原型会保留视觉底图和定位记录能力，不会把后端 Web 服务 Key 暴露到浏览器。

## 隐私边界

- 提交给百炼：`energy`、`minutes`、`social`、`action`
- 明确排除：自然语言描述、姓名、历史记录、精确位置
- 余白后端不建立数据库，也不保存本次状态
- 百炼仅提供初步理解和路线偏好，最终路线始终由用户确认
- 地点事实来自高德；安静度、座椅、遮蔽和开放时间仍标记为待实地核验
- 未拍摄照片时，余白卡和地点详情使用路线文字卡面，不会用无关示例图冒充现场照片
- 当前原型不建立用户数据库；刷新页面后会话档案会清空，符合本轮测试的最小化数据策略
- 用户确认加入余白地图的地点会保存在当前浏览器本地；系统不保存连续移动轨迹，也不会在页面关闭后继续定位

## 本地启动与构建

```bash
npm install
npm run dev
npm run build
```

生产前端由 GitHub Pages 发布：<https://greenlilyunam.github.io/Yubai-Mvp-vedio/>

后端部署文件位于 `backend/aliyun-fc/app.py`。在阿里云函数计算 WebIDE 替换该文件后，需要保存并点击“部署代码”。
