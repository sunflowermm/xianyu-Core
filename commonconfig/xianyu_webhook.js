import ConfigBase from '#infrastructure/commonconfig/commonconfig.js';

/**
 * 闲鱼 webhook 推送配置（xianyu-Core 自带）
 * 配置文件：data/server_bots/{port}/xianyu_webhook.yaml
 *
 * 注意：默认模板不放在根目录 config/default_config/，
 * 由 xianyu-Core 的 http/init 自行在首次启动时创建配置文件。
 */
export default class XianyuWebhookConfig extends ConfigBase {
  constructor() {
    super({
      name: 'xianyu_webhook',
      displayName: '闲鱼 Webhook 配置（xianyu-Core）',
      description: '接收外部 webhook 并转发到指定群聊/私聊（OneBotv11）',
      filePath: (cfg) => {
        const port = cfg?.port ?? cfg?._port;
        if (!port) throw new Error('XianyuWebhookConfig: 未提供端口，无法解析路径');
        return `data/server_bots/${port}/xianyu_webhook.yaml`;
      },
      fileType: 'yaml',
      schema: {
        fields: {
          enabled: {
            type: 'boolean',
            label: '启用',
            default: false,
            component: 'Switch',
          },
          secret: {
            type: 'string',
            label: 'Webhook 密钥',
            description: '校验 header: X-Xianyu-Secret 或 query: ?secret=xxx；留空表示不校验（不推荐）',
            default: '',
            component: 'InputPassword',
          },
          bot_id: {
            type: 'string',
            label: '发送机器人（bot_id）',
            description: '可选：指定一个已连接的机器人 UIN；留空则使用默认机器人',
            default: '',
            component: 'Input',
          },
          groups: {
            type: 'array',
            label: '群聊推送列表',
            description: '群号数组（字符串或数字均可；内部会转为字符串）',
            itemType: 'string',
            default: [],
            component: 'Tags',
          },
          privates: {
            type: 'array',
            label: '私聊推送列表',
            description: 'QQ 号数组（字符串或数字均可；内部会转为字符串）',
            itemType: 'string',
            default: [],
            component: 'Tags',
          },
        },
      },
    });
  }
}

