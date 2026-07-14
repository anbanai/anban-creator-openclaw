---
name: seednote
description: 'Use when 种草笔记图文全自动创作。用户提到"种草笔记"、"seednote"、"种草"、"复刻"、"仿写"、"改写笔记"、"爆款改写"、"克隆"、"clone"时使用此 skill。'
user-invocable: true
---

# /seednote 种草笔记内容创作命令

## 案例库

遇到场景分支、产物格式或质量边界不确定时，先读 [references/examples.md](references/examples.md)。

## 图片比例固定规则

本 Skill 只要涉及生成、选择、裁切、校验或引用图片，必须按以下优先级决定画面比例：

1. 用户/任务明确指定的 `image_ratio`、`size` 或平台规格优先。
2. 项目/频道默认比例次之。
3. 业务默认比例只作兜底：微信文章封面/正文图默认 `16:9`；Seednote/XLS/移动信息流默认 `3:4`；电商、广告投放、视频封面按具体平台素材位要求执行。
4. 不得从模型路由、供应商默认 `size` 或模型能力反推业务比例；模型只决定能力和成本，比例属于创作场景约束。


## 强制执行声明

**你正在执行种草笔记内容创作任务。你必须使用工具（MCP 工具、Write、Bash、TaskCreate 等）完成完整的创作流水线。**

**禁止直接用文字回答用户的主题问题。** 你不是在回答问题，你是在创作一篇种草笔记。如果你直接输出文字回答而没有使用任何工具，说明你理解错了任务。

用户输入 `/seednote` 后面的内容是创作主题，不是让你回答的问题。

---

## 图片构成规则（运行控制）

> 图片构成以结构化运行控制 `seednote_image_mode` 为准。缺失时按 `cover_content`。四种模式：`cover_only`（仅封面）、`cover_content`（封面 + 1~3 张内容图）、`cover_tail`（封面 + 尾图）、`full`（封面 + 1~3 张内容图 + 尾图）。未包含尾图的模式禁止生成 `tail.png`，`image-plan.md` 不得含 `## tail` 节；未包含内容图的模式禁止生成 `image_0N.png`。

## Seednote 视觉方法论

Seednote 最终图片产物由 `generate_image` MCP 生成；本地文件只承载规划、Prompt 蓝图、生成记录和质量复盘。图片链路按以下方法执行：

1. **内容蒸馏**：从 `$DIR/content.md` 提取主题、卖点、情绪、证据、关键短句和每页承载的信息密度。
2. **视觉策略**：先确定统一色彩、画面主体、标题层级、信息密度和内容页节奏，再写入 `$DIR/image-plan.md`。社交图文视觉原则用于提升模型出图方向：`editorial 信息层级` 让主标题、辅助信息、证据点和视觉主体各司其职；`Swiss/magazine 秩序感` 用留白、对齐、分组和对比服务移动端可读性；`图文节奏` 要求封面负责点击，内容图负责理解，尾图负责收束。
3. **Prompt 蓝图**：每张图都有角色、可见文案、视觉主体、构图层级、风格延续和验收标准；Prompt 只描述要得到的画面效果和内容关系。
4. **生成记录**：每次调用 `generate_image` 后，把实际 prompt、`provider`、`model`、`output_path`、返回字段和修订信息写入 `$DIR/image-prompts.md`。
5. **质量复盘**：逐图写 `$DIR/image-review.md`，检查主题相关度、文字准确性、移动端可读性、风格一致性和是否符合 `seednote_image_mode`。

如果图片 API、视觉核验依赖或重试预算失败，写 `$DIR/image-review.md` 与结构化 `$DIR/failure-state.json` 后停止。每张图必须通过 `generate_image(..., verify_with_vision=true, verification_prompt=<动态核验提示词>)` 原子核验；禁止用 prompt 质量、文件尺寸或 MIME 代替视觉核验。

---

<!-- seednote-reference-contract:start -->
## 多参考素材自动决策流程

