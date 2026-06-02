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
  else logger.info({ name }, "Menu button set");

  const cmdResult = await tgCall(token, "setMyCommands", { commands });
  if (!cmdResult.ok) logger.error({ name, error: cmdResult.description }, "Failed to set commands");
  else logger.info({ name }, "Commands set");

  await tgCall(token, "setMyShortDescription", { short_description: buttonText });
}

// ─── Message templates ────────────────────────────────────────────────────────

function systemWelcome(firstName: string): string {
  const name = firstName ? ` ${firstName}` : "";
  return (
    `<b>SOUQRATES SYSTEM</b>\n` +
    `<i>Your Gateway to the Souqrates Ecosystem</i>\n\n` +
    `Welcome${name}.\n\n` +
    `<b>SKZ</b> is the native currency powering the entire ecosystem.\n` +
    `Deposit via TON or USDT — spend across all platforms.\n\n` +
    `<b>Available Platforms:</b>\n\n` +
    `<b>Skillz Arena</b>\n` +
    `Skill-based challenges with real SKZ prize pools\n\n` +
    `<b>Souq Marketplace</b>\n` +
    `Premium digital books — 50+ titles across 10 categories\n\n` +
    `<b>Subagent Network</b>\n` +
    `Become a certified SKZ trading partner\n\n` +
    `<b>Commands:</b>\n` +
    `/wallet — Manage your SKZ balance\n` +
    `/referral — Your referral tree &amp; earnings\n` +
    `/bots — Access all platforms`
  );
}

function systemWalletMessage(): string {
  return (
    `<b>SKZ Wallet</b>\n\n` +
    `Manage your balance, deposits, and transfers\n` +
    `inside the Souqrates System app.\n\n` +
    `<b>Deposit methods:</b> TON · USDT (TRC-20)\n\n` +
    `Your SKZ balance works across all platforms:\n` +
    `Skillz · Souq · Subagent`
  );
}

function systemReferralMessage(): string {
  return (
    `<b>Referral Program</b>\n\n` +
    `Earn SKZ commissions on every deposit made by your referrals.\n\n` +
    `<b>3-Level Commission Structure:</b>\n` +
    `— Level 1: Direct referrals\n` +
    `— Level 2: Their referrals\n` +
    `— Level 3: One level deeper\n\n` +
    `View your full referral tree inside the app.`
  );
}

function systemBotsMessage(): string {
  return (
    `<b>Souqrates Platforms</b>\n\n` +
    `All platforms share your single SKZ balance.\n\n` +
    `Select a platform to launch:`
  );
}

function subagentWelcome(firstName: string): string {
  const name = firstName ? ` ${firstName}` : "";
  return (
    `<b>SOUQRATES SUBAGENT</b>\n` +
    `<i>The SKZ Partner Trading Network</i>\n\n` +
    `Welcome${name}.\n\n` +
    `<b>What is a Subagent?</b>\n` +
    `A certified SKZ trading partner authorized to buy and sell\n` +
    `SKZ currency within the Souqrates ecosystem.\n\n` +
    `<b>Partner Benefits:</b>\n` +
    `— Official authorization to trade SKZ\n` +
    `— Access to partner dashboard &amp; tools\n` +
    `— Dedicated support channel\n` +
    `— Commission on every transaction processed\n\n` +
    `<b>Commands:</b>\n` +
    `/apply — Submit a partner application\n` +
    `/status — Check application status\n\n` +
    `Open the platform below to apply or manage your partnership.`
  );
}

function subagentApplyMessage(): string {
  return (
    `<b>Partner Application</b>\n\n` +
    `To become a certified SKZ Subagent, submit your application\n` +
    `through the platform below.\n\n` +
    `<b>Requirements:</b>\n` +
    `— Valid identification\n` +
    `— Country of operation\n` +
    `— Trading experience (optional)\n\n` +
    `Applications are reviewed within 24-48 hours.`
  );
}

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
    `/wallet — View your SKZ balance`
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

