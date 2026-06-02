import { db } from "@workspace/db";
import { skillzGamesTable, gameTicketsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const GAMES = [
  // REFLEX (10)
  { name: "Reflex Strike", slug: "reflex-strike", category: "Reflex", description: "Tap glowing targets before they vanish. Pure reaction speed.", difficulty: "Easy", tags: "tap,speed,glow" },
  { name: "Bullet Dodge", slug: "bullet-dodge", category: "Reflex", description: "Weave through incoming projectiles. One hit and it is over.", difficulty: "Medium", tags: "dodge,projectile,survival" },
  { name: "Flash Tap", slug: "flash-tap", category: "Reflex", description: "React to color flashes. Wrong tap costs you big.", difficulty: "Easy", tags: "color,flash,reaction" },
  { name: "Chain Lightning", slug: "chain-lightning", category: "Reflex", description: "Follow the electric chain and hit each node in sequence.", difficulty: "Medium", tags: "chain,sequence,electric" },
  { name: "Neon Pop", slug: "neon-pop", category: "Reflex", description: "Pop neon bubbles as they explode across the screen.", difficulty: "Easy", tags: "neon,pop,burst" },
  { name: "Sniper Window", slug: "sniper-window", category: "Reflex", description: "A tiny window flashes. Click it before it closes.", difficulty: "Hard", tags: "precision,window,fast" },
  { name: "Mole Madness", slug: "mole-madness", category: "Reflex", description: "Whack the right moles. Wrong hits drain your score.", difficulty: "Medium", tags: "whack,choice,penalty" },
  { name: "Zero Lag", slug: "zero-lag", category: "Reflex", description: "Match the signal the instant it fires. Lag equals loss.", difficulty: "Hard", tags: "signal,timing,instant" },
  { name: "Plasma Swipe", slug: "plasma-swipe", category: "Reflex", description: "Swipe plasma bolts in the correct direction.", difficulty: "Medium", tags: "swipe,direction,plasma" },
  { name: "Hyperclick", slug: "hyperclick", category: "Reflex", description: "Click as many valid targets as you can in 30 seconds.", difficulty: "Easy", tags: "speed,click,volume" },

  // AIM / PRECISION (10)
  { name: "Dead Center", slug: "dead-center", category: "Aim", description: "Hit the bullseye. Outer rings score less. Miss equals heavy penalty.", difficulty: "Hard", tags: "aim,bullseye,precision" },
  { name: "Moving Target", slug: "moving-target", category: "Aim", description: "Track and shoot targets drifting across the field.", difficulty: "Medium", tags: "tracking,drift,shoot" },
  { name: "Pixel Perfect", slug: "pixel-perfect", category: "Aim", description: "Click on the exact highlighted pixel zone.", difficulty: "Hard", tags: "pixel,zone,precision" },
  { name: "Laser Aim", slug: "laser-aim", category: "Aim", description: "Align your laser through obstacles to hit the core.", difficulty: "Hard", tags: "laser,align,obstacle" },
  { name: "Shrinking Zones", slug: "shrinking-zones", category: "Aim", description: "Hit zones that get smaller each round.", difficulty: "Medium", tags: "zones,shrink,rounds" },
  { name: "Micro Targets", slug: "micro-targets", category: "Aim", description: "Tiny targets. Maximum points. Maximum challenge.", difficulty: "Hard", tags: "micro,tiny,max" },
  { name: "Crosshair King", slug: "crosshair-king", category: "Aim", description: "Reach the target score by clicking precise moving zones.", difficulty: "Medium", tags: "crosshair,moving,precise" },
  { name: "Snipe the Flag", slug: "snipe-the-flag", category: "Aim", description: "Pop only the flagged targets. Unflagged equals penalty.", difficulty: "Hard", tags: "flag,selective,penalty" },
  { name: "Orbital Strike", slug: "orbital-strike", category: "Aim", description: "Targets orbit a center point. Time your shot.", difficulty: "Medium", tags: "orbit,timing,shot" },
  { name: "No Scope", slug: "no-scope", category: "Aim", description: "No aim assist. No zoom. Just raw skill.", difficulty: "Hard", tags: "raw,no-assist,skill" },

  // TIMING / RHYTHM (10)
  { name: "Beat Drop", slug: "beat-drop", category: "Timing", description: "Hit the note exactly on the beat. Off-beat equals penalty.", difficulty: "Medium", tags: "rhythm,beat,music" },
  { name: "Pulse Strike", slug: "pulse-strike", category: "Timing", description: "Match the expanding pulse ring at its exact peak.", difficulty: "Medium", tags: "pulse,ring,match" },
  { name: "Metronome", slug: "metronome", category: "Timing", description: "Click in perfect time with the hidden rhythm.", difficulty: "Hard", tags: "timing,hidden,rhythm" },
  { name: "Gravity Drop", slug: "gravity-drop", category: "Timing", description: "Release falling objects at the exact right moment.", difficulty: "Medium", tags: "gravity,release,timing" },
  { name: "Sync or Sink", slug: "sync-or-sink", category: "Timing", description: "Stay in sync with the oscillating bar. Drift and lose.", difficulty: "Hard", tags: "sync,bar,oscillate" },
  { name: "Rhythm Gate", slug: "rhythm-gate", category: "Timing", description: "Pass through gates that open on the beat.", difficulty: "Easy", tags: "gate,beat,pass" },
  { name: "Time Warp", slug: "time-warp", category: "Timing", description: "The speed accelerates. Keep your timing precise.", difficulty: "Hard", tags: "speed,accelerate,timing" },
  { name: "Signal Match", slug: "signal-match", category: "Timing", description: "Press when the waveform peaks exactly.", difficulty: "Medium", tags: "waveform,peak,press" },
  { name: "Tap the Gap", slug: "tap-the-gap", category: "Timing", description: "Tap in the silent gaps between beats.", difficulty: "Medium", tags: "gap,silent,tap" },
  { name: "Conductor", slug: "conductor", category: "Timing", description: "Lead the orchestra by tapping complex patterns.", difficulty: "Hard", tags: "pattern,complex,orchestrate" },

  // PATTERN / MEMORY (10)
  { name: "Mirror Maze", slug: "mirror-maze", category: "Pattern", description: "Reproduce the mirrored pattern shown for 2 seconds.", difficulty: "Medium", tags: "mirror,memory,pattern" },
  { name: "Cipher Sequence", slug: "cipher-sequence", category: "Pattern", description: "Memorize and replay the encrypted symbol sequence.", difficulty: "Hard", tags: "cipher,symbol,sequence" },
  { name: "Color Cascade", slug: "color-cascade", category: "Pattern", description: "Click colors in the exact order they cascaded.", difficulty: "Easy", tags: "color,order,cascade" },
  { name: "Grid Memory", slug: "grid-memory", category: "Pattern", description: "Remember which grid cells were highlighted. Recreate them.", difficulty: "Medium", tags: "grid,highlight,recall" },
  { name: "Reverse Trail", slug: "reverse-trail", category: "Pattern", description: "Follow the path shown but in reverse.", difficulty: "Hard", tags: "reverse,trail,path" },
  { name: "Stack Memory", slug: "stack-memory", category: "Pattern", description: "Each round adds one more element to the growing stack.", difficulty: "Hard", tags: "stack,grow,accumulate" },
  { name: "Symbol Flash", slug: "symbol-flash", category: "Pattern", description: "Symbols flash for 300ms. Tap the correct one.", difficulty: "Medium", tags: "symbol,flash,300ms" },
  { name: "Path Finder", slug: "path-finder", category: "Pattern", description: "Memorize the path through a shifting grid.", difficulty: "Hard", tags: "path,shifting,grid" },
  { name: "Repeat After", slug: "repeat-after", category: "Pattern", description: "Watch the computer move sequence. Mirror it exactly.", difficulty: "Easy", tags: "simon,mirror,sequence" },
  { name: "Neural Link", slug: "neural-link", category: "Pattern", description: "Complex branching pattern. Full recall required.", difficulty: "Hard", tags: "neural,branch,recall" },

  // PHYSICS / SURVIVAL (10)
  { name: "Gravity Flip", slug: "gravity-flip", category: "Physics", description: "Flip gravity to avoid walls. Survive as long as possible.", difficulty: "Medium", tags: "gravity,flip,survive" },
  { name: "Black Hole", slug: "black-hole", category: "Physics", description: "Orbit around a black hole without getting sucked in.", difficulty: "Hard", tags: "orbit,black-hole,gravity" },
  { name: "Void Runner", slug: "void-runner", category: "Physics", description: "Sprint through a collapsing void corridor.", difficulty: "Medium", tags: "runner,void,corridor" },
  { name: "Elastic Bounce", slug: "elastic-bounce", category: "Physics", description: "Control a bouncing ball to hit all targets.", difficulty: "Easy", tags: "bounce,elastic,ball" },
  { name: "Particle Storm", slug: "particle-storm", category: "Physics", description: "Navigate through a field of ricocheting particles.", difficulty: "Hard", tags: "particle,ricochet,navigate" },
  { name: "Gravity Well", slug: "gravity-well", category: "Physics", description: "Slingshot around gravity wells to reach targets.", difficulty: "Hard", tags: "slingshot,well,trajectory" },
  { name: "Wrecking Ball", slug: "wrecking-ball", category: "Physics", description: "Swing and smash all targets with a pendulum.", difficulty: "Medium", tags: "pendulum,swing,smash" },
  { name: "Zero Gravity", slug: "zero-gravity", category: "Physics", description: "Move in zero-G. Momentum is everything.", difficulty: "Medium", tags: "zero-g,momentum,float" },
  { name: "Plasma Field", slug: "plasma-field", category: "Physics", description: "Dodge charged plasma bursts with magnetic movement.", difficulty: "Hard", tags: "plasma,magnetic,dodge" },
  { name: "Collapse Zone", slug: "collapse-zone", category: "Physics", description: "The platform collapses under you. Keep moving or fall.", difficulty: "Hard", tags: "collapse,platform,survival" },
];

function makeTickets(gameId: number, difficulty: string) {
  const base = difficulty === "Easy" ? 1 : difficulty === "Medium" ? 1.5 : 2;
  return [
    {
      gameId, tier: 1, name: "Bronze",
      entryPrice: (5 * base).toFixed(6), prize: (20 * base).toFixed(6),
      targetScore: Math.round(50 * base), timeLimitSeconds: 90,
      correctHitValue: 10, wrongHitPenalty: 3, isActive: true,
    },
    {
      gameId, tier: 2, name: "Silver",
      entryPrice: (15 * base).toFixed(6), prize: (75 * base).toFixed(6),
      targetScore: Math.round(80 * base), timeLimitSeconds: 75,
      correctHitValue: 12, wrongHitPenalty: 5, isActive: true,
    },
    {
      gameId, tier: 3, name: "Gold",
      entryPrice: (30 * base).toFixed(6), prize: (180 * base).toFixed(6),
      targetScore: Math.round(120 * base), timeLimitSeconds: 60,
      correctHitValue: 15, wrongHitPenalty: 7, isActive: true,
    },
    {
      gameId, tier: 4, name: "Platinum",
      entryPrice: (75 * base).toFixed(6), prize: (500 * base).toFixed(6),
      targetScore: Math.round(180 * base), timeLimitSeconds: 50,
      correctHitValue: 18, wrongHitPenalty: 10, isActive: true,
    },
    {
      gameId, tier: 5, name: "Diamond",
      entryPrice: (200 * base).toFixed(6), prize: (1500 * base).toFixed(6),
      targetScore: Math.round(250 * base), timeLimitSeconds: 40,
      correctHitValue: 25, wrongHitPenalty: 15, isActive: true,
    },
  ];
}

async function seed() {
  console.log("Seeding 50 games...");

  for (const g of GAMES) {
    const [inserted] = await db
      .insert(skillzGamesTable)
      .values({
        name: g.name,
        slug: g.slug,
        category: g.category,
        description: g.description,
        isActive: true,
        totalPlays: 0,
        difficultyLabel: g.difficulty,
        tags: g.tags,
      })
      .onConflictDoUpdate({
        target: skillzGamesTable.slug,
        set: {
          name: g.name,
          description: g.description,
          difficultyLabel: g.difficulty,
          tags: g.tags,
        },
      })
      .returning();

    const tickets = makeTickets(inserted.id, g.difficulty);
    for (const ticket of tickets) {
      await db
        .insert(gameTicketsTable)
        .values(ticket as any)
        .onConflictDoNothing();
    }

    console.log(`  [OK] ${inserted.id}: ${g.name} (${g.category})`);
  }

  console.log("Done! 50 games seeded.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
