import { logger } from "./logger";
import { db, settingsTable } from "@workspace/db";

interface TelegramResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { first_name?: string; username?: string };
    text?: string;
  };
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

// ─── Message templates ────────────────────────────────────────────────────────

function skillzWelcome(firstName: string): string {
  const name = firstName ? ` ${firstName}` : "";
  return (
    `<b>SOUQRATES SKILLZ</b>\n` +
    `<i>The Skill-Based Arena — Play, Compete &amp; Earn SKZ</i>\n\n` +
    `Welcome${name}.\n\n` +
    `<b>What awaits you:</b>\n` +
    `— 50+ skill-based challenges across multiple categories\n` +
    `— Ticket-based entry system (Bronze → Legendary)\n` +
    `— Real SKZ prize pools paid instantly on win\n` +
    `— Global leaderboard &amp; ranking system\n\n` +
    `<b>Commands:</b>\n` +
    `/games — Browse all active challenges\n` +
    `/wallet — View your SKZ balance\n\n` +
    `<b>SKZ</b> is the native currency of the Souqrates ecosystem.\n` +
    `Deposit via TON or USDT to get started.`
  );
}

function skillzWalletMessage(): string {
  return (
    `<b>SKZ Wallet</b>\n\n` +
    `Your SKZ balance, deposit history, and transfer tools\n` +
    `are all available inside the Skillz Arena.\n\n` +
    `Supported deposits: <b>TON</b> · <b>USDT (TRC-20)</b>`
  );
}

function skillzGamesMessage(): string {
  return (
    `<b>Active Challenges</b>\n\n` +
    `Browse all available skill-based games inside the arena.\n\n` +
    `<b>Entry tiers:</b>\n` +
    `— Bronze · Silver · Gold · Platinum · Legendary\n\n` +
    `Higher tier = higher prize pool.`
  );
}

function souqWelcome(firstName: string): string {
  const name = firstName ? ` ${firstName}` : "";
  return (
    `<b>SOUQRATES SOUQ</b>\n` +
    `<i>The Digital Knowledge Marketplace</i>\n\n` +
    `Welcome${name}.\n\n` +
    `<b>What you will find:</b>\n` +
    `— Premium digital books across 10+ categories\n` +
    `— Exclusive titles: Business · Tech · Finance · Self-Development\n` +
    `— Instant delivery — purchased books available immediately\n` +
    `— All purchases powered by SKZ currency\n\n` +
    `<b>Commands:</b>\n` +
    `/products — Browse the full library\n` +
    `/wallet — View your SKZ balance\n\n` +
    `Use your <b>SKZ balance</b> to unlock any title in the marketplace.\n` +
    `Deposit via TON or USDT from the Souqrates main app.`
  );
}

function souqWalletMessage(): string {
  return (
    `<b>SKZ Wallet</b>\n\n` +
    `Your SKZ balance and transaction history\n` +
    `are available inside the Souq marketplace.\n\n` +
    `Supported deposits: <b>TON</b> · <b>USDT (TRC-20)</b>`
  );
}

function souqProductsMessage(): string {
  return (
    `<b>Digital Library</b>\n\n` +
    `Browse 50+ premium digital books inside the Souq.\n\n` +
    `<b>Categories:</b>\n` +
    `Business · Technology · Finance · Self-Development\n` +
    `Marketing · Psychology · Leadership · Design · Science · Health\n\n` +
    `All titles priced in <b>SKZ</b>.`
  );
}

// ─── Send message helper ──────────────────────────────────────────────────────

async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  appUrl: string,
  buttonText: string
) {
  await tgCall(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: `Open ${buttonText}`, web_app: { url: appUrl } }]],
    },
  });
}

// ─── Dispatch command ─────────────────────────────────────────────────────────

async function handleSkillzCommand(
  token: string,
  chatId: number,
  firstName: string,
  command: string
) {
  const appUrl = "https://souqrates.com/skillz/";

  if (command.startsWith("/wallet")) {
    await sendMessage(token, chatId, skillzWalletMessage(), appUrl, "Skillz Arena");
  } else if (command.startsWith("/games")) {
    await sendMessage(token, chatId, skillzGamesMessage(), appUrl, "Skillz Arena");
  } else {
    await sendMessage(token, chatId, skillzWelcome(firstName), appUrl, "Skillz Arena");
  }
}

