import cfg from '#infrastructure/config/config.js';
import { HttpResponse } from '#utils/http-utils.js';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import paths from '#utils/paths.js';

async function ensureXianyuWebhookConfigFile(port) {
  const targetPath = path.join(paths.root, 'data', 'server_bots', String(port), 'xianyu_webhook.yaml');
  if (fs.existsSync(targetPath)) return { ok: true, targetPath, created: false };

  const templatePath = path.join(paths.root, 'core', 'xianyu-Core', 'default_config', 'xianyu_webhook.yaml');
  try {
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    await fsp.copyFile(templatePath, targetPath);
    return { ok: true, targetPath, created: true };
  } catch {
    return { ok: false, targetPath, created: false };
  }
}

function normArray(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map(x => String(x ?? '').trim())
    .filter(Boolean);
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
  routes: [
    {
      method: 'POST',
      path: '/webhook/xianyu',
      handler: HttpResponse.asyncHandler(async (req, res, Bot) => {
        const port = cfg?.port ?? cfg?._port;
        if (!port) return HttpResponse.error(res, new Error('端口未初始化，无法解析配置路径'), 503, 'xianyu.webhook');

        // 确保配置文件存在（不依赖根 default_config）
        const ensured = await ensureXianyuWebhookConfigFile(port);
        if (!ensured.ok) {
          return HttpResponse.error(res, new Error(`配置文件生成失败: ${ensured.targetPath}`), 503, 'xianyu.webhook');
        }

        const cm = global.ConfigManager?.get?.('xianyu_webhook');
        if (!cm || typeof cm.read !== 'function') {
          return HttpResponse.error(res, new Error('ConfigManager 未初始化或 xianyu_webhook 未加载'), 503, 'xianyu.webhook');
        }

        const conf = await cm.read(true).catch(() => ({}));
        if (conf.enabled !== true) {
          return HttpResponse.forbidden(
            res,
            `xianyu_webhook 未启用（请编辑 ${ensured.targetPath}，设置 enabled: true）`,
          );
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

