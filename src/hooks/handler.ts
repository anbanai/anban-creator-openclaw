import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Register quality verification and delivery summary hooks for anban-creator.
 *
 * Listens for after_tool_call events from Anban Creator MCP tools and generates
 * structured delivery summaries and quality checks matching the claudecode
 * plugin's SubagentStop and TaskCompleted hooks.
 */
export function registerQualityHooks(api: OpenClawPluginApi): void {
  api.registerHook("after_tool_call", async (event: any) => {
    const toolName = event?.tool_name ?? "";
    const toolInput = event?.tool_input ?? {};
    const toolOutput = event?.tool_output;

    const result = handleToolComplete(toolName, toolInput, toolOutput);
    if (result && api.logger) {
      api.logger.info(`[anban-creator] hook fired: ${toolName} → ${result.substring(0, 50)}...`);
    }
  });
}

function handleToolComplete(
  toolName: string,
  input: Record<string, any>,
  output: any
): string | null {
  switch (toolName) {
    case "publish_draft":
    case "draft":
      return summarizePublish(input, output);
    case "archive_workspace":
      return summarizeArchive(input, output);
    default:
      return null;
  }
}

function summarizePublish(
  input: Record<string, any>,
  output: any
): string {
  const title = input?.title ?? "unknown";
  const draftUrl = output?.draft_url ?? output?.url;

  const lines = [
    `**草稿发布完成**`,
    `- 标题：${title}`,
    draftUrl ? `- 草稿链接：${draftUrl}` : "",
    `- 请在公众号后台检查草稿内容和格式`,
  ];

  return lines.filter(Boolean).join("\n");
}

function summarizeArchive(
  input: Record<string, any>,
  output: any
): string {
  const archivePath = output?.archive_path ?? output?.path ?? input?.name;
  const contentType = input?.content_type ?? "unknown";

  // Route to content-type-specific delivery summary
  switch (contentType) {
    case "articles":
    case "article":
      return summarizeArticleDelivery(input, output, archivePath);
    case "seednote":
      return summarizeSeednoteDelivery(input, output, archivePath);
    case "moments":
      return summarizeMomentsDelivery(input, output, archivePath);
    case "ecommerce":
      return summarizeEcommerceDelivery(input, output, archivePath);
    default:
      return summarizeGenericDelivery(contentType, archivePath);
  }
}

function summarizeArticleDelivery(
  input: Record<string, any>,
  output: any,
  archivePath: string
): string {
  // Best-effort visual-quality gate for the article pipeline. OpenClaw
  // after_tool_call is post-execution and cannot block, so we can only warn.
  // Mirrors the claudecode plugin's render_template / vision / image-dedup
  // checks but as soft warnings.
  const renderWarn = renderTemplateWarning(archivePath);
  const hasContentImages = hasFile(archivePath, "images.json");
  const hasCover = hasFile(archivePath, "cover.png");
  const visionWarn = hasContentImages ? visionPassRateWarning(archivePath) : null;
  const dedupWarn = hasContentImages ? imageUrlDedupWarning(archivePath) : null;
  const warningBlock =
    renderWarn || visionWarn || dedupWarn
      ? [
          ``,
          `[GATE-WARN] 视觉质量闸门警告（OpenClaw 无法 block，请人工确认）：`,
          ...(renderWarn ? [`  - ${renderWarn}`] : []),
          ...(visionWarn ? [`  - ${visionWarn}`] : []),
          ...(dedupWarn ? [`  - ${dedupWarn}`] : []),
          ``,
          `这些项缺失通常意味着 article 流水线步骤 6/7/8 未按新规范执行`,
          `（render_template 渲染 / vision 校验 / 正文图独立上 CDN）。`,
          `建议人工检查后重跑。`,
          ``,
        ]
      : [];

  const lines = [
    `**微信公众号文章创作完成**`,
    `- 归档路径：${archivePath}`,
    ``,
    `请检查以下产出文件：`,
    "- `01-research.md` — 选题分析和关键词",
    "- `02-outline.md` — 文章大纲",
    "- `03-article.md` — 文章初稿",
    "- `04-article-final.md` — 最终稿（去AI痕迹、合规检查）",
    "- `05-article.html` — 微信 HTML 格式",
    hasCover ? "- `cover.png` — 封面图" : "- `cover.png` — 封面图（封面开关关闭时可不存在）",
    hasContentImages ? "- `images.json` — 配图 CDN 链接（含 vision 校验记录）" : "- `images.json` — 配图记录（正文配图关闭时可不存在）",
    "- `draft.json` — 草稿信息",
    ``,
    `质量检查要点：`,
    `- 文章是否有 ≥3 个二级标题`,
    `- 每个章节是否有配图（仅正文配图开关开启时）`,
    `- 封面图是否生成并上传成功（仅封面开关开启时）`,
    `- **\`05-article.html\` 是否由 \`render_template\` 生成**（非 \`convert_markdown\`）`,
    `- **vision 校验通过率**（仅有 images.json 时检查 \`verification.passed\` 比例 ≥80%）`,
    `- **正文图片是否存在全图相同 / 复用封面 URL**（仅正文配图开关开启时）`,
    `- 草稿是否创建成功`,
    ...warningBlock,
  ];

  return lines.join("\n");
}

