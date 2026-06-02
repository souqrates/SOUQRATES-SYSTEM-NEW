import app from "./app";
import { logger } from "./lib/logger";
import { seedBots } from "./lib/seed";
import { seedGames } from "./lib/seedGames";
import { seedSouqProducts } from "./lib/seedSouqProducts";
import { setupTelegramBots } from "./lib/setupBots";
import { initSentry } from "./lib/monitoring";
import { initRedis } from "./lib/cache";
import { db, settingsTable } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function boot() {
  // 1. Run seeds and bot setup
  await Promise.all([seedBots(), seedGames(), seedSouqProducts(), setupTelegramBots()]);

  // 2. Init optional infrastructure services from DB settings
  try {
    const rows = await db.select().from(settingsTable).limit(1);
    const settings = rows[0];
    if (settings) {
      if (settings.sentryDsn) {
        initSentry(settings.sentryDsn);
      }
      if (settings.upstashRedisUrl && settings.upstashRedisToken) {
        await initRedis(settings.upstashRedisUrl, settings.upstashRedisToken);
      }
    }
  } catch (err) {
    logger.warn({ err }, "Could not load infra settings — continuing without optional services");
  }

  // 3. Start listening
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

boot();
