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
  - 首次启动时由 **HTTP 模块的 init()** 自动确保配置文件存在（从本 Core 内置模板复制）
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
- **首次运行**：若文件不存在，`http/webhook.js` 的 `init()` 会从本 Core 的模板复制生成：
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

### 鉴权

- 如果 `secret` 非空：需要满足其一
  - `Header: X-Xianyu-Secret: <secret>`
  - 或 `Query: ?secret=<secret>`

> 注意：若你的 `server.yaml` 启用了 APIKey 鉴权且未对白名单放行该路径，则还需把 `/webhook/xianyu` 加到 `data/server_bots/{port}/server.yaml` 的 `auth.whitelist`（这是服务端统一安全策略，不属于 xianyu-Core 逻辑）。

### 请求示例

```bash
curl -X POST "http://127.0.0.1:端口/webhook/xianyu?secret=你的secret" \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"测试推送\"}"
```

---

## 🧱 与 XRK-AGT 框架的关系

本 Core 仅复用 XRK-AGT 已有能力，不修改基础设施层：

| 能力 | 说明 |
|------|------|
| **commonconfig 加载** | ConfigLoader 扫描 `core/*/commonconfig/*.js`；`xianyu_webhook.js` → key `xianyu_webhook` |
| **HTTP 加载** | HttpApiLoader 扫描 `core/*/http/*.js` 并挂载路由；本 Core 提供 `/webhook/xianyu` |
| **消息发送** | 通过 `Bot.sendGroupMsg / Bot.sendFriendMsg` 统一发送；OneBotv11 由 `system-Core/tasker/OneBotv11.js` 提供 |

---

## 📄 许可证

以主项目 XRK-AGT 的许可证与约定为准。

