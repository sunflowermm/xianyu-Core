<div align="center">

# 🐟 xianyu-Core

**XRK-AGT 闲鱼 Webhook 通道：提供一个可对外开放的 Webhook URL，将收到的 payload 转发到指定群聊/私聊（通过 system-Core 的 OneBotv11 通道发消息）。**

<p>
  <img src="./咸鱼-copy.png" alt="xianyu webhook" width="360" />
</p>

</div>

---

## 📦 项目定位

- **所在位置**：在 XRK-AGT 仓库内作为 Core 模块，放入 `core/xianyu-Core/` 即可。
- **职责**：
  - 提供 **Webhook 接收接口**：`POST /webhook/xianyu`
  - 通过 **commonconfig/xianyu_webhook.js** 提供配置 Schema（启用开关、密钥、推送群/私聊数组、bot_id）
  - 请求到达时自动确保配置文件存在（从本 Core 内置模板复制到 `data/server_bots/{port}/xianyu_webhook.yaml`）
  - 将收到的 webhook 内容转为文本后，调用 `Bot.sendGroupMsg / Bot.sendFriendMsg` 转发（底层由 `system-Core/tasker/OneBotv11.js` 实现发送）

---

## 🗂️ 目录结构

```text
xianyu-Core/
├── README.md
├── 咸鱼-copy.png
├── commonconfig/
│   └── xianyu_webhook.js            # 配置 Schema（enabled/secret/groups/privates/bot_id）
├── default_config/
│   └── xianyu_webhook.yaml          # Core 内置默认模板（首次启动复制到 data/server_bots/{port}/）
└── http/
    └── webhook.js                   # Webhook 路由：POST /webhook/xianyu（并负责首次复制生成配置）
```

---

## ⚙️ 配置与启用

### 配置文件路径

- **实际生效**：`data/server_bots/{port}/xianyu_webhook.yaml`
  - 由 `commonconfig/xianyu_webhook.js` 的 `filePath` 指定
  - 可通过 Web 控制台（commonconfig）编辑
- **首次运行**：若文件不存在，首次请求到达时会从本 Core 的模板复制生成：
  - `core/xianyu-Core/default_config/xianyu_webhook.yaml`

### 启用开关

| 字段 | 类型 | 说明 |
|------|------|------|
| **enabled** | boolean | 为 `true` 时允许接收并转发；为 `false` 时接口返回 403。默认 `false`。 |

### 主要配置项

| 字段 | 说明 |
|------|------|
| **secret** | Webhook 密钥（推荐必填）。请求需带 `X-Xianyu-Secret` 或 `?secret=` |
| **groups** | 群号数组（转发到这些群） |
| **privates** | QQ 号数组（转发到这些私聊） |
| **bot_id** | 可选，指定用哪个机器人发送；留空则自动选用一个已连接机器人 |

---

## 🔗 Webhook 使用

### 路由

- `POST /webhook/xianyu`

### 鉴权（xianyu-Core 自己负责）

- 如果 `secret` 非空：需要满足其一
  - `Header: X-Xianyu-Secret: <secret>`
  - 或 `Query: ?secret=<secret>`

### 常见问题

- **Webhook 返回 403**：
  - **xianyu_webhook 未启用**：把 `data/server_bots/{port}/xianyu_webhook.yaml` 里的 `enabled` 改成 `true`
  - **密钥不匹配**：确认请求携带的 `X-Xianyu-Secret` / `?secret=` 与配置里的 `secret` 一致

### 请求示例

```bash
curl -X POST "http://127.0.0.1:端口/webhook/xianyu?secret=你的secret" \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"测试推送\"}"
```

---

## 🧩 依赖与边界（该参考 system-Core 的地方）

- **依赖 system-Core**：
  - 本 Core **不实现发送协议**，只调用 `Bot.sendGroupMsg / Bot.sendFriendMsg`。
  - 这要求你已经在运行环境里启用了可用的发送通道（例如 `system-Core/tasker/OneBotv11.js` 已连接），否则会在发送阶段失败。

- **依赖配置系统**：
  - 本 Core 的配置通过 `commonconfig/xianyu_webhook.js` 提供，并在运行时通过 `global.ConfigManager.get('xianyu_webhook').read()` 读取。
  - 配置文件缺失时，本 Core 会从 `default_config/xianyu_webhook.yaml` 复制生成到 `data/server_bots/{port}/xianyu_webhook.yaml`。

---

## 🧱 自己写业务 Core 需要注意的地方

- **不要假设全局会替你鉴权**：本项目只有需要鉴权的模块（如 system-Core）才会在自身 handler 内做鉴权。
  - 如果你的业务 Core 也需要鉴权，请在自己的路由里实现（推荐复用 `HttpResponse`，必要时可调用 `Bot.checkApiAuthorization(req)`）。
- **配置读取优先走 commonconfig**：业务 Core 新增配置，应该用 `commonconfig/*.js` + `global.ConfigManager.get(name)`，而不是往 `cfg`（底层固定配置集合）里硬塞字段。

---

## 📄 许可证

以主项目 XRK-AGT 的许可证与约定为准。

