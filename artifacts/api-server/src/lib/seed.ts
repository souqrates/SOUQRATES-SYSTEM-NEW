import { db, botsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

// Sub-bots are opened as Telegram Mini Apps from inside the main app via t.me
// deep links (handled by openTelegramLink on the client), NOT as web URLs that
// would open in an in-app browser. For `?startapp` to launch the mini app
// directly, each bot must have its Main Mini App enabled in BotFather.
const BOT_SEED = [
  {
    slug: "souqrates-skillz",
    name: "Souqrates Skillz",
    description: "Skill-based paid games with prizes and competitions",
    iconEmoji: "🎮",
    isActive: true,
    botUrl: "https://t.me/Souqrates_skillz_bot?startapp=souqrates",
  },
  {
    slug: "souqrates-souq",
    name: "Souqrates Souq",
    description: "Digital books marketplace — buy and sell digital knowledge",
    iconEmoji: "📚",
    isActive: true,
    botUrl: "https://t.me/Souqrates_souq_bot?startapp=souqrates",
  },
  {
    slug: "souqrates-subagent",
    name: "Souqrates Subagent",
    description: "Partner platform for buying and selling SKZ currency",
    iconEmoji: "🤝",
    isActive: true,
    botUrl: "https://t.me/Souqrates_subagent_bot?startapp=souqrates",
  },
];

export async function seedBots(): Promise<void> {
  try {
    for (const bot of BOT_SEED) {
      const existing = await db
        .select()
        .from(botsTable)
        .where(eq(botsTable.slug, bot.slug))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(botsTable).values({
          slug: bot.slug,
          name: bot.name,
          description: bot.description,
          iconEmoji: bot.iconEmoji,
          isActive: bot.isActive,
          botUrl: bot.botUrl,
          userCount: 0,
        });
        logger.info({ slug: bot.slug }, "Bot seeded");
      } else if (existing[0].botUrl !== bot.botUrl) {
        await db
          .update(botsTable)
          .set({ botUrl: bot.botUrl, name: bot.name, description: bot.description, isActive: bot.isActive })
          .where(eq(botsTable.slug, bot.slug));
        logger.info({ slug: bot.slug, botUrl: bot.botUrl }, "Bot URL updated");
      }
    }
  } catch (err) {
    logger.error({ err }, "Bot seed failed");
  }
}
