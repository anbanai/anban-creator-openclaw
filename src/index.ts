import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { registerQualityHooks } from "./hooks/handler";

export default {
  id: "anban",
  name: "Anban 智能创作助手",
  description:
    "WeChat & Seednote AI content creation suite — writing, visual design, multi-platform publishing",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi) {
    registerQualityHooks(api);
    api.logger.info("Anban Creator plugin registered");
  },
};