// Render-template warning: the article pipeline step 8 must produce
// 05-article.html via render_template (with layout_plan), not convert_markdown.
// We can't see the tool call that produced the file from after_tool_call, so
// we rely on two indirect signals:
//   1. visual-rhythm-plan.md exists (prerequisite for render_template layout_plan)
//   2. final-review.md exists and mentions render_template / render_audit
// Missing both → likely fell back to convert_markdown.
function renderTemplateWarning(dir: string): string | null {
  if (!hasFile(dir, "05-article.html")) {
    return null; // HTML missing is a different problem; don't double-warn
  }
  const hasRhythmPlan = hasFile(dir, "visual-rhythm-plan.md");
  const reviewText = readTextFile(dir, "final-review.md");
  const reviewMentionsRender =
    !!reviewText &&
    /render_template|render_audit/i.test(reviewText);
  if (hasRhythmPlan || reviewMentionsRender) {
    return null;
  }
  return `05-article.html 疑似由 convert_markdown 生成（未找到 visual-rhythm-plan.md，且 final-review.md 未提及 render_template/render_audit）；新流水线步骤 8 必须用 render_template`;
}

// Vision pass-rate warning: at least 80% of content images in images.json
// must have verification.passed === true. Returns null when images.json is
// missing or empty (can't compute) so we don't false-positive on legacy runs.
function visionPassRateWarning(dir: string): string | null {
  const images = readImagesJson(dir);
  if (images === null || images.length === 0) {
    return null;
  }
  const passed = images.filter((entry) => entry?.verification?.passed === true)
    .length;
  const total = images.length;
  const ratio = total > 0 ? passed / total : 1;
  if (ratio >= 0.8) {
    return null;
  }
  return `vision 校验通过率不足：images.json 中 ${passed}/${total} 张图 verification.passed=true（${(ratio * 100).toFixed(0)}% < 80% 闸门）`;
}

// Image URL dedup warning: content images must each have a unique wechat_url,
// and none may equal the cover's wechat_url. The server publish_draft hard-
// blocks drafts where ≥2 content images share a single URL, or where a content
// image reuses the cover URL.
function imageUrlDedupWarning(dir: string): string | null {
  const images = readImagesJson(dir);
  if (images === null || images.length === 0) {
    return null;
  }
  const contentUrls = images
    .filter((entry) => entry?.image_type === "content")
    .map((entry) => entry?.wechat_url ?? entry?.url)
    .filter((u): u is string => typeof u === "string" && u.length > 0);
  if (contentUrls.length === 0) {
    return null;
  }
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const u of contentUrls) {
    if (seen.has(u)) dupes.push(u);
    else seen.add(u);
  }
  // Cover URL = the single cover entry's wechat_url (or url fallback).
  const coverEntry = images.find((entry) => entry?.image_type === "cover");
  const coverUrl =
    coverEntry?.wechat_url ?? coverEntry?.url ?? null;
  const coverReuse =
    typeof coverUrl === "string" && contentUrls.includes(coverUrl)
      ? coverUrl
      : null;
  if (dupes.length === 0 && !coverReuse) {
    return null;
  }
  const parts: string[] = [];
  if (dupes.length > 0) {
    parts.push(
      `正文图存在重复 wechat_url（${dupes.length} 张复用，服务端 publish_draft 会硬拦截）`
    );
  }
  if (coverReuse) {
    parts.push(
      `正文图复用了封面 wechat_url（封面只能用于 thumb_media_id，不得复用为正文图）`
    );
  }
  return parts.join("；");
}