1. 先读取用户统一提示词、项目资料、`.anban-creator/input-attachments/index.json` 和可选的 `errors.json`，写出 `request-analysis.json` 与 `request-analysis.md`。此阶段不得先分析图片。
2. 遍历 `index.json` 中每张可用图片。针对已完成的需求分析和该图片的可选 `instruction`，动态编写该图片独有的 `analyze_image` prompt；每张可用图片都必须分析，单张最多 3 次理解尝试。`errors.json` 中的条目必须记为 `analysis_failed`；若它是产品身份、Logo、包装、型号或核心结构的唯一证据则停止任务，其他素材能可靠补足时才可继续并记录依据。
3. 写出 `reference-analysis.json` 与 `reference-analysis.md`，记录可见事实、不确定性、需求支持点、可参考维度、必须保持、必须避免、不可推出结论，并完成同产品/系列/型号、新旧包装、角度、事实图/氛围图、Logo/文字/颜色/结构冲突分析。
4. 写出 `image-plan.md`。对每张输出图独立决定使用 0、1 或多张附件，记录附件编号、每张用途、保持项、禁止项。不得把所有素材传给所有页面；超过服务端返回的数量上限时按当页相关性排序选择子集。
5. 写出 `image-prompts.md`。调用 `generate_image` 时只传当前输出图相关的原始路径，数组顺序必须与 prompt 中“参考图 1、参考图 2”一致。不得传分析后的截图、拼图或转码替代原图。
6. 每张生成图片都在 `generate_image` 中传 `verify_with_vision=true` 和动态 `verification_prompt`，以服务端 `verification.passed` 作为唯一通过依据并写入 `image-review.md`；`analyze_image` 只用于理解输入参考图。
7. 核验不通过时自动调整参考组合/顺序、生成 prompt、保持项/禁止项、构图复杂度或核验 prompt。每张输出图最多 3 次生成尝试，初次生成计入。不得请求用户决定。
8. 写出 `reference-usage-summary.json`。关键事实无法保证时任务失败；非关键氛围或轻微构图问题可保留并记录 warning。
<!-- seednote-reference-contract:end -->

## 参考素材追踪产物与失败策略

每次运行都必须归档以下 8 个产物；即使任务失败，也不得删除已经写出的文件：

```text
request-analysis.json
request-analysis.md
reference-analysis.json
reference-analysis.md
image-plan.md
image-prompts.md
image-review.md
reference-usage-summary.json
```

`reference-usage-summary.json` 使用以下结构；`status` 使用 `used`、`excluded` 或 `analysis_failed`，模型字段记录服务端实际返回值：

```json
{
  "version": "1.0",
  "inputs": [
    {
      "attachment_index": 1,
      "file_name": "attachment_01_front.png",
      "url": "https://example.invalid/front.png",
      "instruction": "保持包装和 Logo",
      "status": "used",
      "decision_summary": "正面图是产品身份和包装文字的主要证据",
      "analysis_attempts": 1,
      "warnings": []
    }
  ],
  "outputs": [
    {
      "file_name": "cover.png",
      "references": [{ "attachment_index": 1, "purpose": "保持产品身份、包装和 Logo" }],
      "generation_attempts": 2,
      "verification": { "passed": true, "score": "high", "missing_entities": [], "notes": "产品身份、包装和当页文字核验通过" },
      "provider": "openai",
      "model": "gpt-image-2",
      "selection_reason": "reference_compatible_fallback"
    }
  ],
  "warnings": [],
  "model_fallback_reason": "首选模型的参考图上限不足，服务端选择了兼容模型"
}
```

执行预算固定为：每张输入图最多 3 次理解尝试；每张输出图最多 3 次生成尝试，首次生成计入。不得向用户发起中途确认，也不得把参考素材选择、模型回退或重试决策转交给用户。

关键失败包括：唯一产品身份、Logo、包装、型号或核心结构证据不可用；身份或结构幻觉；冲突版本融合；出现禁止内容；页面无法履行职责。遇到关键失败时停止在当前阶段，但必须保留已生成文件和 trace artifacts，记录失败阶段和下一步建议，后续从失败阶段恢复。非关键氛围或轻微构图问题只记录 warning，不得把它升级成需要用户中途决策的阻塞。

停止时写入 `failure-state.json`：`{"version":"1.0","status":"recoverable_failure","stage":"<stage>","error_code":"<stable_code>","message":"<原始错误摘要>","resume_from":"<stage>"}`。该文件表示任务未成功，供完成校验使用。

恢复运行时必须保留旧的 `failure-state.json`，直到 `resume_from` 指向的阶段已成功重做、全部完成条件已满足且即将归档；此时删除旧失败态再调用 `archive_workspace`。不得在恢复开始时提前删除，也不得让已解决的失败态进入成功归档。

---

## 角色

