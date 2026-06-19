---
name: setup
description: Use when user mentions "初始化", "setup", "第一次使用", "API Key", "密钥", or when MCP tools fail with auth/connection errors suggesting missing ANBANWRITER_API_KEY.
user-invocable: true
---

# /setup anbanwriter 初始化

## 预检

尝试调用 `list_channels` MCP 工具：

- **成功** → 输出连接状态和可用频道，结束
- **失败**（认证错误、连接失败）→ 进入下方密钥设置流程

## 用户级配置：API Key

向用户说明：

> anbanwriter MCP 服务器需要 API Key 进行认证。请前往 https://creator.anbanai.com 注册账号并获取 API Key。

通过 AskUserQuestion 向用户索取密钥值。

收到后，使用 Write/Edit 工具将密钥写入用户常用 shell 配置文件，例如 `~/.zshrc` 或 `~/.bashrc`：

```bash
export ANBANWRITER_API_KEY="<用户提供的密钥>"
```

**注意**：
- 优先复用用户当前实际使用的 shell 配置文件；如果不确定，可先询问用户使用的是 zsh 还是 bash。
- 如果目标文件已存在，必须先 Read 读取现有内容，再追加 `export ANBANWRITER_API_KEY=...`，不要覆盖其他已有配置。
- 这是**用户级别**配置，对所有项目生效，无需在每个项目中重复设置。
- 写入完成后提醒用户执行 `source ~/.zshrc`、`source ~/.bashrc`，或直接重启 OpenClaw。

## 项目级配置

API Key 设置完成后，可根据需要提示用户补充项目级环境变量。

### 服务地址（可选）

如果用户需要连接官方在线服务、自建服务或其他非默认地址，可继续写入：

```bash
export ANBANWRITER_API_URL="<用户的服务地址>"
```

### 默认频道（可选）

如果 `list_channels` 返回多个频道，询问用户是否要设置默认频道，写入：

```bash
export ANBANWRITER_DEFAULT_CHANNEL="<频道 ID>"
```

**补充规则**：
- 如果这些变量只想在当前机器全局生效，继续写在 shell 配置文件中即可。
- 如果用户明确只想在当前项目里生效，再根据 OpenClaw 的实际运行方式选择项目局部环境文件，不要默认写入 `.claude/settings.local.json`。

## 完成

告知用户：

> 配置完成。**请退出并重新启动 OpenClaw**，让 MCP 连接生效。重启后再次运行 `/setup` 验证连接。