// Parse images.json in the archive dir. Returns null when missing or unparsable
// (best-effort: we never throw from a delivery summary).
function readImagesJson(
  dir: string
): Array<Record<string, any>> | null {
  const path = join(dir, "images.json");
  if (!existsSync(path)) return null;
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as Array<Record<string, any>>;
    return null;
  } catch {
    return null;
  }
}

// Read a text file in the archive dir, returning null when missing/unreadable.
function readTextFile(dir: string, name: string): string | null {
  const path = join(dir, name);
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function readJsonObject(
  dir: string,
  name: string
): Record<string, any> | null {
  const text = readTextFile(dir, name);
  if (text === null) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, any>
      : null;
  } catch {
    return null;
  }
}

function summarizeSeednoteDelivery(
  input: Record<string, any>,
  output: any,
  archivePath: string
): string {
  // Best-effort artifact gate: OpenClaw after_tool_call is post-execution and cannot block,
  // so we can only warn. This mirrors the claudecode/hooks/seednote-quality-gate.sh checks
  // but as a soft warning rather than a hard block.
  const requiredArtifacts = [
    "content.md",
    "request-analysis.json",
    "request-analysis.md",
    "reference-analysis.json",
    "reference-analysis.md",
    "image-plan.md",
    "image-prompts.md",
    "image-review.md",
    "reference-usage-summary.json",
  ];
  const missingArtifacts = requiredArtifacts.filter(
    (name) => !hasFile(archivePath, name)
  );
  // Image count: compare against image-plan.md 「计划图片数量: N 张」(written by
  // skill step 3). Content image count is adaptive (0~3); the field records the
  // agent-decided total. If missing, treat as a skill step-3 skip.
  const imageCount = countImages(archivePath);
  if (hasFile(archivePath, "image-plan.md")) {
    const expected = expectedImageCount(archivePath);
    if (expected === undefined) {
      missingArtifacts.push(
        `image-plan.md 缺「计划图片数量」字段（说明 skill 步骤 3 未执行）`
      );
    } else if (imageCount !== expected) {
      missingArtifacts.push(
        `图片数量（当前 ${imageCount} 张，应等于 image-plan.md 声明的 ${expected} 张）`
      );
    }
    if (!hasFile(archivePath, "cover.png")) {
      missingArtifacts.push(`cover.png（封面必选）`);
    }
    const contentCount = countContentImages(archivePath);
    if (contentCount > 3) {
      missingArtifacts.push(
        `内容图超过 3 张上限（当前 ${contentCount} 张，应 ≤3）`
      );
    }
  }

  const summary = readJsonObject(archivePath, "reference-usage-summary.json");
  if (summary !== null) {
    const outputs = summary.outputs;
    if (!Array.isArray(outputs) || outputs.length === 0) {
      missingArtifacts.push(
        `reference-usage-summary.json.outputs 为空，未记录逐图核验结果`
      );
    } else {
      for (const entry of outputs) {
        if (entry?.verification?.passed !== true) {
          const fileName = entry?.file_name ?? "<unknown>";
          missingArtifacts.push(
            `${fileName} 视觉核验未通过（verification.passed !== true）`
          );
        }
      }
    }
  }

  const warningBlock =
    missingArtifacts.length > 0
      ? [
        ``,
        `[GATE-WARN] 机械闸门警告（OpenClaw 无法 block，请人工确认）：`,
        ...missingArtifacts.map((m) => `  - 缺失 ${m}`),
        ``,
        `这些问题通常意味着 seednote-visual-design skill 的规划、`,
        `generate_image 原子视觉核验或归档流程未完成。建议人工检查后重跑。`,
        ``,
      ]
      : [];

  const lines = [
    `**种草笔记创作完成**`,
    `- 归档路径：${archivePath}`,
    ``,
    `请检查以下产出文件：`,
    "- `topic-analysis.md` — 选题分析（原创模式）",
    "- `source-analysis.md` — 源笔记分析（复刻模式）",
    "- `content.md` — 笔记内容（标题+正文+话题标签）",
    "- `image-plan.md` — 图片规划",
    "- `cover.png` — 封面图",
    "- `image_*.png` — 内容图",
    "- `tail.png` — 尾图",
    "- `compliance-report.md` — 违禁词合规检查",
    ``,
    `质量检查要点：`,
    `- 图片数量是否等于 image-plan.md 「计划图片数量」声明值，内容图是否 ≤ 3 张`,
    `- 所有图片视觉风格是否一致`,
    `- content.md 是否包含话题标签`,
    `- 封面图是否清晰、无马赛克`,
    ...warningBlock,
  ];

  return lines.join("\n");
}

