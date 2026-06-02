import { db, skillzGamesTable, gameTicketsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

const TICKET_TIERS: Record<string, Array<{ tier: number; name: string; entryPrice: string; prize: string; targetScore: number; timeLimitSeconds: number; correctHitValue: number; wrongHitPenalty: number }>> = {
  Easy: [
    { tier: 1, name: "Bronze",   entryPrice: "5",   prize: "20",   targetScore: 90,  timeLimitSeconds: 70, correctHitValue: 10, wrongHitPenalty: 6  },
    { tier: 2, name: "Silver",   entryPrice: "15",  prize: "75",   targetScore: 152, timeLimitSeconds: 55, correctHitValue: 13, wrongHitPenalty: 10 },
    { tier: 3, name: "Gold",     entryPrice: "30",  prize: "180",  targetScore: 240, timeLimitSeconds: 45, correctHitValue: 17, wrongHitPenalty: 16 },
    { tier: 4, name: "Platinum", entryPrice: "75",  prize: "500",  targetScore: 378, timeLimitSeconds: 35, correctHitValue: 22, wrongHitPenalty: 24 },
    { tier: 5, name: "Diamond",  entryPrice: "200", prize: "1500", targetScore: 550, timeLimitSeconds: 28, correctHitValue: 30, wrongHitPenalty: 35 },
  ],
  Medium: [
    { tier: 1, name: "Bronze",   entryPrice: "7.5",   prize: "30",   targetScore: 135, timeLimitSeconds: 70, correctHitValue: 10, wrongHitPenalty: 6  },
    { tier: 2, name: "Silver",   entryPrice: "22.5",  prize: "112.5",targetScore: 228, timeLimitSeconds: 55, correctHitValue: 13, wrongHitPenalty: 10 },
    { tier: 3, name: "Gold",     entryPrice: "45",    prize: "270",  targetScore: 360, timeLimitSeconds: 45, correctHitValue: 17, wrongHitPenalty: 16 },
    { tier: 4, name: "Platinum", entryPrice: "112.5", prize: "750",  targetScore: 567, timeLimitSeconds: 35, correctHitValue: 22, wrongHitPenalty: 24 },
    { tier: 5, name: "Diamond",  entryPrice: "300",   prize: "2250", targetScore: 825, timeLimitSeconds: 28, correctHitValue: 30, wrongHitPenalty: 35 },
  ],
  Hard: [
    { tier: 1, name: "Bronze",   entryPrice: "10",  prize: "40",   targetScore: 180,  timeLimitSeconds: 70, correctHitValue: 10, wrongHitPenalty: 6  },
    { tier: 2, name: "Silver",   entryPrice: "30",  prize: "150",  targetScore: 304,  timeLimitSeconds: 55, correctHitValue: 13, wrongHitPenalty: 10 },
    { tier: 3, name: "Gold",     entryPrice: "60",  prize: "360",  targetScore: 480,  timeLimitSeconds: 45, correctHitValue: 17, wrongHitPenalty: 16 },
    { tier: 4, name: "Platinum", entryPrice: "150", prize: "1000", targetScore: 756,  timeLimitSeconds: 35, correctHitValue: 22, wrongHitPenalty: 24 },
    { tier: 5, name: "Diamond",  entryPrice: "400", prize: "3000", targetScore: 1100, timeLimitSeconds: 28, correctHitValue: 30, wrongHitPenalty: 35 },
  ],
};

const GAMES_SEED = [
  { slug: "crypto-rhythm",  name: "Crypto Rhythm",  category: "Timing",   difficultyLabel: "Easy",   description: "Crypto symbols flow down three lanes. Tap your lane exactly when the symbol crosses the golden bar." },
  { slug: "thread-cutter",  name: "Thread Cutter",  category: "Timing",   difficultyLabel: "Medium", description: "A pendulum swings at crazy speed over a prize basket. Tap to cut the thread at the exact moment." },
  { slug: "shock-switch",   name: "Shock Switch",   category: "Timing",   difficultyLabel: "Medium", description: "An energy needle oscillates wildly. Tap the instant it hits the green sweet spot or lose power." },
  { slug: "meteor-catch",   name: "Meteor Catch",   category: "Timing",   difficultyLabel: "Easy",   description: "Colored meteors rain from space. Tap sides to move your basket and match the meteor color before impact." },
  { slug: "critical-leap",  name: "Critical Leap",  category: "Timing",   difficultyLabel: "Hard",   description: "Leap between rotating platforms with pinpoint timing. Mistimed jumps send you into the void." },
  { slug: "laser-gate",     name: "Laser Gate",     category: "Timing",   difficultyLabel: "Hard",   description: "Laser barriers flash open for milliseconds. Tap to fire your orb through the gap before it closes." },
  { slug: "last-turn",      name: "The Last Turn",  category: "Timing",   difficultyLabel: "Medium", description: "A neon car races through a tight corridor. Tap to turn 90 degrees. Any delay means a crash." },
  { slug: "vault-cracker",  name: "Vault Cracker",  category: "Timing",   difficultyLabel: "Medium", description: "The vault dial spins and a red marker appears. Tap the instant the needle crosses the marker." },
  { slug: "crypto-shield",  name: "Crypto Shield",  category: "Timing",   difficultyLabel: "Hard",   description: "Your core is attacked from all directions. Rotate your shield arc to block every incoming strike." },
  { slug: "heartbeat-sync", name: "Heartbeat Sync", category: "Timing",   difficultyLabel: "Easy",   description: "An ECG pulse travels across the screen. Tap precisely at each sharp peak to keep the beat alive." },
  { slug: "crypto-stack",   name: "Crypto Stack",   category: "Physics",  difficultyLabel: "Easy",   description: "Moving crypto blocks slide left and right. Tap to drop each block perfectly onto the growing tower." },
  { slug: "gold-balance",   name: "Gold Balance",   category: "Physics",  difficultyLabel: "Medium", description: "A platform tilts as weights fall on it. Tap sides to redistribute weight and keep it from flipping." },
  { slug: "tightrope-bot",  name: "Tightrope Bot",  category: "Physics",  difficultyLabel: "Medium", description: "A robot walks a thin rope swayed by wind. Tap left or right to counterbalance and keep it upright." },
  { slug: "coin-magnet",    name: "Coin Magnet",    category: "Physics",  difficultyLabel: "Easy",   description: "A magnet floats amid coins and bombs. Tap to flip polarity: attract coins, repel bombs." },
  { slug: "fragile-bubble", name: "Fragile Bubble", category: "Physics",  difficultyLabel: "Hard",   description: "A bubble floats up through spiked obstacles. Tap to nudge it left or right before it pops." },
  { slug: "slippery-slope", name: "Slippery Slope", category: "Physics",  difficultyLabel: "Medium", description: "A ball rolls on an icy slope full of holes. Tap to tilt the slope and guide the ball to safety." },
  { slug: "gravity-flip",   name: "Gravity Flip",   category: "Physics",  difficultyLabel: "Medium", description: "A neon runner auto-sprints through an obstacle tunnel. Tap once to flip gravity and dodge barriers." },
  { slug: "jelly-bridge",   name: "Jelly Bridge",   category: "Physics",  difficultyLabel: "Easy",   description: "Hold to extend a jelly bridge between platforms. Release at the perfect length or your character falls." },
  { slug: "bounce-arrow",   name: "Bounce Arrow",   category: "Physics",  difficultyLabel: "Hard",   description: "Fire arrows that ricochet off walls. Calculate the bounce angle to strike the hidden target." },
  { slug: "egg-dash",       name: "Egg Dash",       category: "Physics",  difficultyLabel: "Medium", description: "Toss eggs into a moving basket. Match the timing and angle to land every egg safely." },
  { slug: "bot-slasher",    name: "Bot Slasher",    category: "Swipe",    difficultyLabel: "Easy",   description: "Hostile bots arc across the screen. Swipe to slash them before they escape. Spare the friendly ones." },
  { slug: "coin-sorter",    name: "Coin Sorter",    category: "Swipe",    difficultyLabel: "Easy",   description: "BTC, ETH, and TON coins rain down. Drag each coin to its matching crypto wallet before it hits the floor." },
  { slug: "lightning-path", name: "Lightning Path", category: "Swipe",    difficultyLabel: "Medium", description: "A glowing path flashes briefly then vanishes. Trace it perfectly with your finger before it fades." },
  { slug: "cyber-cleaner",  name: "Cyber Cleaner",  category: "Swipe",    difficultyLabel: "Easy",   description: "Digital viruses multiply fast. Swipe to destroy them before they infect 100 percent of the screen." },
  { slug: "star-swiper",    name: "Star Swiper",    category: "Swipe",    difficultyLabel: "Medium", description: "Stars light up and fade fast. Connect the glowing ones by swiping through them in a single stroke." },
  { slug: "tornado-escape", name: "Tornado Escape", category: "Swipe",    difficultyLabel: "Hard",   description: "A tornado is chasing you. Follow the directional arrows and swipe fast enough to outrun it." },
  { slug: "node-war",       name: "Node War",       category: "Swipe",    difficultyLabel: "Medium", description: "Connect your nodes to capture neutral territory before the AI does. Drag fast and think faster." },
  { slug: "bomb-defuser",   name: "Bomb Defuser",   category: "Swipe",    difficultyLabel: "Hard",   description: "Colored wires appear on a bomb. Swipe to cut them in the exact order given before time runs out." },
  { slug: "neon-rush",      name: "Neon Rush",      category: "Swipe",    difficultyLabel: "Medium", description: "A neon line races forward. Swipe left or right to dodge barriers that appear in sync with the beat." },
  { slug: "cyber-fishing",  name: "Cyber Fishing",  category: "Swipe",    difficultyLabel: "Easy",   description: "Digital fish dart around the screen. Swipe your hook through the most valuable fish before they escape." },
  { slug: "crypto-sequence",name: "Crypto Sequence",category: "Memory",   difficultyLabel: "Easy",   description: "Crypto logos light up one by one. Memorize the order and tap them back in exactly the same sequence." },
  { slug: "speed-match",    name: "Speed Match",    category: "Memory",   difficultyLabel: "Medium", description: "Two symbols flash briefly. Tap YES if they match, NO if they differ. Speed and accuracy both score." },
  { slug: "color-memory",   name: "Color Memory",   category: "Memory",   difficultyLabel: "Easy",   description: "A pattern of colored tiles appears then disappears. Recreate the exact pattern from memory." },
  { slug: "number-flash",   name: "Number Flash",   category: "Memory",   difficultyLabel: "Medium", description: "Numbers flash on a grid for half a second. Remember their positions and tap them in ascending order." },
  { slug: "symbol-map",     name: "Symbol Map",     category: "Memory",   difficultyLabel: "Hard",   description: "A complex symbol map shows for two seconds. Find all matching pairs from memory." },
  { slug: "pattern-recall", name: "Pattern Recall", category: "Memory",   difficultyLabel: "Medium", description: "A lit path travels across tiles then vanishes. Reproduce it exactly from start to finish." },
  { slug: "path-memory",    name: "Path Memory",    category: "Memory",   difficultyLabel: "Hard",   description: "A path winds across a grid and disappears. Trace the exact path without a single wrong step." },
  { slug: "grid-scan",      name: "Grid Scan",      category: "Memory",   difficultyLabel: "Medium", description: "Highlighted grid cells appear for one second. Mark every lit cell from memory. Miss none." },
  { slug: "code-break",     name: "Code Break",     category: "Memory",   difficultyLabel: "Hard",   description: "A scrambled code sequence flashes briefly. Decode the pattern and enter the correct symbols." },
  { slug: "mirror-matrix",  name: "Mirror Matrix",  category: "Memory",   difficultyLabel: "Easy",   description: "One half of a symmetric matrix is shown. Complete the mirror image from memory." },
  { slug: "chain-reaction", name: "Chain Reaction", category: "Strategy", difficultyLabel: "Medium", description: "Tap a node at the right moment to trigger a chain reaction through all connected nodes." },
  { slug: "crypto-bridge",  name: "Crypto Bridge",  category: "Strategy", difficultyLabel: "Easy",   description: "Extend a crypto bridge across the gap one block at a time. Build it perfectly or your cargo falls." },
  { slug: "block-chain",    name: "Block Chain",    category: "Strategy", difficultyLabel: "Medium", description: "Link blockchain blocks in the correct hash sequence before the chain breaks." },
  { slug: "circuit-close",  name: "Circuit Close",  category: "Strategy", difficultyLabel: "Hard",   description: "Trace and close open circuit paths before the energy bleeds out. Every millisecond counts." },
  { slug: "hash-clash",     name: "Hash Clash",     category: "Strategy", difficultyLabel: "Hard",   description: "Two hash patterns appear. Spot the differences and tap them before the blocks merge." },
  { slug: "bit-breaker",    name: "Bit Breaker",    category: "Strategy", difficultyLabel: "Easy",   description: "A crypto ball bounces and breaks blocks of data. Keep it in play and clear the entire board." },
  { slug: "ping-master",    name: "Ping Master",    category: "Strategy", difficultyLabel: "Medium", description: "Deflect ping packets back across the network using your paddle. Miss one and lose a life." },
  { slug: "stack-overflow", name: "Stack Overflow", category: "Strategy", difficultyLabel: "Hard",   description: "Stack code blocks perfectly without overflowing the buffer. Each mistake costs resources." },
  { slug: "signal-surge",   name: "Signal Surge",   category: "Strategy", difficultyLabel: "Easy",   description: "A pulse surges through a wire. Tap at each node exactly when the pulse reaches it." },
  { slug: "data-stream",    name: "Data Stream",    category: "Strategy", difficultyLabel: "Hard",   description: "Navigate a data packet through a high-speed stream filled with corrupt byte clusters." },
];

export async function seedGames(): Promise<void> {
  try {
    const existingCount = await db.select({ count: sql<number>`count(*)` }).from(skillzGamesTable);
    if (Number(existingCount[0].count) >= 50) {
      return;
    }

    logger.info("Seeding 50 skillz games...");

    for (const game of GAMES_SEED) {
      const existing = await db.select().from(skillzGamesTable).where(eq(skillzGamesTable.slug, game.slug)).limit(1);
      let gameId: number;

      if (existing.length === 0) {
        const inserted = await db.insert(skillzGamesTable).values({
          name: game.name,
          slug: game.slug,
          category: game.category,
          description: game.description,
          difficultyLabel: game.difficultyLabel,
          tags: game.slug,
          isActive: true,
          totalPlays: 0,
        }).returning({ id: skillzGamesTable.id });
        gameId = inserted[0].id;
      } else {
        gameId = existing[0].id;
      }

      const tiers = TICKET_TIERS[game.difficultyLabel] ?? TICKET_TIERS["Easy"]!;
      for (const t of tiers) {
        const existingTicket = await db.select()
          .from(gameTicketsTable)
          .where(eq(gameTicketsTable.gameId, gameId))
          .limit(1);

        if (existingTicket.length === 0) {
          await db.insert(gameTicketsTable).values({
            gameId,
            tier: t.tier,
            name: t.name,
            entryPrice: t.entryPrice,
            prize: t.prize,
            targetScore: t.targetScore,
            timeLimitSeconds: t.timeLimitSeconds,
            correctHitValue: t.correctHitValue,
            wrongHitPenalty: t.wrongHitPenalty,
            isActive: true,
          });
        }
      }
    }

    logger.info("Games seed complete — 50 games inserted");
  } catch (err) {
    logger.error({ err }, "Games seed failed");
  }
}
