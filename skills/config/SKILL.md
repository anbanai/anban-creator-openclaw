---
name: config
description: 'Use when user wants to initialize, view, or modify anban-creator configuration. Initializes, views, and modifies anban-creator configuration settings.'
user-invocable: true
---

# Anban Creator 配置管理

## 案例库

遇到场景分支、产物格式或质量边界不确定时，先读 [references/examples.md](references/examples.md)。

## 图片比例固定规则

本 Skill 只要涉及生成、选择、裁切、校验或引用图片，必须按以下优先级决定画面比例：

1. 用户/任务明确指定的 `image_ratio`、`size` 或平台规格优先。
2. 项目/频道默认比例次之。
3. 业务默认比例只作兜底：微信文章封面/正文图默认 `16:9`；Seednote/XLS/移动信息流默认 `3:4`；电商、广告投放、视频封面按具体平台素材位要求执行。
4. 不得从模型路由、供应商默认 `size` 或模型能力反推业务比例；模型只决定能力和成本，比例属于创作场景约束。


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
