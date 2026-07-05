---
name: topic-research
description: Researches topics, scores engagement potential, and generates content outlines. Use when researching topics, scoring engagement potential, or generating content outlines.
user-invocable: false
---

# 微信公众号选题分析工具

## 图片比例固定规则

本 Skill 只要涉及生成、选择、裁切、校验或引用图片，必须按以下优先级决定画面比例：

1. 用户/任务明确指定的 `image_ratio`、`size` 或平台规格优先。
2. 项目/频道默认比例次之。
3. 业务默认比例只作兜底：微信文章封面/正文图默认 `16:9`；Seednote/XLS/移动信息流默认 `3:4`；电商、广告投放、视频封面按具体平台素材位要求执行。
4. 不得从模型路由、供应商默认 `size` 或模型能力反推业务比例；模型只决定能力和成本，比例属于创作场景约束。


## MCP 工具

| MCP 工具 | 说明 |
|----------|------|
| `claim_topic` (project_id, task_id?) | 从选题池认领下一个未用选题（选题**首选来源**，池非空必用） |
| `list_project_topics` (project_id) | 查看系统内已有选题（选题前必调） |
| `research_topics` (project_id, keywords?, domain?, count?) | 选题研究 |
| `score_article` (project_id, content, title?, domain?) | 话题评分 |
| `generate_outline` (project_id, topic, template?, domain?, style?, keywords?) | 内容框架生成 |
| `list_drafts` (project_id) | 查看已有草稿 |
| `list_published_articles` (project_id) | 查看已发布文章 |

---

## 核心功能

### 选题来源（优先选题池，最先执行）

选题前先确定本次选题，**不要凭空 research**。

**如何判断任务是否已指定主题**（看 user prompt）：含 `create content about: <X>` → `<X>` 是指定主题；是 `research and create content ... choose the optimal theme` 这类让你自己选题的措辞 → 未指定；⚠️ 项目 keywords 不是主题。

1. **任务已指定主题**（user prompt 含 `about: <X>`）→ **直接采用 `<X>`，禁止调 `claim_topic`**（避免与服务端预认领重复消费）。仍执行「0. 查看已有内容」查重（冲突则调整措辞），通过后跳到「2. 内容框架生成」。
2. **未指定主题** → 先 `claim_topic(project_id="$PROJECT_ID", task_id="$TASK_ID")`：返回非空 `topic` → 采用，执行「0. 查看已有内容」后跳到「2. 内容框架生成」；返回 `null`（池空）→ 继续下方 0～1 的研究流程。

> 选题池是用户预置、希望优先消费的选题。只要池里有，就必须用池里的。

### 0. 查看已有内容（选题前必做）

在开始选题前，先检查已有内容，避免重复主题：

调用 `list_project_topics(project_id)` 查看系统内已有选题列表。

调用 `list_drafts` 和 `list_published_articles` 查看已有内容。

列出所有已有标题和选题后，选题应避开这些已有主题。

### 1. 话题评分

评估话题的爆款潜力：

调用 `score_article`，传入话题内容、标题和领域参数。

### 2. 内容框架生成

基于话题生成内容框架：

调用 `generate_outline`，传入话题、模板、领域、风格和关键词参数。

**可用模板**: authoritative(权威), comparison(对比), cultural(文化), practical(实用)
**可用领域**: general, tea, tech, lifestyle, culture, business, education

**模板详细说明**: 参见 [`references/outline-templates.md`](references/outline-templates.md)

## 注意事项

- 评分结果仅供参考，需结合实际情况判断
- 建议结合多个话题进行对比分析