function summarizeMomentsDelivery(
  input: Record<string, any>,
  output: any,
  archivePath: string
): string {
  const requiredArtifacts = [
    "material-analysis.md",
    "content.md",
    "quality-review.md",
  ];
  const missingArtifacts = requiredArtifacts.filter(
    (name) => !hasFile(archivePath, name)
  );
  const warningBlock =
    missingArtifacts.length > 0
      ? [
        ``,
        `[GATE-WARN] 朋友圈素材包产物缺失（OpenClaw 无法 block，请人工确认）：`,
        ...missingArtifacts.map((m) => `  - 缺失 ${m}`),
        ``,
        `这些产物缺失通常意味着 moments skill 流程未完整执行，`,
        `建议回到素材分析、正文生成或质量复盘步骤补齐。`,
        ``,
      ]
      : [];

  const lines = [
    `**朋友圈素材包创作完成**`,
    `- 归档路径：${archivePath}`,
    ``,
    `请检查以下产出文件：`,
    "- `material-analysis.md` — 素材分类、四层提炼、证据清单和不得编造项",
    "- `content.md` — 主版本、备选开头/结尾和发布建议",
    "- `quality-review.md` — 真实感、诱导互动、空泛营销、证据不足、隐私与合规",
    ``,
    `质量检查要点：`,
    `- 不伪造客户案例、成交数据、用户反馈`,
    `- 不使用转发/集赞/评论领资料等诱导互动`,
    `- 缺证据时使用弱化表达并记录人工复核点`,
    ...warningBlock,
  ];

  return lines.join("\n");
}

function summarizeEcommerceDelivery(
  input: Record<string, any>,
  output: any,
  archivePath: string
): string {
  // Best-effort artifact gate: OpenClaw after_tool_call is post-execution and
  // cannot block, so we can only warn. Mirrors the ecommerce SubagentStop
  // delivery-summary checks in claudecode/hooks/hooks.json + codex/hooks/hooks.json
  // but as a soft warning rather than a prompt-driven self-check.
  const requiredArtifacts = [
    "product-bible.md",
    "copywriting.md",
    "asset-plan.md",
    "best-refs.md",
    "compliance-report.md",
    "manifest.json",
  ];
  const missingArtifacts = requiredArtifacts.filter(
    (name) => !hasFile(archivePath, name)
  );
  // Count ecommerce image outputs by module prefix. Each selected module must
  // yield at least one image; main images (main_01..05) are always produced.
  const moduleCounts = countEcommerceImages(archivePath);
  const totalImages = Object.values(moduleCounts).reduce((a, b) => a + b, 0);
  if (moduleCounts.main === 0) {
    missingArtifacts.push(`主图（main_*.png，必选模块至少 1 张）`);
  }
  if (totalImages === 0) {
    missingArtifacts.push(`图片产物（未找到任何 main_/detail_/cover_/share_/sku_ 前缀图片）`);
  }

  const warningBlock =
    missingArtifacts.length > 0
      ? [
        ``,
        `[GATE-WARN] 机械闸门警告（OpenClaw 无法 block，请人工确认）：`,
        ...missingArtifacts.map((m) => `  - 缺失 ${m}`),
        ``,
        `这些产物缺失通常意味着 ecommerce 流程某步被跳过，`,
        `（产品档案 / 卖点 FABE / 资产规划 / 视觉自检 / 合规 / 清单）。`,
        `建议人工检查后重跑。`,
        ``,
      ]
      : [];

  const lines = [
    `**电商出图创作完成**`,
    `- 归档路径：${archivePath}`,
    ``,
    `请检查以下产出文件：`,
    "- `product-bible.md` — 产品档案（品类/品牌/色彩/材质/形状/包装文字/卖点 + 锚点 $ANCHOR_REF）",
    "- `copywriting.md` — 卖点文案（排序卖点 / 主图文案 / 详情 FABE）",
    "- `asset-plan.md` — 资产规划（已选模块 + 各模块图片数量）",
    "- `main_01..05.png` — 主图（必选）",
    "- `detail_*.png` / `cover_*.png` / `share_*.png` / `sku_*.png` — 按已选模块产出",
    "- `best-refs.md` — 一致性自检（逐图 provider / verify_with_vision 结果）",
    "- `compliance-report.md` — 广告法极限词/违禁词合规",
    "- `manifest.json` — 交付清单（按模块含文件名/尺寸/provider/自检/合规）",
    ``,
    `质量检查要点：`,
    `- 产品跨图视觉一致性（logo / 主色 / 形状）`,
    `- 主图①是否有强卖点与钩子`,
    `- 详情页是否有叙事逻辑（FABE）`,
    `- 图内文字无乱码 / 无多余英文（中文场景）`,
    `- 未多图复用同一参考图导致雷同`,
    ...warningBlock,
  ];

  return lines.join("\n");
}