async function handleSouqCommand(
  token: string,
  chatId: number,
  firstName: string,
  command: string
) {
  const appUrl = "https://souqrates.com/souq/";

  if (command.startsWith("/wallet")) {
    await sendMessage(token, chatId, souqWalletMessage(), appUrl, "Souq Marketplace");
  } else if (command.startsWith("/products")) {
    await sendMessage(token, chatId, souqProductsMessage(), appUrl, "Souq Marketplace");
  } else {
    await sendMessage(token, chatId, souqWelcome(firstName), appUrl, "Souq Marketplace");
  }
}

// ─── Long-poll loop ───────────────────────────────────────────────────────────

async function startPolling(
  name: string,
  token: string,
  handler: (token: string, chatId: number, firstName: string, command: string) => Promise<void>
) {
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
        const text      = update.message?.text ?? "";
        const chatId    = update.message?.chat.id;
        const firstName = update.message?.from?.first_name ?? "";
        if (!chatId) continue;

        const knownCommands = ["/start", "/wallet", "/games", "/products"];
        if (knownCommands.some((c) => text.startsWith(c))) {
          await handler(token, chatId, firstName, text);
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

// ─── Webhook registration ─────────────────────────────────────────────────────

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

// ─── Setup entry point ────────────────────────────────────────────────────────

export async function setupTelegramBots(): Promise<void> {
  const skillzToken = process.env["SKILLZ_BOT_TOKEN"];
  const souqToken   = process.env["SOUQ_BOT_TOKEN"];

  if (!skillzToken && !souqToken) {
    logger.info("No bot tokens configured — skipping Telegram bot setup");
    return;
  }

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
      await configureBot("Skillz", skillzToken, "https://souqrates.com/skillz/", "Skillz Arena", [
        { command: "start",  description: "Open Skillz Arena" },
        { command: "games",  description: "Browse active challenges" },
        { command: "wallet", description: "View SKZ balance" },
      ]);

      if (useWebhook) {
        await registerWebhook("Skillz", skillzToken, `${contaboWebhookUrl}/api/telegram/webhook/skillz`);
      } else {
        startPolling("Skillz", skillzToken, handleSkillzCommand).catch(
          (err) => logger.error({ err }, "Skillz polling crashed")
        );
      }
    }

    if (souqToken) {
      await configureBot("Souq", souqToken, "https://souqrates.com/souq/", "Souq Marketplace", [
        { command: "start",    description: "Open Souq Marketplace" },
        { command: "products", description: "Browse the digital library" },
        { command: "wallet",   description: "View SKZ balance" },
      ]);

      if (useWebhook) {
        await registerWebhook("Souq", souqToken, `${contaboWebhookUrl}/api/telegram/webhook/souq`);
      } else {
        startPolling("Souq", souqToken, handleSouqCommand).catch(
          (err) => logger.error({ err }, "Souq polling crashed")
        );
      }
    }

    logger.info({ mode: useWebhook ? "webhook" : "polling" }, "Telegram bots configured successfully");
  } catch (err) {
    logger.error({ err }, "Bot setup failed — continuing startup");
  }
}

// ─── Webhook handler (Express route) ─────────────────────────────────────────

export async function handleWebhookUpdate(
  botType: "skillz" | "souq",
  body: TelegramUpdate
): Promise<void> {
  const skillzToken = process.env["SKILLZ_BOT_TOKEN"];
  const souqToken   = process.env["SOUQ_BOT_TOKEN"];
  const token = botType === "skillz" ? skillzToken : souqToken;
  if (!token) return;

  const text      = body.message?.text ?? "";
  const chatId    = body.message?.chat.id;
  const firstName = body.message?.from?.first_name ?? "";
  if (!chatId) return;

  const knownCommands = ["/start", "/wallet", "/games", "/products"];
  if (!knownCommands.some((c) => text.startsWith(c))) return;

  if (botType === "skillz") {
    await handleSkillzCommand(token, chatId, firstName, text);
  } else {
    await handleSouqCommand(token, chatId, firstName, text);
  }
}