你是种草笔记内容创作的全自动引擎，端到端执行从选题到图片生成的完整流水线。专注高质量种草笔记、生活方式、垂直内容的图文创作。支持**原创模式**和**复刻模式**两种工作路径。

## 自动决策原则

**全程零用户交互**。所有决策点自动选择最优解：

| 决策点 | 自动策略 |
|--------|----------|
| **模式选择** | 用户提供笔记 ID/链接 → 复刻模式；否则 → 原创模式 |
| 视觉与参考素材 | 先分析需求和全部可用附件，再按每页职责选择 0、1 或多张原图；没有相关参考时动态设计风格 |
| 错误 | 研究和写作按对应 skill 的重试链处理；图片 API 失败时记录失败态并停止在图片阶段，等待修复后从该阶段重试 |

决策过程透明记录在 `$DIR/*.md` 文件中，不向用户提问。

## MCP 工具使用规则

- **必须使用 MCP 工具调用服务端接口**（如 `list_projects`、`generate_image` 等）
- **禁止编写 JavaScript/Node.js/Python 脚本或创建自定义 HTTP 客户端来调用 MCP 接口**
- **如果 MCP 工具不可用或调用失败，立即停止并报告错误**，不要尝试自行发现、探测或创建替代连接方式
- **`prepare_workspace` / `archive_workspace` 仅返回路径，目录创建和文件移动由 agent 本地执行**

---

## 原创模式流程（默认）

按顺序执行以下步骤。每一步都必须调用对应的工具，不能跳过。

### 步骤 1：获取账号信息

**先解析 `$TASK_ID`**：检查 CWD 下是否存在 `.task-context` 文件，从中读取 `TASK_ID=xxx`；否则使用 CWD 目录名作为 `$TASK_ID`。后续所有需要 task_id 的 MCP 工具调用都复用此值。

检查环境变量 `ANBAN_DEFAULT_PROJECT`，若非空则直接使用其值作为 `$PROJECT_ID`，跳到下一步。若为空，调用 MCP 工具：
- `list_projects(platform="seednote")` → 获取项目列表。如果只有一个匹配项目，记为 `$PROJECT_ID`；如果有多个匹配项目，根据用户需求与项目 `name`、`positioning`、`keywords` 计算相关性，并按“相关性降序、`project_id` 升序”稳定排序后自动选择第一名，把候选和依据写入 `request-analysis.md`，不得询问用户
- `get_project_profile(project_id="$PROJECT_ID", scope="seednote", task_id="$TASK_ID")` → 获取账号定位、关键词等信息。`task_id` 让服务端用任务派生的模板风格覆盖 project 默认风格（`visual_style_source="task"`），不传则只拿到 project 级风格。
- `list_project_titles(project_id="$PROJECT_ID")` → 查看系统内已有标题，后续标题避开

### 步骤 2：选题研究

using the seednote-research skill；Agent-Reach 健康时采集真实热门笔记数据，不可用时基于用户主题、选题池、账号画像和已有标题继续。自动选 Top 1，把外部评分或降级依据写入 `$DIR/topic-analysis.md`。原创模式不得因 Agent-Reach 不可用写 `failure-state.json`，也不得把降级判断描述成外部热门数据。

### 步骤 3：创建工作目录

调用 `prepare_workspace(content_type="seednote", task_id="$TASK_ID")` MCP 工具获取工作目录路径，变量记为 `$DIR`，然后通过 Bash 执行 `mkdir -p "$DIR"` 创建目录。

### 步骤 4：创作内容

using the seednote-writing skill 生成标题、正文和话题标签，内容保存到 `$DIR/content.md`

### 步骤 5：图片生成

using the seednote-visual-design skill，传入 `$DIR/content.md`，技能内部按 `seednote_image_mode` 完成内容蒸馏、视觉策略、Prompt 蓝图、图片内容规划（`$DIR/image-plan.md`）和全部图片生成。每张图都通过带 `verify_with_vision=true` 和动态 `verification_prompt` 的 `generate_image` 原子生成、登记与核验，并写入 `$DIR/image-prompts.md` 和 `$DIR/image-review.md`。生成后检查每张图片；API 或核验依赖失败时写 `failure-state.json` 并停止。

### 步骤 6：违禁词合规检查

using the seednote-writing skill 扫描标题与正文，生成 `$DIR/compliance-report.md`

### 步骤 7：归档工作目录

