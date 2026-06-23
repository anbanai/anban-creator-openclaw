---
name: article
description: 微信公众号图文文章全自动创作。用户提到"写文章"、"写一篇"、"发文章"、"公众号文章"、"推文"时使用此 skill。
user-invocable: true
---

# /article 微信公众号文章创作命令

## 强制执行声明

**你正在执行微信公众号文章创作任务。你必须使用工具（MCP 工具、Write、Bash、TaskCreate 等）完成完整的创作流水线。**

**禁止直接用文字回答用户的主题问题。** 你不是在回答问题，你是在创作一篇微信公众号文章。如果你直接输出文字回答而没有使用任何工具，说明你理解错了任务。

用户输入 `/article` 后面的内容是创作主题，不是让你回答的问题。

---

## 必须执行的步骤

按顺序执行以下步骤。每一步都必须调用对应的工具，不能跳过。

### Phase 1: 信息收集

### 步骤 1：获取频道信息与工作目录

**频道选择（必须先完成，再调用频道 API）：**

- 检查 `$ANBANWRITER_DEFAULT_CHANNEL` 环境变量，非空则直接使用
- 否则调用 `list_channels(platform="article")`，**仅根据** `name`、`positioning`、`keywords` 语义匹配或让用户选择 → `$CHANNEL_ID`
- **⚠️ 禁止基于 API 可用性选择频道**：不要对多个频道调用 `get_channel_profile`/`list_published_articles` 来评估哪个"可用"。频道选择仅依据 `list_channels` 返回的 `name`、`positioning`、`keywords`。选定频道后，即使后续 API 调用返回错误也不得切换到其他频道

**频道选定后，仅对 `$CHANNEL_ID` 调用：**

- `get_channel_profile(channel_id="$CHANNEL_ID", scope="article", task_id="$TASK_ID")` → 获取账号定位、受众、写作风格。`task_id` 让服务端额外返回任务关联模板的内容脚手架（`template_writing_style` 写作风格 / `template_structure` 内容结构 / `template_example` 示例），若返回了这些字段，创作正文与配图时必须严格遵守；不传则只拿到 channel 级信息。
- `list_drafts(channel_id="$CHANNEL_ID")` 和 `list_published_articles(channel_id="$CHANNEL_ID")` → 已有文章标题（如返回错误可忽略，用空列表继续）
- `prepare_workspace(content_type="articles", task_id=TASK_ID)` → 工作目录路径 `$DIR`
- Bash 执行 `mkdir -p "$DIR"` 创建目录

### 步骤 2：选题研究

using the topic-research skill 结合账号关键词和用户需求搜索热门话题，创作文章大纲。产出：
- `$DIR/01-research.md` — 选题分析和关键词
- `$DIR/02-outline.md` — 文章大纲（≥3 个二级标题）

### Phase 2: 内容创作

### 步骤 3：撰写文章

using the content-writing skill 基于账号定位和大纲输出 Markdown 格式文章。**写作时不需要插入配图占位符**（配图由步骤 7 专门处理）。产出：
- `$DIR/03-article.md` — 完整文章内容

### 步骤 4：AI 去痕与合规检查

using the content-writing skill 先执行 AI 去痕（`gentle` 模式），再执行违禁词合规检查。产出：
- `$DIR/04-article-final.md` — 检查后的文章

### Phase 3: SEO 与视觉

### 步骤 5：SEO 优化

using the seo-optimization skill 优化标题、关键词、摘要。将优化后的标题和摘要保存为 `$DIR/seo-result.md`，供步骤 9 使用。

### 步骤 6：生成封面图

using the article-visual-design skill 生成封面图。**视觉风格优先取自任务解析的 `style` 字段**（通过 `get_channel_profile` 的 `style`/`style_source`/`template_style` 返回），**不使用 writer YAML 的 `cover_prompt`/`cover_style`**（writer 仅决定文字风格）。调用 `generate_image(upload_to_cdn=true)` **生成与上传原子化**——同一调用内完成生成→压缩→上传微信 CDN，直接返回 `media_id` + `wechat_url`，**不再单独调用 `upload_image`**。若返回 `upload_error`（生成成功但上传失败），用 `upload_image(file_path="$DIR/cover.png")` 单独重传即可，无需重新生成。记录封面视觉风格（`$COVER_STYLE`，配置锚点为空时由封面生成兜底得出）。产出：
- `$DIR/cover.png` — 封面图
- `media_id` — 微信素材 ID（来自 `generate_image(upload_to_cdn=true)` 返回值）
- `wechat_url` — 封面 CDN 链接
- `$COVER_STYLE` — 封面视觉风格（兜底；优先用 `$VISUAL_STYLE_CONFIGURED`）

### 步骤 7：配图设计与生成

using the article-visual-design skill 执行完整的配图分析与生成：

