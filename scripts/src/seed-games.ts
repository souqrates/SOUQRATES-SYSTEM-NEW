import { db } from "@workspace/db";
import { skillzGamesTable, gameTicketsTable, gameSessionsTable } from "@workspace/db";

const GAMES = [
  // TIMING (10)
  { name: "Crypto Rhythm", slug: "crypto-rhythm", category: "Timing", difficulty: "Easy", description: "Crypto symbols flow down three lanes. Tap your lane exactly when the symbol crosses the golden bar." },
  { name: "Thread Cutter", slug: "thread-cutter", category: "Timing", difficulty: "Medium", description: "A pendulum swings at crazy speed over a prize basket. Tap to cut the thread at the exact moment." },
  { name: "Shock Switch", slug: "shock-switch", category: "Timing", difficulty: "Medium", description: "An energy needle oscillates wildly. Tap the instant it hits the green sweet spot or lose power." },
  { name: "Meteor Catch", slug: "meteor-catch", category: "Timing", difficulty: "Easy", description: "Colored meteors rain from space. Tap sides to move your basket and match the meteor color before impact." },
  { name: "Critical Leap", slug: "critical-leap", category: "Timing", difficulty: "Hard", description: "Leap between rotating platforms with pinpoint timing. Mistimed jumps send you into the void." },
  { name: "Laser Gate", slug: "laser-gate", category: "Timing", difficulty: "Hard", description: "Laser barriers flash open for milliseconds. Tap to fire your orb through the gap before it closes." },
  { name: "The Last Turn", slug: "last-turn", category: "Timing", difficulty: "Medium", description: "A neon car races through a tight corridor. Tap to turn 90 degrees. Any delay means a crash." },
  { name: "Vault Cracker", slug: "vault-cracker", category: "Timing", difficulty: "Medium", description: "The vault dial spins and a red marker appears. Tap the instant the needle crosses the marker." },
  { name: "Crypto Shield", slug: "crypto-shield", category: "Timing", difficulty: "Hard", description: "Your core is attacked from all directions. Rotate your shield arc to block every incoming strike." },
  { name: "Heartbeat Sync", slug: "heartbeat-sync", category: "Timing", difficulty: "Easy", description: "An ECG pulse travels across the screen. Tap precisely at each sharp peak to keep the beat alive." },

  // PHYSICS (10)
  { name: "Crypto Stack", slug: "crypto-stack", category: "Physics", difficulty: "Easy", description: "Moving crypto blocks slide left and right. Tap to drop each block perfectly onto the growing tower." },
  { name: "Gold Balance", slug: "gold-balance", category: "Physics", difficulty: "Medium", description: "A platform tilts as weights fall on it. Tap sides to redistribute weight and keep it from flipping." },
  { name: "Tightrope Bot", slug: "tightrope-bot", category: "Physics", difficulty: "Medium", description: "A robot walks a thin rope swayed by wind. Tap left or right to counterbalance and keep it upright." },
  { name: "Coin Magnet", slug: "coin-magnet", category: "Physics", difficulty: "Easy", description: "A magnet floats amid coins and bombs. Tap to flip polarity: attract coins, repel bombs." },
  { name: "Fragile Bubble", slug: "fragile-bubble", category: "Physics", difficulty: "Hard", description: "A bubble floats up through spiked obstacles. Tap to nudge it left or right before it pops." },
  { name: "Slippery Slope", slug: "slippery-slope", category: "Physics", difficulty: "Medium", description: "A ball rolls on an icy slope full of holes. Tap to tilt the slope and guide the ball to safety." },
  { name: "Gravity Flip", slug: "gravity-flip", category: "Physics", difficulty: "Medium", description: "A neon runner auto-sprints through an obstacle tunnel. Tap once to flip gravity and dodge barriers." },
  { name: "Jelly Bridge", slug: "jelly-bridge", category: "Physics", difficulty: "Easy", description: "Hold to extend a jelly bridge between platforms. Release at the perfect length or your character falls." },
  { name: "Bounce Arrow", slug: "bounce-arrow", category: "Physics", difficulty: "Hard", description: "Fire arrows that ricochet off walls. Calculate the bounce angle to strike the hidden target." },
  { name: "Egg Dash", slug: "egg-dash", category: "Physics", difficulty: "Medium", description: "Toss eggs into a moving basket. Match the timing and angle to land every egg safely." },

  // SWIPE (10)
  { name: "Bot Slasher", slug: "bot-slasher", category: "Swipe", difficulty: "Easy", description: "Hostile bots arc across the screen. Swipe to slash them before they escape. Spare the friendly ones." },
  { name: "Coin Sorter", slug: "coin-sorter", category: "Swipe", difficulty: "Easy", description: "BTC, ETH, and TON coins rain down. Drag each coin to its matching crypto wallet before it hits the floor." },
  { name: "Lightning Path", slug: "lightning-path", category: "Swipe", difficulty: "Medium", description: "A glowing path flashes briefly then vanishes. Trace it perfectly with your finger before it fades." },
  { name: "Cyber Cleaner", slug: "cyber-cleaner", category: "Swipe", difficulty: "Easy", description: "Digital viruses multiply fast. Swipe to destroy them before they infect 100 percent of the screen." },
  { name: "Star Swiper", slug: "star-swiper", category: "Swipe", difficulty: "Medium", description: "Stars light up and fade fast. Connect the glowing ones by swiping through them in a single stroke." },
  { name: "Tornado Escape", slug: "tornado-escape", category: "Swipe", difficulty: "Hard", description: "A tornado is chasing you. Follow the directional arrows and swipe fast enough to outrun it." },
  { name: "Node War", slug: "node-war", category: "Swipe", difficulty: "Medium", description: "Connect your nodes to capture neutral territory before the AI does. Drag fast and think faster." },
  { name: "Bomb Defuser", slug: "bomb-defuser", category: "Swipe", difficulty: "Hard", description: "Colored wires appear on a bomb. Swipe to cut them in the exact order given before time runs out." },
  { name: "Neon Rush", slug: "neon-rush", category: "Swipe", difficulty: "Medium", description: "A neon line races forward. Swipe left or right to dodge barriers that appear in sync with the beat." },
  { name: "Cyber Fishing", slug: "cyber-fishing", category: "Swipe", difficulty: "Easy", description: "Digital fish dart around the screen. Swipe your hook through the most valuable fish before they escape." },

  // MEMORY (10)
  { name: "Crypto Sequence", slug: "crypto-sequence", category: "Memory", difficulty: "Easy", description: "Crypto logos light up one by one. Memorize the order and tap them back in exactly the same sequence." },
  { name: "Speed Match", slug: "speed-match", category: "Memory", difficulty: "Medium", description: "Two symbols flash briefly. Tap YES if they match, NO if they differ. Speed and accuracy both score." },
  { name: "Color Memory", slug: "color-memory", category: "Memory", difficulty: "Easy", description: "A pattern of colored tiles appears then disappears. Recreate the exact pattern from memory." },
  { name: "Number Flash", slug: "number-flash", category: "Memory", difficulty: "Medium", description: "Numbers flash on a grid for half a second. Remember their positions and tap them in ascending order." },
  { name: "Symbol Map", slug: "symbol-map", category: "Memory", difficulty: "Hard", description: "A complex symbol map shows for two seconds. Find all matching pairs from memory." },
  { name: "Pattern Recall", slug: "pattern-recall", category: "Memory", difficulty: "Medium", description: "A lit path travels across tiles then vanishes. Reproduce it exactly from start to finish." },
  { name: "Path Memory", slug: "path-memory", category: "Memory", difficulty: "Hard", description: "A path winds across a grid and disappears. Trace the exact path without a single wrong step." },
  { name: "Grid Scan", slug: "grid-scan", category: "Memory", difficulty: "Medium", description: "Highlighted grid cells appear for one second. Mark every lit cell from memory. Miss none." },
  { name: "Code Break", slug: "code-break", category: "Memory", difficulty: "Hard", description: "A scrambled code sequence flashes briefly. Decode the pattern and enter the correct symbols." },
  { name: "Mirror Matrix", slug: "mirror-matrix", category: "Memory", difficulty: "Easy", description: "One half of a symmetric matrix is shown. Complete the mirror image from memory." },

  // STRATEGY (10)
  { name: "Chain Reaction", slug: "chain-reaction", category: "Strategy", difficulty: "Medium", description: "Tap a node at the right moment to trigger a chain reaction through all connected nodes." },
  { name: "Crypto Bridge", slug: "crypto-bridge", category: "Strategy", difficulty: "Easy", description: "Extend a crypto bridge across the gap one block at a time. Build it perfectly or your cargo falls." },
  { name: "Block Chain", slug: "block-chain", category: "Strategy", difficulty: "Medium", description: "Link blockchain blocks in the correct hash sequence before the chain breaks." },
  { name: "Circuit Close", slug: "circuit-close", category: "Strategy", difficulty: "Hard", description: "Trace and close open circuit paths before the energy bleeds out. Every millisecond counts." },
  { name: "Hash Clash", slug: "hash-clash", category: "Strategy", difficulty: "Hard", description: "Two hash patterns appear. Spot the differences and tap them before the blocks merge." },
  { name: "Bit Breaker", slug: "bit-breaker", category: "Strategy", difficulty: "Easy", description: "A crypto ball bounces and breaks blocks of data. Keep it in play and clear the entire board." },
  { name: "Ping Master", slug: "ping-master", category: "Strategy", difficulty: "Medium", description: "Deflect ping packets back across the network using your paddle. Miss one and lose a life." },
  { name: "Stack Overflow", slug: "stack-overflow", category: "Strategy", difficulty: "Hard", description: "Stack code blocks perfectly without overflowing the buffer. Each mistake costs resources." },
  { name: "Signal Surge", slug: "signal-surge", category: "Strategy", difficulty: "Easy", description: "A pulse surges through a wire. Tap at each node exactly when the pulse reaches it." },
  { name: "Data Stream", slug: "data-stream", category: "Strategy", difficulty: "Hard", description: "Navigate a data packet through a high-speed stream filled with corrupt byte clusters." },
];

