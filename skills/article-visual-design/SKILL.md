---
name: article-visual-design
description: Manages images for WeChat article (公众号图文) content including AI generation, compression, and CDN upload. Use when generating or processing images for WeChat articles.
user-invocable: false
---

# 公众号图文图片管理

## MCP 工具

| MCP 工具 | 说明 |
|----------|------|
| `generate_image` (channel_id, prompt, image_type, output_path, task_id, upload_to_cdn?) | 生成单张图片，返回 download_url（始终为可 HTTP fetch 的存储 URL，不再返回 base64 data URL）和 file_path。`upload_to_cdn=true`（**生成与上传原子化**）时在同一调用内完成"生成→保存→压缩→上传微信 CDN"，直接返回 `wechat_url` + `media_id`；上传失败返回 `upload_error`（生成不浪费，仅重试上传） |
| `upload_image` (channel_id, file_path) | 上传**外部/下载来的**图片到微信 CDN，返回 CDN URL。**已生成的图不再用此工具**——生成时直接用 `generate_image(upload_to_cdn=true)` 原子上传；仅作为生成时返回 `upload_error` 的重传兜底 |
| `download_image` (channel_id, url) | 下载在线图片 |
| `compress_image` (file_path) | 压缩图片 |

---

## 封面图生成

封面图使用任务解析的视觉风格（`get_channel_profile` 的 `style`/`style_source`/`template_style`）和服务端图片资源生成。流程：

1. **优先读取任务已解析的视觉风格** `$VISUAL_STYLE_CONFIGURED`（`style` 字段）。若为空，再基于频道定位 + 内容主题 + 受众兜底分析封面视觉方向——**不从 writer YAML 推视觉**（writer 仅决定文字风格）
2. 结合服务端图片预设生成结构化提示词
3. 调用 `generate_image(image_type="cover", output_path="$DIR/cover.png", upload_to_cdn=true)`——**生成与上传原子化**：同一调用内完成生成→保存→压缩→上传微信 CDN，直接返回 `wechat_url` + `media_id`（封面 thumb）
4. 从 `generate_image` 返回值取 `media_id`（用于发布草稿的 thumb）+ `wechat_url`。**无需单独调用 `upload_image`**。若返回 `upload_error`（生成成功但上传失败），用 `upload_image(file_path="$DIR/cover.png")` 单独重传即可，**无需重新生成**

**封面视觉风格记录**：若 `$VISUAL_STYLE_CONFIGURED` 为空，则从实际生成结果中提取 `$COVER_STYLE`，作为章节配图的兜底风格基准；若 `$VISUAL_STYLE_CONFIGURED` 非空，封面生成须向该锚点收敛，配图风格前缀以 `$VISUAL_STYLE_CONFIGURED` 为准。

---

## 章节配图设计与生成

章节配图设计是独立的分析步骤，在文章定稿后执行。这是确保配图与文章内容关联性的核心环节。

### 为什么要独立分析

写作步骤专注于文字质量，配图需要专门的视觉设计分析：
- 写作 LLM 同时写文章和配图提示词时，提示词通常过于简短和通用
- 独立分析步骤可以充分理解每个章节的上下文和全文脉络
- 可以确保所有配图风格一致且与封面协调

### 设计流程

对文章中每个 `##` 章节，按以下步骤执行：

#### 步骤 1：确定统一风格前缀（视觉来源：任务解析的 `style` 字段）

公众号模板由三个**正交**维度组成：图片视觉（`style`）、写作风格（`writing_style`）、排版样式（`theme`）。三者各自独立解析，互不推导——**写作风格绝不决定图片视觉**。

视觉风格**优先**取自 `get_channel_profile` 返回的任务已解析字段（按 `task > template > plan > channel` 解析）：
- `$VISUAL_STYLE_CONFIGURED` = profile 的 `style` 字段（解析后的视觉风格描述/关键词）
- `$TEMPLATE_VISUAL_STYLE` = profile 的 `template_style` 字段（任务带模板时）
- `$VISUAL_STYLE_SOURCE` = profile 的 `style_source`（task / template / plan / channel）