function skillzWalletMessage(): string {
  return (
    `<b>SKZ Wallet</b>\n\n` +
    `Your SKZ balance, deposit history, and transfer tools\n` +
    `are all available inside the Skillz Arena.\n\n` +
    `Supported deposits: <b>TON</b> · <b>USDT (TRC-20)</b>`
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
    `— Instant delivery after purchase\n` +
    `— All purchases powered by SKZ currency\n\n` +
    `<b>Commands:</b>\n` +
    `/products — Browse the full library\n` +
    `/wallet — View your SKZ balance`
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

// ─── Send helpers ─────────────────────────────────────────────────────────────

async function sendMessage(
  token: string, chatId: number, text: string,
  buttons: Array<Array<{ text: string; web_app?: { url: string }; url?: string }>>
) {
  await tgCall(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  });
}

async function sendSystemBotsMenu(token: string, chatId: number) {
  await tgCall(token, "sendMessage", {
    chat_id: chatId,
    text: systemBotsMessage(),
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "Skillz Arena", web_app: { url: "https://souqrates.com/skillz/" } }],
        [{ text: "Souq Marketplace", web_app: { url: "https://souqrates.com/souq/" } }],
        [{ text: "Subagent Network", web_app: { url: "https://souqrates.com/subagent/" } }],
        [{ text: "Souqrates System", web_app: { url: "https://souqrates.com/" } }],
      ],
    },
  });
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function handleSystemCommand(token: string, chatId: number, firstName: string, command: string) {
  const appUrl = "https://souqrates.com/";
  if (command.startsWith("/wallet")) {
    await sendMessage(token, chatId, systemWalletMessage(), [[{ text: "Open Wallet", web_app: { url: appUrl } }]]);
  } else if (command.startsWith("/referral")) {
    await sendMessage(token, chatId, systemReferralMessage(), [[{ text: "View Referrals", web_app: { url: appUrl } }]]);
  } else if (command.startsWith("/bots")) {
    await sendSystemBotsMenu(token, chatId);
  } else {
    await sendMessage(token, chatId, systemWelcome(firstName), [[{ text: "Open Souqrates", web_app: { url: appUrl } }]]);
  }
}

async function handleSubagentCommand(token: string, chatId: number, firstName: string, command: string) {
  const appUrl = "https://souqrates.com/subagent/";
  if (command.startsWith("/apply") || command.startsWith("/status")) {
    await sendMessage(token, chatId, subagentApplyMessage(), [[{ text: "Apply Now", web_app: { url: appUrl } }]]);
  } else {
    await sendMessage(token, chatId, subagentWelcome(firstName), [[{ text: "Open Subagent", web_app: { url: appUrl } }]]);
  }
}

async function handleSkillzCommand(token: string, chatId: number, firstName: string, command: string) {
  const appUrl = "https://souqrates.com/skillz/";
  if (command.startsWith("/wallet")) {
    await sendMessage(token, chatId, skillzWalletMessage(), [[{ text: "Open Wallet", web_app: { url: appUrl } }]]);
  } else if (command.startsWith("/games")) {
    await sendMessage(token, chatId, skillzGamesMessage(), [[{ text: "Browse Challenges", web_app: { url: appUrl } }]]);
  } else {
    await sendMessage(token, chatId, skillzWelcome(firstName), [[{ text: "Enter Skillz Arena", web_app: { url: appUrl } }]]);
  }
}

async function handleSouqCommand(token: string, chatId: number, firstName: string, command: string) {
  const appUrl = "https://souqrates.com/souq/";
  if (command.startsWith("/wallet")) {
    await sendMessage(token, chatId, souqWalletMessage(), [[{ text: "Open Wallet", web_app: { url: appUrl } }]]);
  } else if (command.startsWith("/products")) {
    await sendMessage(token, chatId, souqProductsMessage(), [[{ text: "Browse Library", web_app: { url: appUrl } }]]);
  } else {
    await sendMessage(token, chatId, souqWelcome(firstName), [[{ text: "Open Souq", web_app: { url: appUrl } }]]);
  }
}

// ─── Polling loop ─────────────────────────────────────────────────────────────

const BOT_COMMANDS: Record<string, string[]> = {
  system:   ["/start", "/wallet", "/referral", "/bots"],
  subagent: ["/start", "/apply", "/status"],
  skillz:   ["/start", "/wallet", "/games"],
  souq:     ["/start", "/wallet", "/products"],
};

async function startPolling(
  name: string, token: string, botKey: string,
  handler: (token: string, chatId: number, firstName: string, command: string) => Promise<void>
) {
  let offset = 0;
  await tgCall(token, "deleteWebhook", { drop_pending_updates: false });
  logger.info({ name }, "Bot polling started");

  const knownCommands = BOT_COMMANDS[botKey] ?? ["/start"];

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
  if (result.ok) logger.info({ name, webhookUrl }, "Webhook registered");
  else logger.error({ name, error: result.description }, "Failed to register webhook");
}

