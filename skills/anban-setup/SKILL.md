---
name: anban-setup
description: Use when user mentions "初始化", "anban-setup", "第一次使用", "API Key", "密钥", or when MCP tools fail with auth/connection errors suggesting missing ANBAN_API_KEY.
user-invocable: true
---

# /anban-setup Anban Creator 初始化

## 案例库

遇到场景分支、产物格式或质量边界不确定时，先读 [references/examples.md](references/examples.md)。

## 图片比例固定规则

本 Skill 只要涉及生成、选择、裁切、校验或引用图片，必须按以下优先级决定画面比例：

1. 用户/任务明确指定的 `image_ratio`、`size` 或平台规格优先。
2. 项目/频道默认比例次之。
3. 业务默认比例只作兜底：微信文章封面/正文图默认 `16:9`；Seednote/XLS/移动信息流默认 `3:4`；电商、广告投放、视频封面按具体平台素材位要求执行。
4. 不得从模型路由、供应商默认 `size` 或模型能力反推业务比例；模型只决定能力和成本，比例属于创作场景约束。


## 本地 CLI 预检

在调用 `list_projects` 之前，先确保插件内置的本地 `anban` CLI 可用。这个步骤用于视频剪辑等本地媒体能力，用户不需要手动安装二进制。

用 Bash 执行以下检查和自动修复流程：

```bash
ANBAN_CLI=""
ANBAN_DATA="${ANBAN_PLUGIN_DATA:-${CLAUDE_PLUGIN_DATA:-${PLUGIN_DATA:-}}}"
for root in "$ANBAN_DATA"; do
  [ -z "$root" ] && continue
  if [ -x "$root/bin/anban" ]; then
    ANBAN_CLI="$root/bin/anban"
    break
  fi
  if [ -x "$root/bin/anban.exe" ]; then
    ANBAN_CLI="$root/bin/anban.exe"
    break
  fi
done

for root in "${ANBAN_PLUGIN_ROOT:-}" "${CLAUDE_PLUGIN_ROOT:-}" "${PLUGIN_ROOT:-}"; do
  [ -z "$root" ] && continue
  if [ -x "$root/bin/anban" ]; then
    ANBAN_CLI="$root/bin/anban"
    break
  fi
  if [ -x "$root/bin/anban.exe" ]; then
    ANBAN_CLI="$root/bin/anban.exe"
    break
  fi
done

if [ -z "$ANBAN_CLI" ]; then
  for root in "${ANBAN_PLUGIN_ROOT:-}" "${CLAUDE_PLUGIN_ROOT:-}" "${PLUGIN_ROOT:-}"; do
    [ -z "$root" ] && continue
    if [ -x "$root/scripts/bootstrap.sh" ]; then
      ANBAN_PLUGIN_ROOT="$root" CLAUDE_PLUGIN_DATA="$ANBAN_DATA" PLUGIN_DATA="$ANBAN_DATA" "$root/scripts/bootstrap.sh" >/dev/null 2>&1 || true
      for bin_root in "$ANBAN_DATA" "$root"; do
        [ -z "$bin_root" ] && continue
        if [ -x "$bin_root/bin/anban" ]; then
          ANBAN_CLI="$bin_root/bin/anban"
          break 2
        fi
        if [ -x "$bin_root/bin/anban.exe" ]; then
          ANBAN_CLI="$bin_root/bin/anban.exe"
          break 2
        fi
      done
      if [ -x "$root/bin/anban" ]; then
        ANBAN_CLI="$root/bin/anban"
        break
      fi
      if [ -x "$root/bin/anban.exe" ]; then
        ANBAN_CLI="$root/bin/anban.exe"
        break
      fi
    fi
  done
fi

if [ -z "$ANBAN_CLI" ] || ! "$ANBAN_CLI" --help >/dev/null 2>&1; then
  echo "ANBAN_CLI_NOT_READY"
else
  echo "ANBAN_CLI_OK"
fi
```

这里的验证等价于运行 `anban --help`。如果输出 `ANBAN_CLI_NOT_READY`，请用普通用户能理解的话说明：本地视频工具没有准备好，请重新安装 Anban 插件；如果重新安装后仍失败，请联系 Anban 支持。不要要求用户运行构建命令或手动复制文件。

## 预检

尝试调用 `list_projects` MCP 工具：

- **成功** → 输出连接状态和可用项目，结束
- **失败**（认证错误、连接失败）→ 进入下方密钥设置流程

## 用户级配置：API Key

向用户说明：

> Anban Creator MCP 服务器需要 API Key 进行认证。请前往 https://creator.anbanai.com 注册账号并获取 API Key。

通过 AskUserQuestion 向用户索取密钥值。

收到后，使用 Write/Edit 工具将密钥写入用户常用 shell 配置文件，例如 `~/.zshrc` 或 `~/.bashrc`：

```bash
export ANBAN_API_KEY="<用户提供的密钥>"
```

**注意**：
- 优先复用用户当前实际使用的 shell 配置文件；如果不确定，可先询问用户使用的是 zsh 还是 bash。
- 如果目标文件已存在，必须先 Read 读取现有内容，再追加 `export ANBAN_API_KEY=...`，不要覆盖其他已有配置。
- 这是**用户级别**配置，对所有项目生效，无需在每个项目中重复设置。
- 写入完成后提醒用户执行 `source ~/.zshrc`、`source ~/.bashrc`，或直接重启 OpenClaw。

## 项目级配置

API Key 设置完成后，可根据需要提示用户补充项目级环境变量。

### 服务地址（可选）

如果用户需要连接官方在线服务、自建服务或其他非默认地址，可继续写入：

```bash
export ANBAN_API_URL="<用户的服务地址>"
```

### 默认项目（可选）

如果 `list_projects` 返回多个项目，询问用户是否要设置默认项目，写入：

```bash
export ANBAN_DEFAULT_PROJECT="<项目 ID>"
```

**补充规则**：
- 如果这些变量只想在当前机器全局生效，继续写在 shell 配置文件中即可。
- 如果用户明确只想在当前项目里生效，再根据 OpenClaw 的实际运行方式选择项目局部环境文件，不要默认写入 `.claude/settings.local.json`。

## 完成

**写作去 AI SKILL 可用性校验**：确认去 AI 味能力已随插件内置——用 Bash 检查插件目录下的 `skills/humanizer/SKILL.md` 是否存在（或用 Glob 搜索 `**/skills/humanizer/SKILL.md`）。该 SKILL 被 `content-writing`、`seednote-writing`、`ecommerce-copywriting` 写作流程调用，随插件安装即就绪，无需联网或 `git clone`。若缺失，提示用户重新安装 Anban Creator 插件。

告知用户：

> 配置完成。**请退出并重新启动 OpenClaw**，让 MCP 连接生效。重启后再次运行 `/anban-setup` 验证连接。
