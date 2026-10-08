import { Mastra } from "@mastra/core/mastra";
import { ConsoleLogger } from "@mastra/core/logger";
import { TelegramIntegration } from "./integrations/telegram";
import { personalAssistantAgent } from "./agents/personalAssistantAgent";
import { dailyWorkflow } from "./workflows";
import { LibSQLStore } from "@mastra/libsql";
import { weatherAgent } from "./agents/weatherAgent";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const MASTRA_DB_PATH = path.join(PROJECT_ROOT, "mastra.db");

export const mastra: Mastra = new Mastra({
  agents: {
    personalAssistantAgent,
    weatherAgent,
  },
  workflows: {
    dailyWorkflow,
  },
  logger: new ConsoleLogger({
    level: "info",
  }),
  storage: new LibSQLStore({
    id: "mastra-root-store",
    url: `file:${MASTRA_DB_PATH}`,
  }),
});

// ---------------------------------------------------------------------------
// Initialize Telegram bot if token is available (and not a placeholder)
// ---------------------------------------------------------------------------
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

let _bot: TelegramIntegration | undefined;
if (TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN !== "your_telegram_bot_token_here") {
  _bot = new TelegramIntegration(TELEGRAM_BOT_TOKEN);
} else {
  console.warn(
    "[Telegram] TELEGRAM_BOT_TOKEN is not configured; Telegram bot is disabled."
  );
}

export const telegramBot: TelegramIntegration | undefined = _bot;
