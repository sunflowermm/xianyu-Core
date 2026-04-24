import cfg from '#infrastructure/config/config.js';
import { HttpResponse } from '#utils/http-utils.js';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import paths from '#utils/paths.js';

function normArray(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map(x => String(x ?? '').trim())
    .filter(Boolean);
}

function getXianyuWebhookConfig() {
  const c = cfg?.xianyu_webhook;
  return c && typeof c === 'object' ? c : {};
}

function pickSecretFromReq(req) {
  const h = req.headers?.['x-xianyu-secret'] ?? req.headers?.['X-Xianyu-Secret'];
  const q = req.query?.secret;
  return String(h ?? q ?? '').trim();
}

function buildTextFromPayload(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') return payload;

  // 常见字段兼容：text / message / content / title + content
  const text =
    payload.text ??
    payload.message ??
    payload.content ??
    payload.msg ??
    '';

  if (typeof text === 'string') {
    const t = text.trim();
    if (t) return t;
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (title && body) return `${title}\n\n${body}`;
  if (title) return title;
  if (body) return body;

  // 兜底：序列化
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

async function dispatchToTargets(Bot, { botId, groups, privates, msg }) {
  const jobs = [];

  for (const group_id of groups) {
    jobs.push(
      Bot.sendGroupMsg(botId || null, group_id, msg).then(
        r => ({ ok: true, type: 'group', target: group_id, message_id: r?.message_id }),
        e => ({ ok: false, type: 'group', target: group_id, error: e?.message || String(e) }),
      ),
    );
  }

  for (const user_id of privates) {
    jobs.push(
      Bot.sendFriendMsg(botId || null, user_id, msg).then(
        r => ({ ok: true, type: 'private', target: user_id, message_id: r?.message_id }),
        e => ({ ok: false, type: 'private', target: user_id, error: e?.message || String(e) }),
      ),
    );
  }

  return await Promise.all(jobs);
}

export default {
  name: 'xianyu-webhook',
  dsc: '闲鱼 webhook 接收与转发（OneBotv11）',
  priority: 120,
  init: async () => {
    // xianyu-Core 自己负责首次生成配置文件（不依赖根目录 default_config 模板）
    const port = cfg?.port ?? cfg?._port;
    if (!port) return;

    const targetPath = path.join(paths.root, 'data', 'server_bots', String(port), 'xianyu_webhook.yaml');
    if (fs.existsSync(targetPath)) return;

    const templatePath = path.join(paths.root, 'core', 'xianyu-Core', 'default_config', 'xianyu_webhook.yaml');
    try {
      await fsp.mkdir(path.dirname(targetPath), { recursive: true });
      await fsp.copyFile(templatePath, targetPath);
    } catch (e) {
      // 不阻断启动：如果复制失败，后续读取 cfg.xianyu_webhook 时会给出更明确的错误
      // 这里不能依赖 Bot（init 无注入），用 console 也会污染输出，因此保持静默
    }
  },
  routes: [
    {
      method: 'POST',
      path: '/webhook/xianyu',
      handler: HttpResponse.asyncHandler(async (req, res, Bot) => {
        const conf = getXianyuWebhookConfig();
        if (conf.enabled !== true) {
          return HttpResponse.forbidden(res, 'xianyu_webhook 未启用');
        }

        const secret = String(conf.secret ?? '').trim();
        if (secret) {
          const provided = pickSecretFromReq(req);
          if (!provided || provided !== secret) {
            return HttpResponse.unauthorized(res, 'Webhook 密钥不正确');
          }
        }

        const groups = normArray(conf.groups);
        const privates = normArray(conf.privates);
        if (!groups.length && !privates.length) {
          return HttpResponse.validationError(res, '未配置推送目标（groups/privates 为空）');
        }

        const payload = req.body;
        const msg = buildTextFromPayload(payload);
        if (!msg) {
          return HttpResponse.validationError(res, '空 payload：无法生成推送内容');
        }

        const botId = String(conf.bot_id ?? '').trim() || null;
        const results = await dispatchToTargets(Bot, { botId, groups, privates, msg });
        const okCount = results.filter(r => r.ok).length;

        return HttpResponse.success(res, {
          ok: okCount === results.length,
          okCount,
          total: results.length,
          results,
        });
      }, 'xianyu.webhook'),
    },
  ],
};