从 `$DIR/content.md` 提取最终标题，调用 `archive_workspace(content_type="seednote", name="{标题}")` 获取归档路径 `$ARCHIVE_DIR`，然后通过 Bash 执行 `mkdir -p "$ARCHIVE_DIR" && mv "$DIR"/* "$ARCHIVE_DIR/" 2>/dev/null` 移动文件。归档后向用户报告成果目录路径。

---

## 复刻模式流程（用户提供笔记 ID 或链接时）

### 步骤 1：获取账号信息

**先解析 `$TASK_ID`**（若尚未解析）：检查 CWD 下是否存在 `.task-context` 文件，从中读取 `TASK_ID=xxx`；否则使用 CWD 目录名作为 `$TASK_ID`。

检查环境变量 `ANBAN_DEFAULT_PROJECT`，若非空则直接使用其值作为 `$PROJECT_ID`，跳到步骤 2。若为空，调用 MCP 工具：
- `list_projects(platform="seednote")` → 获取项目列表。如果只有一个匹配项目，记为 `$PROJECT_ID`；如果有多个匹配项目，根据用户需求与项目 `name`、`positioning`、`keywords` 计算相关性，并按“相关性降序、`project_id` 升序”稳定排序后自动选择第一名，把候选和依据写入 `request-analysis.md`，不得询问用户
- `get_project_profile(project_id="$PROJECT_ID", scope="seednote", task_id="$TASK_ID")` → 获取账号信息。`task_id` 让服务端用任务派生的模板风格覆盖 project 默认风格（`visual_style_source="task"`）。

### 步骤 2：获取源笔记

using the seednote-research skill 通过 Agent-Reach 获取源笔记详情、互动数据和评论数据，写入 `$DIR/source-note.md`；仅有外部 ID/链接且仍无法取得源内容时写结构化失败态并停止

### 步骤 3：分析源笔记模板

using the seednote-writing skill 分析源笔记，结果写入 `$DIR/source-analysis.md`。额外提取**视觉结构模板**：图片总张数（含封面）、各内容页主题关键词；若无法提取，记录"视觉结构：无法提取"，`tight` 模式图片规划自动降级为 `medium`

### 步骤 4：创建工作目录

调用 `prepare_workspace(content_type="seednote", task_id="$TASK_ID")` MCP 工具获取工作目录路径，变量记为 `$DIR`，然后通过 Bash 执行 `mkdir -p "$DIR"` 创建目录。

### 步骤 5：按改写模式生成内容

using the seednote-writing skill 根据用户指定或默认模式改写，内容保存到 `$DIR/content.md`，决策记录到 `$DIR/source-analysis.md`

### 步骤 6：图片生成

using the seednote-visual-design skill，传入 `$DIR/content.md`、改写模式和源笔记视觉结构，技能内部自动适配并完成内容蒸馏、视觉策略、Prompt 蓝图、规划、生成记录和质量复盘。每张图通过带服务端视觉核验的 `generate_image` 生成，保存到 `$DIR/`；图片 API 或核验失败时写 `failure-state.json` 并停止。

### 步骤 7：违禁词合规检查

using the seednote-writing skill 扫描标题与正文，生成 `$DIR/compliance-report.md`

### 步骤 8：归档工作目录

从 `$DIR/content.md` 提取最终标题，调用 `archive_workspace(content_type="seednote", name="{标题}")` 归档。归档后向用户报告完整的成果目录路径。

---

## 红旗检查清单

流程中出现以下情况时需要特别关注：

- [ ] 图片数量与 image-plan.md「计划图片数量」声明不符 → 需核对规划与实际产物
- [ ] 封面与内容图风格明显不一致 → 需重新生成
- [ ] `image-plan.md` 信息点模糊（无具体数字/场景/细节）→ 需补充具体内容
- [ ] 同一信息点在多张图片重复 → 需重新规划
- [ ] 复刻模式下 `tight` 模式但视觉结构标记"无法提取" → 已自动降级为 `medium`
- [ ] 违禁词报告显示高风险词汇 → 需人工复核

---

## 质量标准

- 所有图片保持视觉一致性：优先使用配置的参考图作为风格基准，无配置时先生成封面确立基准风格，再以封面为参考批量生成其余图片
- 图片文件均存在且可访问（数量符合 image-plan.md 声明）

---

## 风险与缓解措施

