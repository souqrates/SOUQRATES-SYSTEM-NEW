import { logger } from "./logger";
import { db, settingsTable } from "@workspace/db";

interface TelegramResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: { message_id: number; chat: { id: number }; text?: string };
}

async function tgCall(token: string, method: string, body: object): Promise<TelegramResponse> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<TelegramResponse>;
}

async function configureBot(
  name: string, token: string, appUrl: string, buttonText: string,
  commands: Array<{ command: string; description: string }>
) {
  logger.info({ name }, "Configuring Telegram bot...");

  const menuResult = await tgCall(token, "setChatMenuButton", {
    menu_button: { type: "web_app", text: buttonText, web_app: { url: appUrl } },
  });
  if (!menuResult.ok) logger.error({ name, error: menuResult.description }, "Failed to set menu button");
  else logger.info({ name }, "Menu button set to Web App");

  const cmdResult = await tgCall(token, "setMyCommands", { commands });
  if (!cmdResult.ok) logger.error({ name, error: cmdResult.description }, "Failed to set commands");
  else logger.info({ name }, "Commands set");

  await tgCall(token, "setMyShortDescription", { short_description: buttonText });
}

async function sendWelcome(token: string, chatId: number, appUrl: string, buttonText: string) {
  await tgCall(token, "sendMessage", {
    chat_id: chatId,
    text: "مرحباً — اضغط الزر أدناه لفتح التطبيق داخل تيليغرام:",
    reply_markup: { inline_keyboard: [[{ text: buttonText, web_app: { url: appUrl } }]] },
  });
}

// Long-poll loop (used when no webhook URL is configured)
async function startPolling(name: string, token: string, appUrl: string, buttonText: string) {
  let offset = 0;
  await tgCall(token, "deleteWebhook", { drop_pending_updates: false });
  logger.info({ name }, "Bot polling started");

  while (true) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?timeout=25&offset=${offset}&allowed_updates=["message"]`,
        { signal: AbortSignal.timeout(35_000) }
      );
      const data = (await res.json()) as { ok: boolean; result: TelegramUpdate[] };
      if (!data.ok || !data.result?.length) continue;

      for (const update of data.result) {
        offset = update.update_id + 1;
        const text = update.message?.text ?? "";
        const chatId = update.message?.chat.id;
        if (!chatId) continue;
        if (text.startsWith("/start") || text.startsWith("/wallet") || text.startsWith("/games") || text.startsWith("/products")) {
          await sendWelcome(token, chatId, appUrl, buttonText);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("TimeoutError") && !msg.includes("AbortError")) {
        logger.warn({ name, msg }, "Polling error — retrying");
      }
      await new Promise((r) => setTimeout(r, 3_000));
    }
  }
}

// Register Telegram webhook (used when Contabo URL is configured)
async function registerWebhook(name: string, token: string, webhookUrl: string) {
  const result = await tgCall(token, "setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
  if (result.ok) {
    logger.info({ name, webhookUrl }, "Telegram webhook registered");
  } else {
    logger.error({ name, error: result.description }, "Failed to register webhook");
  }
}

export async function setupTelegramBots(): Promise<void> {
  const skillzToken = process.env["SKILLZ_BOT_TOKEN"];
  const souqToken   = process.env["SOUQ_BOT_TOKEN"];

  if (!skillzToken && !souqToken) {
    logger.info("No bot tokens configured — skipping Telegram bot setup");
    return;
  }

  // Read contaboWebhookUrl from settings to decide polling vs webhook
  let contaboWebhookUrl: string | null = null;
  try {
    const rows = await db.select().from(settingsTable).limit(1);
    contaboWebhookUrl = rows[0]?.contaboWebhookUrl ?? null;
  } catch {
    // non-fatal — fall back to polling
  }

  const useWebhook = !!contaboWebhookUrl;

  try {
    if (skillzToken) {
      await configureBot("Skillz", skillzToken, "https://souqrates.com/skillz/", "Play & Win SKZ", [
        { command: "start",  description: "Open Skillz Arena" },
        { command: "games",  description: "Browse games" },
        { command: "wallet", description: "My SKZ balance" },
      ]);

      if (useWebhook) {
        await registerWebhook("Skillz", skillzToken, `${contaboWebhookUrl}/api/telegram/webhook/skillz`);
      } else {
        startPolling("Skillz", skillzToken, "https://souqrates.com/skillz/", "Play & Win SKZ").catch(
          (err) => logger.error({ err }, "Skillz polling crashed")
        );
      }
    }

    if (souqToken) {
      await configureBot("Souq", souqToken, "https://souqrates.com/souq/", "Open Souq", [
        { command: "start",    description: "Open Souq Marketplace" },
        { command: "products", description: "Browse products" },
        { command: "wallet",   description: "My SKZ balance" },
      ]);

      if (useWebhook) {
        await registerWebhook("Souq", souqToken, `${contaboWebhookUrl}/api/telegram/webhook/souq`);
      } else {
        startPolling("Souq", souqToken, "https://souqrates.com/souq/", "Open Souq").catch(
          (err) => logger.error({ err }, "Souq polling crashed")
        );
      }
    }

    logger.info({ mode: useWebhook ? "webhook" : "polling" }, "Telegram bots configured successfully");
  } catch (err) {
    logger.error({ err }, "Bot setup failed — continuing startup");
  }
}

// Express handler for incoming Telegram webhook POST requests
// Mount at: POST /api/telegram/webhook/:botType
export async function handleWebhookUpdate(
  botType: "skillz" | "souq",
  body: TelegramUpdate
): Promise<void> {
  const skillzToken = process.env["SKILLZ_BOT_TOKEN"];
  const souqToken   = process.env["SOUQ_BOT_TOKEN"];
  const token = botType === "skillz" ? skillzToken : souqToken;
  const appUrl    = botType === "skillz" ? "https://souqrates.com/skillz/" : "https://souqrates.com/souq/";
  const buttonText = botType === "skillz" ? "Play & Win SKZ" : "Open Souq";

  if (!token) return;

  const text   = body.message?.text ?? "";
  const chatId = body.message?.chat.id;
  if (!chatId) return;

  if (text.startsWith("/start") || text.startsWith("/wallet") || text.startsWith("/games") || text.startsWith("/products")) {
    await sendWelcome(token, chatId, appUrl, buttonText);
  }
}
