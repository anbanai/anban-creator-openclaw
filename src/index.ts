import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { registerQualityHooks } from "./hooks/handler";

const ANBAN_BOOTSTRAP_SCRIPT = "scripts/bootstrap.sh";

function bootstrapAnbanBinary(api: OpenClawPluginApi) {
  const rootDir = api.rootDir ?? process.cwd();
  const script = join(rootDir, ...ANBAN_BOOTSTRAP_SCRIPT.split("/"));
  if (!existsSync(script)) {
    api.logger.warn(`[anban-creator] bootstrap script not found: ${script}`);
    return;
  }

  const child = spawn("bash", [script], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      ANBAN_PLUGIN_ROOT: rootDir,
    },
  });
  child.unref();
  api.logger.info("[anban-creator] anban binary bootstrap started");
}

export default {
  id: "anban",
  name: "Anban 智能创作助手",
  description:
    "WeChat & Seednote AI content creation suite — writing, visual design, multi-platform publishing",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi) {
    bootstrapAnbanBinary(api);
    registerQualityHooks(api);
    api.logger.info("Anban Creator plugin registered");
  },
};