// Best-effort file checks for the seednote artifact gate.
// existsSync/readdirSync only throw on permission errors or invalid args;
// missing files return false / empty array. We deliberately don't catch —
// if the plugin host lacks fs access, the warning is the least of our problems.
function hasFile(dir: string, name: string): boolean {
  return existsSync(join(dir, name));
}

function countImages(dir: string): number {
  if (!existsSync(dir)) return 0;
  const entries = readdirSync(dir);
  const matchers = [/^cover\.png$/i, /^tail\.png$/i, /^image_.*\.png$/i];
  return entries.filter((n: string) => matchers.some((re) => re.test(n))).length;
}

// Count content images only (image_*.png), excluding cover.png and tail.png.
// Used to enforce the content-image upper cap of 3 (content count is adaptive
// 1~3); the lower bound is covered by the expected==imageCount check above.
function countContentImages(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((n: string) => /^image_.*\.png$/i.test(n))
    .length;
}

// Count ecommerce image outputs grouped by module prefix. Ecommerce filenames
// follow the main_/detail_/cover_/share_/sku_ convention (lowercase, png). Used
// by the ecommerce artifact gate to confirm at least the mandatory main module
// produced images.
function countEcommerceImages(
  dir: string
): { main: number; detail: number; cover: number; share: number; sku: number } {
  const zero = { main: 0, detail: 0, cover: 0, share: 0, sku: 0 };
  if (!existsSync(dir)) return zero;
  const entries = readdirSync(dir);
  const count = (re: RegExp) =>
    entries.filter((n: string) => re.test(n)).length;
  return {
    main: count(/^main_.*\.png$/i),
    detail: count(/^detail_.*\.png$/i),
    cover: count(/^cover_.*\.png$/i),
    share: count(/^share_.*\.png$/i),
    sku: count(/^sku_.*\.png$/i),
  };
}

// Parse 「计划图片数量: N 张」from image-plan.md (written by skill step 3). Content
// image count is adaptive (0~3); total ranges 1~5. Returns undefined when the field
// is missing.
function expectedImageCount(dir: string): number | undefined {
  const planPath = join(dir, "image-plan.md");
  if (!existsSync(planPath)) return undefined;
  let text: string;
  try {
    text = readFileSync(planPath, "utf8");
  } catch {
    return undefined;
  }
  const m = text.match(/计划图片数量[:：]\s*([0-9]+)/);
  return m ? Number(m[1]) : undefined;
}

function summarizeGenericDelivery(
  contentType: string,
  archivePath: string
): string {
  const lines = [
    `**工作目录归档完成**`,
    `- 类型：${contentType}`,
    `- 归档路径：${archivePath}`,
    `- 请检查产出文件完整性`,
  ];

  return lines.join("\n");
}