1. 基于 `$COVER_STYLE` 确定统一的风格前缀
2. 逐章节分析 `$DIR/04-article-final.md` 内容（核心论点、情感基调、具体素材）
3. 为每个 `##` 章节设计配图提示词（风格前缀 + 章节具体内容）
4. 对每个章节：调用 `generate_image(upload_to_cdn=true)` **生成与上传原子化**——同一调用内完成生成→压缩→上传微信 CDN，返回值直接含 `wechat_url`/`media_id`，**不再有独立的 `upload_image` 阶段**；将 `![描述](wechat_url)` 插入章节。**每张图返回后立即原子写 `images.json`**（临时文件 + rename），再处理下一张——使中断最多丢失"正在生成的那一张"，已上 CDN 的全部安全
5. 覆盖写回 `$DIR/04-article-final.md`，保存 `$DIR/images.json`（每条记录含 `wechat_url` + `media_id` 字段）

产出：
- 更新后的 `$DIR/04-article-final.md` — 含 CDN 图片链接
- `$DIR/images.json` — 所有配图信息

### Phase 4: 组装发布

### 步骤 8：转换 HTML

using the content-writing skill 转换 HTML，图片由 `convert_markdown` 命令读取 images.json 自动替换为 CDN 链接。产出：
- `$DIR/05-article.html`

### 步骤 9：发布到草稿箱

using the article-publishing skill 从 `$DIR/seo-result.md` 读取优化后的标题和摘要，创建 `draft.json` 并发布。产出：
- `$DIR/draft.json`

---

## 自动决策原则

**全程零用户交互**。所有决策点自动选择最优解（频道选择是唯一例外——多个频道无法匹配时需让用户选择）：

| 决策点 | 自动策略 |
|--------|----------|
| **选题方向** | 结合账号关键词 + 用户需求 + 历史文章去重，自动选 Top 1 |
| **文章结构** | 根据选题类型自动匹配结构模板（教程/清单/故事/分析） |
| **配图设计** | 文章定稿后由专门的视觉分析步骤逐章节设计，提示词深度关联章节内容 |
| **视觉风格** | 优先取自任务解析的 `style` 字段（`get_channel_profile` 的 `style`/`style_source`/`template_style`），配置为空时由封面生成兜底；**不使用 writer YAML 的 `cover_style`**。配图通过统一风格前缀保持一致 |
| **SEO 优化** | 自动提取关键词，生成标题/摘要/标签，结果用于草稿发布 |
| **AI 去痕** | 自动检测并移除 5 类 AI 模式（内容/语言/风格/填充/协作痕迹） |
| **错误处理** | 自动重试 + 降级，非关键步骤跳过继续 |

## MCP 工具使用规则

- **必须使用 MCP 工具调用服务端接口**（如 `list_channels`、`generate_image` 等）
- **禁止编写 JavaScript/Node.js/Python 脚本或创建自定义 HTTP 客户端来调用 MCP 接口**
- **如果 MCP 工具不可用或调用失败，立即停止并报告错误**，不要尝试自行发现、探测或创建替代连接方式
- **`prepare_workspace` / `archive_workspace` 仅返回路径，目录创建和文件移动由 agent 本地执行**

## 质量标准

- 有标题和清晰结构（至少 3 个二级标题）
- 字数符合用户要求或文章类型的合理长度
- 无明显 AI 痕迹，无违禁词
- 有价值、有见地、语言自然
- 封面图必须成功生成并上传（硬性要求）
- **配图与内容关联**（硬性要求）：每个配图提示词必须包含对应章节的具体概念
- **图文并茂**（硬性要求）：每个 `##` 章节至少一张配图
- **风格统一**：所有配图使用统一的风格前缀保持视觉一致
- 草稿使用 SEO 优化后的标题和摘要

### 平台合规检查

合规检查由 skill `content-writing` 执行，关键要点：
- **封面图**：人物五官完整、无马赛克/播放标记、画质清晰
- **标题**：准确反映内容、无省略号隐藏关键信息
- **内容**：语言文明、无低俗擦边、无暴力宣扬

---

## 风险与缓解措施

| 风险 | 缓解措施 |
|------|----------|
| **选题与历史文章重复** | 自动跳过重复选题，选择次优候选 |
| **文章结构不清晰** | 自动匹配结构模板，确保至少 3 个二级标题 |
| **封面生成失败** | 重试两次（不同 prompt 措辞），仍失败则请求用户协助 |
| **配图提示词设计质量差** | 提示词必须引用章节具体内容，风格前缀统一 |
| **单张配图生成失败** | 重试一次（更换提示词），仍失败则标记该章节缺图，继续后续章节 |
| **超过一半章节配图失败** | 暂停流程，请求用户协助 |
| **AI 去痕过度** | 使用 `gentle` 模式，保留作者风格 |
| **违禁词检测误报** | 记录疑似词，人工复核标记，不自动删除 |
| **HTML 转换失败** | 检查 Markdown 格式，修复语法错误后重试 |
| **草稿创建失败** | 检查 draft.json 格式和 media_id 有效性 |

