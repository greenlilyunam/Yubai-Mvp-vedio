# 余白 · AI 精神漫游 MVP

面向深圳南山区大学城地铁站周边的可运行移动端 Demo。当前版本已接入高德天气、POI 与步行路线，并提供隐私最小化的阿里云百炼状态理解接口。

## 当前真实链路

1. 用户选择能量、可用时间、社交边界和行动倾向。
2. 前端只把这四个结构化字段提交给 `POST /interpret`；自由文本、姓名、历史记录和位置不会提交给百炼。
3. 百炼返回可修正的状态摘要及路线偏好，不进行心理诊断。
4. 路线接口结合百炼偏好、实时天气、高德真实地点和步行规划选择节点。
5. 用户确认后进入感知路径，可打开高德查看每一段真实步行路线。

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

不要把任何 Key 写入前端、截图、GitHub 仓库或测试记录。

## 隐私边界

- 提交给百炼：`energy`、`minutes`、`social`、`action`
- 明确排除：自然语言描述、姓名、历史记录、精确位置
- 余白后端不建立数据库，也不保存本次状态
- 百炼仅提供初步理解和路线偏好，最终路线始终由用户确认
- 地点事实来自高德；安静度、座椅、遮蔽和开放时间仍标记为待实地核验

## 本地启动与构建

```bash
npm install
npm run dev
npm run build
```

生产前端由 GitHub Pages 发布：<https://greenlilyunam.github.io/Yubai-Mvp-vedio/>

后端部署文件位于 `backend/aliyun-fc/app.py`。在阿里云函数计算 WebIDE 替换该文件后，需要保存并点击“部署代码”。
