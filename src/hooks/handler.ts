import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

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
    `- 图片数量是否 ≥3 张`,
    `- 所有图片视觉风格是否一致`,
    `- content.md 是否包含话题标签`,
    `- 封面图是否清晰、无马赛克`,
  ];

  return lines.join("\n");
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
