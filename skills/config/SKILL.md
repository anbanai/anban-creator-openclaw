---
name: config
description: Initializes, views, and modifies anban-creator configuration settings. Use when user wants to initialize, view, or modify anban-creator configuration.
user-invocable: true
---

# Anban Creator 配置管理

## 分步初始化配置（Agent 引导流程）

通过 MCP 工具逐步写入配置，支持增量更新（已有字段不会被覆盖）。

### 第一步：微信账号凭证（必填）

向用户获取微信公众号 AppID 和 Secret，通过 MCP 工具设置。

### 第二步：公众号基本信息（可选）

通过 MCP 工具设置公众号名称和作者。

### 第三步：写作风格

在项目配置中填写写作风格描述，或选择后台提供的服务端写作资源。插件目录不再携带本地 writer YAML。

### 第四步：文章主题

在项目配置中选择后台提供的主题资源，或保留默认主题。插件目录不再携带本地 theme YAML。

### 第五步：AI API 配置（可选）

通过 MCP 工具设置 AI API Key 和 Base URL。

### 第六步：图片生成服务（可选）

可选值：`gemini`、`openai`、`volcengine`

## 查看账号信息

调用 `get_project_profile` MCP 工具。