| 风险 | 缓解措施 |
|------|----------|
| **选题评分无高分候选** | 自动选择最高分选题，在 `topic-analysis.md` 记录评分分布，不中断流程 |
| **参考素材不可用** | 非关键素材记录 warning；唯一关键产品证据不可用时保留产物并进入可恢复失败态 |
| **图片 API 失败** | 记录 provider/model/output_path/error/下一步建议，图片阶段进入可恢复失败态 |
| **图片质量不达标** | 按 seednote-visual-design 的质量复盘结果收紧 Prompt 蓝图后重试同一图片 |
| **源笔记获取失败** | 按 Agent-Reach 对应 backend 的重试链重试一次，仍失败则停止并报告 |
| **视觉结构模板提取失败** | 自动降级为 `medium` 模式，按常规流程规划图片 |
| **违禁词检测误报** | 记录疑似词，人工复核标记，不自动删除 |
| **归档目录已存在** | 自动追加序号（如 `标题-2/`），确保目录唯一 |

---

## 成功标准

- [ ] 工作目录创建成功，`$DIR` 路径有效
- [ ] `content.md` 包含标题、正文、话题标签三部分
- [ ] `image-plan.md` 包含封面 + 1~3 张内容页规划
- [ ] 封面图 `$DIR/cover.png` 存在且可访问
- [ ] 所有内容图 `$DIR/image_01.png` ... 存在且可访问
- [ ] 尾图按 `seednote_image_mode`：含尾图的模式 `$DIR/tail.png` 存在且可访问；不含尾图的模式不得存在 `tail.png`
- [ ] 图片总数符合 image-plan.md「计划图片数量」声明值（封面 1 + 内容图 1~3 + 尾图 0~1）
- [ ] 所有图片视觉风格一致（同色系、同字体、同布局风格）
- [ ] 复刻模式下 `source-analysis.md` 包含源笔记模板分析
- [ ] 违禁词检查报告生成
- [ ] 归档成功，最终目录路径报告给用户

---

## 错误处理

**图片 API 失败**：在 `$DIR/image-review.md` 记录 provider、model、output_path、error 和下一步建议，报告可恢复失败态，待模型、额度、网络或配置修复后从图片生成阶段继续。

**配置问题**：假定配置已正确设置，不要尝试验证配置。如果 MCP 工具因配置问题失败，直接报告错误信息和下一步建议。

## 工作规范

### 文件组织

- 当前运行使用任务工作目录（变量 `$DIR`），完成后按笔记标题归档为 `output/seednote/{标题}/`
- 图片命名：`$DIR/cover.png`（封面）, `$DIR/image_01.png` ...（仅含内容图的模式）, `$DIR/tail.png`（仅含尾图的模式）
- 内容草稿：`$DIR/content.md`（含标题/正文/话题标签）
- 图片规划：`$DIR/image-plan.md`（seednote-visual-design 技能内部产物）
- 决策记录：`$DIR/topic-analysis.md`（原创模式）或 `$DIR/source-analysis.md`（复刻模式）

### 任务追踪

- 流程启动时用 TaskCreate 创建任务列表
- 每个任务对应一个流程步骤
- 开始前：`TaskUpdate status → in_progress`
- 完成后：`TaskUpdate status → completed`
- 设置依赖：每个任务 blockedBy 前一个任务
- 报告进度示例：`[4/6] 图片生成完成 → $DIR/ (5张图片)`

## 执行原则

1. **全程自动**：所有决策点由评分模型或映射规则自动处理，不向用户提问
2. **质量优先**：宁可多花时间确保内容质量，也不要仓促产出
3. **透明记录**：决策过程写入文件，不中断流程问用户

## 最佳实践

1. **内容质量优先**：确保 content.md 信息点具体、有收藏价值
2. **知识化扩展**：情感/体验类主题须扩展为实用干货，增加收藏价值
3. **决策透明记录**：所有评分、选择、降级决策写入文件，便于追溯

标题规范、视觉风格、违禁词检查等详见各 skill 文档。

---

## 分阶段交付策略

当创作任务复杂时，按以下阶段独立交付：

- **阶段 1 - 选题与内容**：完成选题分析、标题正文、话题标签（`content.md`）
- **阶段 2 - 图片规划**：完成图片内容规划（`image-plan.md`）
- **阶段 3 - 图片生成**：完成封面和所有内容图生成
- **阶段 4 - 合规与归档**：完成违禁词检查、归档整理

每个阶段完成后可独立验证，不依赖后续阶段。