// ─── Setup entry point ────────────────────────────────────────────────────────

export async function setupTelegramBots(): Promise<void> {
  const systemToken   = process.env["SYSTEM_BOT_TOKEN"];
  const subagentToken = process.env["SUBAGENT_BOT_TOKEN"];
  const skillzToken   = process.env["SKILLZ_BOT_TOKEN"];
  const souqToken     = process.env["SOUQ_BOT_TOKEN"];

  if (!systemToken && !subagentToken && !skillzToken && !souqToken) {
    logger.info("No bot tokens configured — skipping Telegram bot setup");
    return;
  }

  let contaboWebhookUrl: string | null = null;
  try {
    const rows = await db.select().from(settingsTable).limit(1);
    contaboWebhookUrl = rows[0]?.contaboWebhookUrl ?? null;
  } catch { /* non-fatal */ }

  const useWebhook = !!contaboWebhookUrl;

  try {
    if (systemToken) {
      await configureBot("System", systemToken, "https://souqrates.com/", "Open Souqrates", [
        { command: "start",    description: "Open Souqrates System" },
        { command: "wallet",   description: "Manage SKZ balance" },
        { command: "referral", description: "Referral tree & earnings" },
        { command: "bots",     description: "Access all platforms" },
      ]);
      if (useWebhook) {
        await registerWebhook("System", systemToken, `${contaboWebhookUrl}/api/telegram/webhook/system`);
      } else {
        startPolling("System", systemToken, "system", handleSystemCommand).catch(
          (err) => logger.error({ err }, "System bot polling crashed")
        );
      }
    }

    if (subagentToken) {
      await configureBot("Subagent", subagentToken, "https://souqrates.com/subagent/", "Open Subagent", [
        { command: "start",  description: "Open Subagent Network" },
        { command: "apply",  description: "Apply to become a partner" },
        { command: "status", description: "Check application status" },
      ]);
      if (useWebhook) {
        await registerWebhook("Subagent", subagentToken, `${contaboWebhookUrl}/api/telegram/webhook/subagent`);
      } else {
        startPolling("Subagent", subagentToken, "subagent", handleSubagentCommand).catch(
          (err) => logger.error({ err }, "Subagent bot polling crashed")
        );
      }
    }

    if (skillzToken) {
      await configureBot("Skillz", skillzToken, "https://souqrates.com/skillz/", "Skillz Arena", [
        { command: "start",  description: "Open Skillz Arena" },
        { command: "games",  description: "Browse active challenges" },
        { command: "wallet", description: "View SKZ balance" },
      ]);
      if (useWebhook) {
        await registerWebhook("Skillz", skillzToken, `${contaboWebhookUrl}/api/telegram/webhook/skillz`);
      } else {
        startPolling("Skillz", skillzToken, "skillz", handleSkillzCommand).catch(
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
        startPolling("Souq", souqToken, "souq", handleSouqCommand).catch(
          (err) => logger.error({ err }, "Souq polling crashed")
        );
      }
    }

    logger.info({ mode: useWebhook ? "webhook" : "polling" }, "All bots configured");
  } catch (err) {
    logger.error({ err }, "Bot setup failed — continuing startup");
  }
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

export async function handleWebhookUpdate(
  botType: "system" | "skillz" | "souq" | "subagent",
  body: TelegramUpdate
): Promise<void> {
  const tokens: Record<string, string | undefined> = {
    system:   process.env["SYSTEM_BOT_TOKEN"],
    subagent: process.env["SUBAGENT_BOT_TOKEN"],
    skillz:   process.env["SKILLZ_BOT_TOKEN"],
    souq:     process.env["SOUQ_BOT_TOKEN"],
  };
  const token = tokens[botType];
  if (!token) return;

  const text      = body.message?.text ?? "";
  const chatId    = body.message?.chat.id;
  const firstName = body.message?.from?.first_name ?? "";
  if (!chatId) return;

  const knownCommands = BOT_COMMANDS[botType] ?? ["/start"];
  if (!knownCommands.some((c) => text.startsWith(c))) return;

  const handlers = {
    system:   handleSystemCommand,
    subagent: handleSubagentCommand,
    skillz:   handleSkillzCommand,
    souq:     handleSouqCommand,
  };
  await handlers[botType](token, chatId, firstName, text);
}