**关键规则**：
- 若 `$VISUAL_STYLE_CONFIGURED` 非空 → 它是**权威视觉锚点**，所有配图风格前缀以它为核心，**不得偏离**到冲突风格（如配置了"温暖自然的生活摄影"就不得生成维多利亚木刻/黑白版画）。
- 若 `$VISUAL_STYLE_CONFIGURED` 为空（所有层级都未配置视觉）→ 由封面生成步骤（见下文"封面图生成"）从账号定位 + 内容主题 + 受众兜底分析得出 `$COVER_STYLE`，再传递给配图。
- **不从 writer YAML 推视觉**（writer 仅决定文字风格，已不再携带任何视觉/封面字段）。

基于 `$VISUAL_STYLE_CONFIGURED`（优先）或 `$COVER_STYLE`（兜底），确定适用于所有配图的风格前缀：

格式：`[视觉风格名称], [色调], [构图风格], [技术风格]`

#### 步骤 2：逐章节分析与生成

对每个 `##` 章节执行：

**2a. 提取章节上下文**

- **核心论点**：该章节要传达的关键信息（1句话）
- **情感基调**：理性分析、温暖鼓励、犀利批判、诗意沉思、轻松幽默等
- **具体素材**：章节中使用的案例、比喻、场景描述、引用等

**2b. 设计提示词**

将风格前缀 + 章节分析整合为英文提示词（150-300字符）：

```
[风格前缀] + [具体场景/物体描述] + [视觉隐喻或细节] + [情绪色调和氛围] + [构图指导]
```

要求：
- 优先使用章节中已有的比喻或案例作为视觉主体
- 避免抽象通用描述（如"商务场景"、"科技背景"）
- 不同章节的提示词必须有明显区别

**2c. 生成并上传（原子化）**

1. 调用 `generate_image`（`channel_id`, `prompt`, `image_type="content"`, `output_path="$DIR/img_N.png"`, `task_id`, **`upload_to_cdn=true`**）——**生成与上传原子化**：同一调用内完成生成→保存→压缩→上传微信 CDN，返回值直接带 `wechat_url` + `media_id`。**不再有独立的 `upload_image` 阶段**。若返回 `upload_error`（生成成功但上传失败），用 `upload_image(file_path="$DIR/img_N.png")` 单独重传即可，**无需重新生成**
2. **每张图返回后立即原子写 `images.json`**：先写临时文件 `$DIR/.images.json.tmp` → `fsync` → `rename` 覆盖 `$DIR/images.json`。绝不要"攒齐所有图再一次性写"——每张图返回即落盘，使中断最多丢失"正在生成的那一张"，已上 CDN 的全部安全
3. 从 `generate_image` 返回值取 `wechat_url`（即 CDN URL），将 `![描述](wechat_url)` 插入到章节关键段落之后（不紧跟 `##` 标题，不在章节末尾）

**示例**（假设章节讨论"拖延的本质是自我保护"，风格为维多利亚版画）：

```
Victorian woodcut etching style, black and white with cross-hatching. A figure standing at the edge of a thick fog, reaching out but hesitating, the fog forming soft protective walls around them. Contemplative and empathetic atmosphere, dramatic composition with negative space, editorial illustration
```

#### 步骤 3：保存结果

- 将含 CDN 图片链接的文章覆盖写回 `$DIR/04-article-final.md`
- 将所有配图信息保存为 `$DIR/images.json`（含 index, prompt, file_path, url, **wechat_url**, **media_id**）。每张图生成返回后即原子落盘（见 2c），不复述

---

## 技术规范

**微信图片限制**：
- 最大尺寸：10MB（超出会被自动压缩）
- 最大宽度：1920px（保持比例压缩）
- 支持格式：JPG、PNG、GIF、WebP

**公众号常用比例**：
- 正文配图：16:9 或 4:3 横版
- 封面图（公众号封面）：2.35:1（900x383px 标准）
- 正方形配图：1:1
