import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

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