---

## 成功标准

- [ ] 工作目录创建成功，`$DIR` 路径有效
- [ ] `01-research.md` 包含选题分析和关键词
- [ ] `02-outline.md` 包含清晰的文章结构（≥3 个二级标题）
- [ ] `03-article.md` 包含完整文章内容
- [ ] `04-article-final.md` 无 AI 痕迹，无违禁词
- [ ] `seo-result.md` 包含优化后的标题和摘要
- [ ] 封面图 `$DIR/cover.png` 存在且可访问
- [ ] 封面图已上传，获得有效 media_id
- [ ] `04-article-final.md` 中每个 `##` 章节都有 CDN 图片链接
- [ ] 每个配图提示词包含对应章节的具体概念（非通用描述）
- [ ] 所有章节配图生成并上传成功（每个 `##` 章节至少一张）
- [ ] `images.json` 包含所有配图的 CDN 链接
- [ ] `05-article.html` 转换成功，图片链接有效
- [ ] `draft.json` 使用了 SEO 优化后的标题和摘要
- [ ] 草稿创建成功，可通过公众号后台查看

---

## 错误处理

**非关键步骤失败**（SEO优化、AI去痕）：记录问题，使用降级方案继续，在最终报告中说明。

**配图步骤失败**（单张配图生成失败）：重试一次，仍失败则记录该章节缺少配图继续后续章节。如果超过一半章节配图失败，暂停流程请求用户协助。

**关键步骤失败**（封面生成、草稿创建）：暂停流程，分析原因，尝试重试一次，仍失败则请求用户协助。

**配置问题**：假定配置已正确设置，不要尝试验证配置。如果 MCP 工具因配置问题失败，直接报告错误信息并继续流程。

## 工作规范

### 文件组织

- 每篇文章使用独立目录（步骤 1 创建，变量 `$DIR`）
- 编号命名（01-research.md, 02-outline.md...）
- 使用标准格式：Markdown（.md）、JSON（.json）、HTML（.html）
- 图片统一保存在 `$DIR/` 下（cover.png, img_01.png 等）

### 任务追踪

- 流程启动时用 TaskCreate 创建任务列表
- 每个任务对应一个流程步骤
- 开始前：`TaskUpdate status → in_progress`
- 完成后：`TaskUpdate status → completed`
- 设置依赖：每个任务 blockedBy 前一个任务
- 报告进度：`[3/9] 文章撰写完成 → $DIR/03-article.md (2,847字)`

## 最佳实践

1. **配图设计是独立步骤**：文章定稿后由步骤 7 专门处理，不与写作步骤混合
2. **配图必须关联内容**：每个配图提示词必须引用章节中的具体概念、比喻或案例
3. **风格从封面传递**：封面图确立视觉风格基准，通过风格前缀传递给所有配图
4. **结构清晰**：至少 3 个二级标题，使用教程/清单/故事/分析模板
5. **AI 去痕适度**：使用 `gentle` 模式，保留作者风格
6. **SEO 结果回写**：优化后的标题和摘要用于最终草稿
7. **决策透明记录**：选题、结构、风格选择写入文件，便于追溯

配图设计流程、封面合规、违禁词检查等详见各 skill 文档。

---

## 红旗检查清单

流程中出现以下情况时需要特别关注：

- [ ] 文章缺少二级标题（<3 个）→ 需补充结构
- [ ] 章节缺少配图 → 需在步骤 7 补充
- [ ] 配图提示词为通用描述（如"美丽风景"、"商务场景"）→ 需重写为章节具体内容
- [ ] 配图提示词未引用章节中的比喻或案例 → 需加强关联
- [ ] 封面图包含马赛克/播放标记 → 需重新生成
- [ ] 标题使用省略号隐藏关键信息 → 需补全信息
- [ ] 文章字数过短（<500 字）→ 需扩展内容
- [ ] AI 痕迹明显（5 类模式检测得分低）→ 需加强去痕
- [ ] 违禁词报告显示高风险词汇 → 需人工复核
- [ ] 配图风格不一致 → 检查风格前缀是否统一
- [ ] HTML 文件过大（>1MB）→ 需精简内联样式

---

## 分阶段交付策略

当文章较长时，按以下阶段独立交付：

- **阶段 1 - 选题与大纲**：完成选题分析、关键词提取、文章大纲（`01-research.md`, `02-outline.md`）
- **阶段 2 - 内容创作**：完成文章撰写、AI 去痕、合规检查（`03-article.md`, `04-article-final.md`）
- **阶段 3 - SEO 与视觉**：完成 SEO 优化、封面图生成、配图设计与生成
- **阶段 4 - 发布准备**：完成 HTML 转换、草稿创建

每个阶段完成后可独立验证，配图生成可分批进行。
