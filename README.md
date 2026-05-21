# Anban 智能创作助手 OpenClaw 插件

> 微信公众号 & 种草笔记 AI 内容创作插件，支持 OpenClaw 平台的原生插件集成。

## 接入流程

第一次使用，按下面顺序做最清晰：

1. 打开 [Anban Studio / Web 管理端](https://creator.anbanai.com) 注册或登录
2. 在设置页创建 API Key
3. 安装 OpenClaw 插件
4. 配置 `ANBANWRITER_API_KEY`
5. 运行 `/init`
6. 完全退出并重新启动 OpenClaw
7. 重启后再次运行 `/init` 验证连接
8. 开始执行创作命令

---

## 1. 注册账号

先访问 [https://creator.anbanai.com](https://creator.anbanai.com) 注册或登录你的 Anban 账号。

## 2. 创建 API Key

登录后前往 [设置页](https://creator.anbanai.com/settings) 创建 API Key。

- 建议按设备命名，例如 `My MacBook`
- Key 只会在创建成功时完整显示一次
- 如果当时没复制，后面只能重新创建一个新的

## 3. 安装插件

克隆插件仓库并安装：

```bash
git clone https://github.com/anbanai/anbanwriter-openclaw.git
cd anbanwriter-openclaw
openclaw plugins install .
```

安装完成后，建议确认插件已经出现在 OpenClaw 的插件列表里。

## 4. 设置 Key

OpenClaw 插件通过环境变量读取账号信息。最少先把下面这一行加到你的 `~/.zshrc` 或 `~/.bashrc`：

```bash
export ANBANWRITER_API_KEY="你的完整 API Key"
```

如果你使用官方在线服务，可以额外加上：

```bash
export ANBANWRITER_API_URL="https://api.creator.anbanai.com"
```

如果你接的是自建或本地服务，就把这个地址换成你自己的服务地址。

写入后执行一次 `source ~/.zshrc`（或重开一个终端窗口），再继续下一步。

## 5. 运行 `/init`

安装并配置好 Key 后，在 OpenClaw 中运行：

```bash
/init
```

`/init` 会检查 API Key、MCP 服务连接和当前账号下的频道可用性。

## 6. 重启 OpenClaw

`/init` 跑完以后，请**完全退出并重新启动 OpenClaw**，让新的环境变量和插件连接正式生效。

重启后再执行一次：

```bash
/init
```

如果看到连接成功提示或可用频道列表，就说明接入已经完成。

## 7. 开始使用

### 方式一：斜杠命令

这是最直接的用法：

```text
/article AI Agent 入门指南
/seednote 降噪耳机种草笔记
```

### 方式二：自然语言

你也可以直接描述需求，让插件自行选择对应流程：

```text
帮我写一篇关于 AI Agent 的公众号文章
种草笔记种草笔记，主题是降噪耳机
```

## 常用命令

- `/init`
  初始化配置并验证连接
- `/article`
  公众号图文创作
- `/seednote`
  种草笔记创作

## 遇到问题时先检查

1. 是否已经在 [设置页](https://creator.anbanai.com/settings) 创建并复制了完整 API Key
2. `ANBANWRITER_API_KEY` 是否已经写入 shell 配置
3. 是否已经完全退出并重启过 OpenClaw
4. 重启后是否重新执行过 `/init`

## 创作引擎

| 引擎 | 触发关键词 | 说明 |
|-------|-----------|------|
| wechat-article | "写文章"、"写一篇"、"发文章" | 微信公众号图文（选题研究 → AI 写作 → 去痕优化 → SEO → 封面配图 → 草稿发布） |
| seednote | "种草笔记"、"种草"、"仿写" | 种草笔记图文（选题研究 → 内容创作 → 封面 + 配图 → 合规 → 归档） |

## 开发

```bash
npm install
npm run build    # TypeScript 编译
npm run dev      # 监听模式
npm run lint     # 类型检查
```

## 项目结构

```
├── src/
│   ├── index.ts            # 插件入口
│   ├── lib.ts              # 共享工具
│   ├── commands/           # 命令注册
│   └── hooks/              # 质量检查钩子
├── skills/                 # 专业技能（SKILL.md）
├── package.json
└── tsconfig.json
```

## 其他版本

- [Claude Code 插件](https://github.com/anbanai/anbanwriter-claudecode) — Claude Code Agent+Skill+MCP 插件版本
- [Web 管理端](https://creator.anbanai.com) — 在线管理后台，支持任务管理、积分充值等

## 加入社群

扫码加入 **Anban 智能创作助手讨论群**，获取使用技巧、功能更新和问题解答：

<img src="community-qr.jpg" alt="Anban 智能创作助手讨论群" width="200">

## License

MIT
