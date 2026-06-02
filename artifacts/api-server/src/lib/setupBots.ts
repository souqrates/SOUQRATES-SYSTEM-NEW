import { logger } from "./logger";

interface TelegramResponse {
  ok: boolean;
  description?: string;
}

async function tgCall(token: string, method: string, body: object): Promise<TelegramResponse> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<TelegramResponse>;
}

async function configureBot(name: string, token: string, appUrl: string, buttonText: string, commands: Array<{ command: string; description: string }>) {
  logger.info({ name }, "Configuring Telegram bot...");

  const menuResult = await tgCall(token, "setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: buttonText,
      web_app: { url: appUrl },
    },
  });
  if (!menuResult.ok) {
    logger.error({ name, error: menuResult.description }, "Failed to set menu button");
  } else {
    logger.info({ name }, "Menu button set to Web App");
  }

  const cmdResult = await tgCall(token, "setMyCommands", { commands });
  if (!cmdResult.ok) {
    logger.error({ name, error: cmdResult.description }, "Failed to set commands");
  } else {
    logger.info({ name }, "Commands set");
  }

  const shortDescResult = await tgCall(token, "setMyShortDescription", {
    short_description: buttonText,
  });
  if (!shortDescResult.ok) {
    logger.warn({ name, error: shortDescResult.description }, "Failed to set short description");
  }
}

export async function setupTelegramBots(): Promise<void> {
  const skillzToken = process.env["SKILLZ_BOT_TOKEN"];
  const souqToken = process.env["SOUQ_BOT_TOKEN"];

  if (!skillzToken && !souqToken) {
    logger.info("No bot tokens configured — skipping Telegram bot setup");
    return;
  }

  try {
    if (skillzToken) {
      await configureBot(
        "Skillz",
        skillzToken,
        "https://souqrates.com/skillz/",
        "Play & Win SKZ",
        [
          { command: "start",  description: "Open Skillz Arena" },
          { command: "games",  description: "Browse games" },
          { command: "wallet", description: "My SKZ balance" },
        ],
      );
    }

    if (souqToken) {
      await configureBot(
        "Souq",
        souqToken,
        "https://souqrates.com/souq/",
        "Open Souq",
        [
          { command: "start",    description: "Open Souq Marketplace" },
          { command: "products", description: "Browse products" },
          { command: "wallet",   description: "My SKZ balance" },
        ],
      );
    }

    logger.info("Telegram bots configured successfully");
  } catch (err) {
    logger.error({ err }, "Bot setup failed — continuing startup");
  }
}
