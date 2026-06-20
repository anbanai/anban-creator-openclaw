import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Register quality verification and delivery summary hooks for anbanwriter.
 *
 * Listens for after_tool_call events from anbanwriter MCP tools and generates
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
      api.logger.info(`[anbanwriter] hook fired: ${toolName} → ${result.substring(0, 50)}...`);
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
    default:
      return summarizeGenericDelivery(contentType, archivePath);
  }
}

function summarizeArticleDelivery(
  input: Record<string, any>,
  output: any,
  archivePath: string
): string {
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
    "- `cover.png` — 封面图",
    "- `images.json` — 配图 CDN 链接",
    "- `draft.json` — 草稿信息",
    ``,
    `质量检查要点：`,
    `- 文章是否有 ≥3 个二级标题`,
    `- 每个章节是否有配图`,
    `- 封面图是否生成并上传成功`,
    `- 草稿是否创建成功`,
  ];

  return lines.join("\n");
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
    "image-plan.md",
    "image-prompts.md",
    "image-review.md",
  ];
  const missingArtifacts = requiredArtifacts.filter(
    (name) => !hasFile(archivePath, name)
  );
  // Image count: compare against image-plan.md 「计划图片数量: N 张」(written by
  // skill step 3, driven by user prompt). If the field is missing, treat that as
  // a skill step-3 skip rather than guessing a default.
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
  }

  const warningBlock =
    missingArtifacts.length > 0
      ? [
        ``,
        `[GATE-WARN] 机械闸门警告（OpenClaw 无法 block，请人工确认）：`,
        ...missingArtifacts.map((m) => `  - 缺失 ${m}`),
        ``,
        `这些产物缺失通常意味着 seednote-visual-design skill 流程被绕过，`,
        `图片可能没有按规范生成中文文字。建议人工检查后重跑。`,
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
    `- 图片数量是否等于 image-plan.md 「计划图片数量」声明值`,
    `- 所有图片视觉风格是否一致`,
    `- content.md 是否包含话题标签`,
    `- 封面图是否清晰、无马赛克`,
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

// Parse 「计划图片数量: N 张」from image-plan.md (written by skill step 3, driven
// by user prompt directive). Four valid values 1/2/3 map to cover / cover+content /
// cover+tail / cover+content+tail. Returns undefined when the field is missing.
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
