---
name: seednote-research
description: Analyzes Seednote (种草笔记) topics and scores engagement potential. Use when analyzing Seednote (种草笔记) topics, scoring engagement, or researching trending seednote content.
user-invocable: false
---

# 种草笔记选题研究知识库

## 案例库

遇到场景分支、产物格式或质量边界不确定时，先读 [references/examples.md](references/examples.md)。

## 图片比例固定规则

本 Skill 只要涉及生成、选择、裁切、校验或引用图片，必须按以下优先级决定画面比例：

1. 用户/任务明确指定的 `image_ratio`、`size` 或平台规格优先。
2. 项目/频道默认比例次之。
3. 业务默认比例只作兜底：微信文章封面/正文图默认 `16:9`；Seednote/XLS/移动信息流默认 `3:4`；电商、广告投放、视频封面按具体平台素材位要求执行。
4. 不得从模型路由、供应商默认 `size` 或模型能力反推业务比例；模型只决定能力和成本，比例属于创作场景约束。


## 选题来源（优先选题池，最先执行）

> 仅原创模式适用。复刻模式（用户提供笔记 ID/链接）不做选题。

先确定本次笔记选题，**不要凭空搜**。

**如何判断任务是否已指定主题**（看 user prompt）：含 `create content about: <X>` → `<X>` 是指定主题；是 `research and create content ... choose the optimal theme` 这类让你自己选题的措辞 → 未指定；⚠️ 项目 keywords 不是主题。

1. **任务已指定主题**（user prompt 含 `about: <X>`）→ **直接采用 `<X>`，禁止调 `claim_topic`**（避免与服务端预认领重复消费），把它作为 `search_feeds` 的关键词；评分模型仅作参考。
2. **未指定主题** → 先 `claim_topic(project_id="$PROJECT_ID", task_id="$TASK_ID")`：返回非空 `topic` → 采用，作为 `search_feeds` 关键词；返回 `null`（池空）→ 继续下方研究流程，自行搜索 + 评分选题。

> 选题池是用户预置、希望优先消费的选题。只要池里有，就必须用池里的。

---

## 选题前必做：查看已有选题

在开始选题研究前，调用 `list_project_topics(project_id="$PROJECT_ID")` 查看系统内已有选题列表，避免重复。

---

## xsec_token 工作流

**重要**：大多数 MCP 工具需要 `feed_id` 和 `xsec_token` 两个参数。这两个参数**只能**从 `search_feeds` 或 `list_feeds` 的返回结果中获取，不能凭空构造。

工作流程：
1. 先调用 `search_feeds(keyword=...)` 或 `list_feeds()` 获取 Feed 列表
2. 从返回结果中提取每个笔记的 `feed_id`（或 `id`）和 `xsecToken` 字段
3. 将这两个值传入后续工具调用（如 `get_feed_detail` 等）

---

## MCP 工具用法

```
# 从项目选题池认领下一个未用选题（选题首选来源，池非空必用）
claim_topic(project_id="$PROJECT_ID", task_id="$TASK_ID")

# 搜索相关话题的热门笔记（返回结果包含 feed_id 和 xsecToken）
search_feeds(keyword="<话题关键词>")

# 获取推荐流（了解平台当前推广内容，返回结果包含 feed_id 和 xsecToken）
list_feeds()

# 获取具体笔记详情+评论数据（需从上面的结果提取 feed_id 和 xsec_token）
get_feed_detail(feed_id="<笔记ID>", xsec_token="<从列表结果提取的xsecToken>")
```

---

## 互动率评分模型

评分公式：

```
topic_score = engagement_rate × recency_weight × novelty_bonus
engagement_rate = (likes + favorites + 2×comments) / max(total, 1)
recency_weight: 24h→1.0, 7d→0.8, 30d→0.5, 更早→0.3
novelty_bonus: 同角度笔记<3 → 1.2, 否则 → 1.0
```

计算所有候选选题的 `topic_score`，自动选择得分最高者。评分明细与选题理由写入工作目录的 `topic-analysis.md`。

---

## 内容分析维度

分析热门笔记时，重点提取以下维度：

- **标题模板**：句式、情绪词、字数分布
- **封面模板**：信息层级、文字密度、配色规律
- **正文模板**：开场钩子、段落结构、结尾 CTA 形式
- **评论信号**：高频关键词、用户痛点、争议点
- **标签组合**：核心话题 + 垂直话题 + 长尾话题