function makeTickets(gameId: number, difficulty: string) {
  const base = difficulty === "Easy" ? 1 : difficulty === "Medium" ? 1.5 : 2;
  return [
    { gameId, tier: 1, name: "Bronze",   entryPrice: (5  * base).toFixed(6), prize: (20   * base).toFixed(6), targetScore: Math.round(50  * base), timeLimitSeconds: 90, correctHitValue: 10, wrongHitPenalty: 3,  isActive: true },
    { gameId, tier: 2, name: "Silver",   entryPrice: (15 * base).toFixed(6), prize: (75   * base).toFixed(6), targetScore: Math.round(80  * base), timeLimitSeconds: 75, correctHitValue: 12, wrongHitPenalty: 5,  isActive: true },
    { gameId, tier: 3, name: "Gold",     entryPrice: (30 * base).toFixed(6), prize: (180  * base).toFixed(6), targetScore: Math.round(120 * base), timeLimitSeconds: 60, correctHitValue: 15, wrongHitPenalty: 7,  isActive: true },
    { gameId, tier: 4, name: "Platinum", entryPrice: (75 * base).toFixed(6), prize: (500  * base).toFixed(6), targetScore: Math.round(180 * base), timeLimitSeconds: 50, correctHitValue: 18, wrongHitPenalty: 10, isActive: true },
    { gameId, tier: 5, name: "Diamond",  entryPrice: (200* base).toFixed(6), prize: (1500 * base).toFixed(6), targetScore: Math.round(250 * base), timeLimitSeconds: 40, correctHitValue: 25, wrongHitPenalty: 15, isActive: true },
  ];
}

async function seed() {
  console.log("Clearing old game data...");
  await db.delete(gameSessionsTable);
  await db.delete(gameTicketsTable);
  await db.delete(skillzGamesTable);
  console.log("Old data cleared. Seeding 50 new games...");

  for (const g of GAMES) {
    const [inserted] = await db
      .insert(skillzGamesTable)
      .values({ name: g.name, slug: g.slug, category: g.category, description: g.description, isActive: true, totalPlays: 0, difficultyLabel: g.difficulty, tags: g.slug })
      .returning();

    for (const ticket of makeTickets(inserted.id, g.difficulty)) {
      await db.insert(gameTicketsTable).values(ticket as any).onConflictDoNothing();
    }
    console.log(`  [OK] ${inserted.id}: ${g.name} (${g.category})`);
  }
  console.log("Done! 50 new games seeded.");
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
