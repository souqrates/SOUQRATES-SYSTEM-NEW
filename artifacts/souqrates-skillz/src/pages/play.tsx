import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useGetGame, useEndGameSession } from "@workspace/api-client-react";
import { X } from "lucide-react";

type GameState = "countdown" | "playing" | "ended";
interface GameConfig {
  targetScore: number; timeLimitSeconds: number;
  correctHitValue: number; wrongHitPenalty: number;
  prize: number; entryPrice: number;
}

function getEngine(slug: string, category: string): string {
  const MAP: Record<string, string> = {
    "crypto-rhythm": "rhythm",   "heartbeat-sync": "rhythm",  "speed-match": "rhythm",   "signal-surge": "rhythm",
    "thread-cutter": "pendulum", "vault-cracker": "pendulum",
    "shock-switch": "powerbar",  "gold-balance": "powerbar",  "tightrope-bot": "powerbar", "ping-master": "powerbar",
    "meteor-catch": "meteor",    "coin-sorter": "meteor",     "egg-dash": "meteor",       "cyber-fishing": "meteor",
    "laser-gate": "laser",       "last-turn": "laser",        "critical-leap": "laser",   "neon-rush": "laser",    "bounce-arrow": "laser", "bit-breaker": "laser",
    "crypto-stack": "stack",     "jelly-bridge": "stack",     "crypto-bridge": "stack",   "stack-overflow": "stack",
    "gravity-flip": "gravity",   "fragile-bubble": "gravity", "slippery-slope": "gravity","data-stream": "gravity",
    "bot-slasher": "slasher",    "cyber-cleaner": "slasher",  "star-swiper": "slasher",   "bomb-defuser": "slasher",
    "tornado-escape": "slasher", "lightning-path": "slasher", "node-war": "slasher",      "chain-reaction": "slasher","circuit-close": "slasher",
    "crypto-shield": "shield",   "coin-magnet": "shield",
  };
  if (MAP[slug]) return MAP[slug];
  if (category === "Timing")   return "rhythm";
  if (category === "Physics")  return "gravity";
  if (category === "Swipe")    return "slasher";
  if (category === "Memory")   return "simon";
  if (category === "Strategy") return "simon";
  return "simon";
}

export default function Play() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = parseInt(params.sessionId || "0");
  const searchParams = new URLSearchParams(window.location.search);
  const gameId = parseInt(searchParams.get("gameId") || "0");
  const [, navigate] = useLocation();
  const { data: game } = useGetGame(gameId);
  const endSession = useEndGameSession();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [gameState, setGameState] = useState<GameState>("countdown");
  const [countdown, setCountdown] = useState(3);
  const [sessionResult, setSessionResult] = useState<{ won: boolean; prize: number; finalScore: number; targetScore: number } | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gameEndedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  function playTone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.3) {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
    } catch {}
  }
  function playHit()    { playTone(520, 0.08, "square", 0.18); }
  function playMiss()   { playTone(140, 0.2, "sawtooth", 0.12); }
  function playPerfect(){ playTone(880, 0.12, "sine", 0.25); setTimeout(() => playTone(1100, 0.1, "sine", 0.2), 80); }
  function playWin()    { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.2, "sine", 0.3), i * 100)); }
  function playLose()   { [300, 250, 200].forEach((f, i) => setTimeout(() => playTone(f, 0.25, "sawtooth", 0.2), i * 120)); }

  useEffect(() => {
    const tier = parseInt(searchParams.get("tier") || "1");
    if (game?.tickets) {
      const ticket = game.tickets.find((t) => t.tier === tier) || game.tickets[0];
      if (ticket) {
        setConfig({ targetScore: ticket.targetScore, timeLimitSeconds: ticket.timeLimitSeconds, correctHitValue: ticket.correctHitValue, wrongHitPenalty: ticket.wrongHitPenalty, prize: ticket.prize, entryPrice: ticket.entryPrice });
        setTimeLeft(ticket.timeLimitSeconds);
      }
    }
  }, [game]);

  useEffect(() => {
    if (!config) return;
    const interval = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(interval); setGameState("playing"); return 0; } return c - 1; });
    }, 1000);
    return () => clearInterval(interval);
  }, [config]);

  async function endGame(finalScore: number) {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;
    setGameState("ended");
    cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    const won = finalScore >= (config?.targetScore ?? 999);
    if (won) playWin(); else playLose();
    try {
      const result = await endSession.mutateAsync({ sessionId, data: { finalScore, won } });
      setSessionResult({ won: result.won, prize: result.prizeAwarded, finalScore: result.finalScore, targetScore: result.targetScore });
    } catch {
      setSessionResult({ won, prize: won ? (config?.prize ?? 0) : 0, finalScore, targetScore: config?.targetScore ?? 0 });
    }
  }

  useEffect(() => {
    if (gameState !== "playing" || !config) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => { if (t <= 1) { endGame(scoreRef.current); return 0; } return t - 1; });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState, config]);

  // ═══════════════════════════════════════════════════════════
  //                      GAME ENGINES
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (gameState !== "playing" || !config || !canvasRef.current || !game) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    const cfg = config;
    const gameSlug = game.slug;
    const gameCategory = game.category;
    const engine = getEngine(gameSlug, gameCategory);

    function updateScore(delta: number) {
      scoreRef.current = Math.max(0, scoreRef.current + delta);
      setScore(scoreRef.current);
      if (scoreRef.current >= cfg.targetScore) endGame(scoreRef.current);
    }

    function getXY(e: MouseEvent | TouchEvent): { x: number; y: number } {
      const r = canvas.getBoundingClientRect();
      const src = "touches" in e ? e.touches[0] : e;
      return { x: (src.clientX - r.left) * (W / r.width), y: (src.clientY - r.top) * (H / r.height) };
    }

    // ─────────────────────────────────────────────────────
    // 1. RHYTHM ENGINE — 3-lane note highway
    // ─────────────────────────────────────────────────────
    if (engine === "rhythm") {
      const COLS = ["#a855f7", "#06b6d4", "#f59e0b", "#10b981", "#f97316", "#ec4899"];
      const SYMS = ["₿", "Ξ", "Ŧ", "◎", "Ⓢ", "◈", "⬡", "Ð"];
      const LANES = 3;
      const LW = W / LANES;
      const HIT_Y = H * 0.60;
      const OUTER = 48, INNER = 20;

      interface Note { lane: number; y: number; sym: string; color: string; hit: boolean; anim: number; }
      let notes: Note[] = [];
      let spawnT = 0;
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let speed = 2.8;

      function spawn() {
        const lane = Math.floor(Math.random() * LANES);
        notes.push({ lane, y: -30, sym: SYMS[Math.floor(Math.random() * SYMS.length)], color: COLS[Math.floor(Math.random() * COLS.length)], hit: false, anim: 0 });
      }

      function tryHit(x: number) {
        const lane = Math.min(LANES - 1, Math.floor(x / LW));
        const inZone = notes.find(n => !n.hit && n.lane === lane && Math.abs(n.y - HIT_Y) < OUTER);
        if (inZone) {
          inZone.hit = true; inZone.anim = 1;
          const dist = Math.abs(inZone.y - HIT_Y);
          if (dist < INNER) { updateScore(cfg.correctHitValue + 8); flashText = "PERFECT!"; flashColor = "#f59e0b"; playPerfect(); }
          else               { updateScore(cfg.correctHitValue);     flashText = "GOOD";     flashColor = "#06b6d4"; playHit(); }
          flashTimer = 28;
        } else {
          updateScore(-cfg.wrongHitPenalty); flashText = "MISS"; flashColor = "#ef4444"; flashTimer = 20; playMiss();
        }
      }

      const onClick = (e: MouseEvent) => tryHit(getXY(e).x);
      const onTouch = (e: TouchEvent) => { e.preventDefault(); tryHit(getXY(e).x); };
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("touchstart", onTouch, { passive: false });

      function loop() {
        ctx.fillStyle = "#03030b"; ctx.fillRect(0, 0, W, H);

        // Lane dividers
        ctx.setLineDash([4, 10]);
        for (let i = 1; i < LANES; i++) {
          ctx.strokeStyle = "rgba(168,85,247,0.12)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(i * LW, 0); ctx.lineTo(i * LW, H); ctx.stroke();
        }
        ctx.setLineDash([]);

        // Hit zone
        ctx.strokeStyle = "rgba(245,158,11,0.6)"; ctx.lineWidth = 2;
        ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(0, HIT_Y); ctx.lineTo(W, HIT_Y); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(245,158,11,0.12)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.rect(0, HIT_Y - OUTER, W, OUTER * 2); ctx.stroke();
        ctx.strokeStyle = "rgba(245,158,11,0.25)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.rect(0, HIT_Y - INNER, W, INNER * 2); ctx.stroke();

        // Spawn & speed
        spawnT++;
        speed = 2.8 + scoreRef.current / 150;
        const interval = Math.max(22, 55 - Math.floor(scoreRef.current / 80));
        if (spawnT >= interval) { spawn(); spawnT = 0; }

        // Draw notes
        for (let i = notes.length - 1; i >= 0; i--) {
          const n = notes[i];
          if (n.hit) {
            n.anim -= 0.055;
            if (n.anim <= 0) { notes.splice(i, 1); continue; }
            const cx = n.lane * LW + LW / 2;
            ctx.globalAlpha = n.anim;
            ctx.strokeStyle = n.color; ctx.lineWidth = 2.5; ctx.shadowColor = n.color; ctx.shadowBlur = 22;
            ctx.beginPath(); ctx.arc(cx, n.y, 32 * (1.6 - n.anim), 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0; ctx.globalAlpha = 1; continue;
          }
          n.y += speed;
          if (n.y > HIT_Y + OUTER + 12) {
            updateScore(-Math.floor(cfg.wrongHitPenalty / 2)); notes.splice(i, 1);
            flashText = "LOST"; flashColor = "#ef444460"; flashTimer = 14; playMiss(); continue;
          }
          const cx = n.lane * LW + LW / 2;
          const glow = Math.abs(n.y - HIT_Y) < OUTER ? (1 - Math.abs(n.y - HIT_Y) / OUTER) * 28 : 0;
          ctx.font = "bold 24px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = n.color; ctx.shadowColor = n.color; ctx.shadowBlur = glow;
          ctx.fillText(n.sym, cx, n.y); ctx.shadowBlur = 0;
        }

        // Flash text
        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 28; ctx.font = "bold 22px Orbitron";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 28;
          ctx.fillText(flashText, W / 2, HIT_Y - 80); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }

        // Lane tap zones
        for (let i = 0; i < LANES; i++) {
          ctx.fillStyle = "rgba(255,255,255,0.03)";
          ctx.fillRect(i * LW + 1, H - 42, LW - 2, 40);
          ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
          ctx.fillText(["LEFT", "CENTER", "RIGHT"][i], i * LW + LW / 2, H - 18);
        }

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", onClick); canvas.removeEventListener("touchstart", onTouch); cancelAnimationFrame(rafRef.current); };
    }

    // ─────────────────────────────────────────────────────
    // 2. PENDULUM ENGINE — spinning dial, tap on marker
    // ─────────────────────────────────────────────────────
    if (engine === "pendulum") {
      const CX = W / 2, CY = H / 2;
      const R = Math.min(W, H) * 0.38;
      let angle = -Math.PI / 2; // needle starts at top
      let angSpeed = 0.022 + Math.random() * 0.008;
      let markers: { angle: number; hit: boolean; hitAnim: number }[] = [];
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let hitRing = 0;
      const TOL = 0.14; // radians tolerance

      function addMarker() {
        const blocked = markers.map(m => m.angle);
        let a: number;
        do { a = Math.random() * Math.PI * 2 - Math.PI; } while (blocked.some(b => Math.abs(b - a) < 0.5));
        markers.push({ angle: a, hit: false, hitAnim: 0 });
        if (markers.length > 3) markers.splice(0, 1);
      }
      addMarker(); addMarker();

      function normalizeAngle(a: number) { return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI; }

      function tryHit() {
        const na = normalizeAngle(angle);
        const hit = markers.find(m => !m.hit && Math.abs(normalizeAngle(m.angle) - na) < TOL);
        if (hit) {
          hit.hit = true; hit.hitAnim = 1;
          updateScore(cfg.correctHitValue); flashText = "CRACKED!"; flashColor = "#f59e0b";
          flashTimer = 35; hitRing = 1; playPerfect();
          angSpeed = Math.min(0.07, angSpeed + 0.005);
          setTimeout(() => { if (!gameEndedRef.current) addMarker(); }, 400);
        } else {
          updateScore(-cfg.wrongHitPenalty); flashText = "MISS"; flashColor = "#ef4444"; flashTimer = 20; playMiss();
        }
      }

      const onClick = () => tryHit();
      const onTouch = (e: TouchEvent) => { e.preventDefault(); tryHit(); };
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("touchstart", onTouch, { passive: false });

      function loop() {
        ctx.fillStyle = "#04040e"; ctx.fillRect(0, 0, W, H);

        // Decorative rings
        for (let i = 3; i >= 1; i--) {
          ctx.strokeStyle = `rgba(100,50,180,${0.06 * i})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(CX, CY, R + i * 14, 0, Math.PI * 2); ctx.stroke();
        }

        // Dial background
        const grad = ctx.createRadialGradient(CX, CY, 0, CX, CY, R);
        grad.addColorStop(0, "rgba(30,15,60,0.9)"); grad.addColorStop(1, "rgba(10,5,25,0.9)");
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(168,85,247,0.4)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.stroke();

        // Tick marks
        for (let i = 0; i < 36; i++) {
          const a = (i / 36) * Math.PI * 2;
          const isMain = i % 3 === 0;
          const inner = R - (isMain ? 16 : 8);
          ctx.strokeStyle = isMain ? "rgba(168,85,247,0.5)" : "rgba(168,85,247,0.2)";
          ctx.lineWidth = isMain ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(CX + Math.cos(a) * inner, CY + Math.sin(a) * inner);
          ctx.lineTo(CX + Math.cos(a) * (R - 2), CY + Math.sin(a) * (R - 2));
          ctx.stroke();
        }

        // Markers
        for (const m of markers) {
          const mx = CX + Math.cos(m.angle) * (R - 20);
          const my = CY + Math.sin(m.angle) * (R - 20);
          if (m.hit) {
            m.hitAnim -= 0.04;
            if (m.hitAnim < 0) { m.hitAnim = 0; continue; }
            ctx.globalAlpha = m.hitAnim;
            ctx.fillStyle = "#f59e0b"; ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 30;
            ctx.beginPath(); ctx.arc(mx, my, 10 * (2 - m.hitAnim), 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0; ctx.globalAlpha = 1;
          } else {
            const pulse = 0.7 + Math.sin(Date.now() * 0.006) * 0.3;
            ctx.fillStyle = "#ef4444"; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 14 * pulse;
            ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2); ctx.fill();
          }
        }

        // Needle
        angle += angSpeed;
        const nx = CX + Math.cos(angle) * R * 0.88;
        const ny = CY + Math.sin(angle) * R * 0.88;
        const bx = CX + Math.cos(angle + Math.PI) * R * 0.18;
        const by = CY + Math.sin(angle + Math.PI) * R * 0.18;
        ctx.strokeStyle = "#a855f7"; ctx.lineWidth = 3; ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(nx, ny); ctx.stroke();
        ctx.fillStyle = "#a855f7";
        ctx.beginPath(); ctx.arc(nx, ny, 5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Center hub
        if (hitRing > 0) {
          hitRing -= 0.04;
          ctx.strokeStyle = `rgba(245,158,11,${hitRing})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(CX, CY, 24 * (1 + (1 - hitRing) * 0.5), 0, Math.PI * 2); ctx.stroke();
        }
        const hubGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, 14);
        hubGrad.addColorStop(0, "#c084fc"); hubGrad.addColorStop(1, "#7c3aed");
        ctx.fillStyle = hubGrad; ctx.beginPath(); ctx.arc(CX, CY, 12, 0, Math.PI * 2); ctx.fill();

        // Flash text
        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 35; ctx.font = "bold 20px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 25;
          ctx.fillText(flashText, W / 2, CY - R - 30); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }

        ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("TAP WHEN NEEDLE HITS THE RED MARKER", W / 2, H - 20);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", onClick); canvas.removeEventListener("touchstart", onTouch); cancelAnimationFrame(rafRef.current); };
    }

    // ─────────────────────────────────────────────────────
    // 3. POWERBAR ENGINE — oscillating needle, hit sweet spot
    // ─────────────────────────────────────────────────────
    if (engine === "powerbar") {
      const BX = W / 2 - 30, BY = 60, BH = H - 140, BW = 60;
      let needleY = BY + BH * 0.5;
      let needleDir = -1;
      let needleSpeed = 3.5;
      let greenH = BH * 0.22; // height of green zone (shrinks over time)
      let energy = 50; // 0-100
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let sparks: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
      let hitCount = 0;

      function emitSparks(cx: number, cy: number, color: string) {
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2;
          sparks.push({ x: cx, y: cy, vx: Math.cos(a) * (2 + Math.random() * 4), vy: Math.sin(a) * (2 + Math.random() * 4), life: 1, color });
        }
      }

      function tryHit() {
        const greenTop = BY + BH * (1 - energy / 100) - greenH / 2;
        const inGreen = needleY >= greenTop && needleY <= greenTop + greenH;
        if (inGreen) {
          energy = Math.min(100, energy + 12);
          hitCount++;
          if (hitCount % 5 === 0 && greenH > BH * 0.06) greenH -= BH * 0.025;
          updateScore(cfg.correctHitValue); flashText = "CHARGED!"; flashColor = "#10b981"; flashTimer = 30;
          emitSparks(BX + BW / 2, needleY, "#10b981"); playHit();
          needleSpeed = Math.min(10, needleSpeed + 0.25);
        } else {
          energy = Math.max(0, energy - 15);
          updateScore(-cfg.wrongHitPenalty); flashText = "SHOCK!"; flashColor = "#ef4444"; flashTimer = 25;
          emitSparks(BX + BW / 2, needleY, "#ef4444"); playMiss();
        }
      }

      const onClick = () => tryHit();
      const onTouch = (e: TouchEvent) => { e.preventDefault(); tryHit(); };
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("touchstart", onTouch, { passive: false });

      function loop() {
        ctx.fillStyle = "#020914"; ctx.fillRect(0, 0, W, H);

        // Circuit BG lines
        ctx.strokeStyle = "rgba(6,182,212,0.05)"; ctx.lineWidth = 1;
        for (let i = 0; i < W; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
        for (let j = 0; j < H; j += 32) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(W, j); ctx.stroke(); }

        // Energy bar background
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.beginPath(); ctx.roundRect(BX - 2, BY - 2, BW + 4, BH + 4, 8); ctx.fill();
        ctx.strokeStyle = "rgba(6,182,212,0.3)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(BX - 2, BY - 2, BW + 4, BH + 4, 8); ctx.stroke();

        // Bar fill (energy level)
        const fillH = (energy / 100) * BH;
        const barGrad = ctx.createLinearGradient(0, BY + BH, 0, BY);
        barGrad.addColorStop(0, "rgba(239,68,68,0.6)");
        barGrad.addColorStop(0.4, "rgba(245,158,11,0.6)");
        barGrad.addColorStop(1, "rgba(16,185,129,0.7)");
        ctx.fillStyle = barGrad;
        ctx.beginPath(); ctx.roundRect(BX, BY + BH - fillH, BW, fillH, 4); ctx.fill();

        // Green sweet spot zone
        const greenTop = BY + BH * (1 - energy / 100) - greenH / 2;
        const zoneGrad = ctx.createLinearGradient(0, greenTop, 0, greenTop + greenH);
        zoneGrad.addColorStop(0, "rgba(16,185,129,0)");
        zoneGrad.addColorStop(0.5, "rgba(16,185,129,0.55)");
        zoneGrad.addColorStop(1, "rgba(16,185,129,0)");
        ctx.fillStyle = zoneGrad;
        ctx.beginPath(); ctx.roundRect(BX, greenTop, BW, greenH, 4); ctx.fill();
        ctx.strokeStyle = "#10b981"; ctx.lineWidth = 2;
        ctx.shadowColor = "#10b981"; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(BX - 8, greenTop + greenH / 2); ctx.lineTo(BX + BW + 8, greenTop + greenH / 2); ctx.stroke();
        ctx.shadowBlur = 0;

        // Needle
        needleY += needleDir * needleSpeed;
        if (needleY <= BY + 4 || needleY >= BY + BH - 4) needleDir *= -1;
        const needleColor = "#e0aaff";
        ctx.strokeStyle = needleColor; ctx.lineWidth = 4; ctx.shadowColor = needleColor; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.moveTo(BX - 14, needleY); ctx.lineTo(BX + BW + 14, needleY); ctx.stroke();
        ctx.fillStyle = needleColor;
        ctx.beginPath(); ctx.moveTo(BX - 14, needleY - 6); ctx.lineTo(BX - 2, needleY); ctx.lineTo(BX - 14, needleY + 6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(BX + BW + 14, needleY - 6); ctx.lineTo(BX + BW + 2, needleY); ctx.lineTo(BX + BW + 14, needleY + 6); ctx.fill();
        ctx.shadowBlur = 0;

        // Energy % label
        ctx.fillStyle = energy > 60 ? "#10b981" : energy > 30 ? "#f59e0b" : "#ef4444";
        ctx.font = "bold 18px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`${Math.round(energy)}%`, BX + BW / 2, BY + BH + 30);

        // Sparks
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i]; s.x += s.vx; s.y += s.vy; s.vy += 0.15; s.life -= 0.06;
          if (s.life <= 0) { sparks.splice(i, 1); continue; }
          ctx.globalAlpha = s.life; ctx.fillStyle = s.color;
          ctx.beginPath(); ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Flash text
        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 30; ctx.font = "bold 22px Orbitron";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 25;
          ctx.fillText(flashText, BX < 80 ? W * 0.7 : W * 0.3, H / 2); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }

        ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("TAP WHEN THE NEEDLE IS IN THE GREEN ZONE", W / 2, H - 20);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", onClick); canvas.removeEventListener("touchstart", onTouch); cancelAnimationFrame(rafRef.current); };
    }

    // ─────────────────────────────────────────────────────
    // 4. METEOR ENGINE — colored meteors fall, tap to change basket color
    // ─────────────────────────────────────────────────────
    if (engine === "meteor") {
      const METEOR_COLS = ["#a855f7", "#06b6d4", "#f59e0b", "#10b981", "#f97316"];
      const NAMES = ["PURPLE", "CYAN", "AMBER", "GREEN", "ORANGE"];
      interface Meteor { x: number; y: number; color: string; cidx: number; vy: number; r: number; tail: {x:number;y:number}[]; }
      let meteors: Meteor[] = [];
      let basketCidx = 0;
      let basketX = W / 2;
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let pts: { x: number; y: number; text: string; life: number; color: string }[] = [];
      let spawnT = 0;
      const BW = 80, BH = 18, BY = H - 55;

      function spawnMeteor() {
        const cidx = Math.floor(Math.random() * METEOR_COLS.length);
        meteors.push({ x: 30 + Math.random() * (W - 60), y: -20, color: METEOR_COLS[cidx], cidx, vy: 2.5 + Math.random() * 2 + scoreRef.current / 200, r: 14 + Math.random() * 8, tail: [] });
      }

      canvas.addEventListener("touchstart", (e: TouchEvent) => {
        e.preventDefault();
        const { x } = getXY(e);
        basketX = Math.max(BW / 2 + 10, Math.min(W - BW / 2 - 10, x));
      }, { passive: false });
      canvas.addEventListener("click", (e: MouseEvent) => {
        const { x } = getXY(e);
        basketX = Math.max(BW / 2 + 10, Math.min(W - BW / 2 - 10, x));
      });

      let pointerDown = false;
      canvas.addEventListener("pointerdown", () => { pointerDown = true; });
      canvas.addEventListener("pointermove", (e: PointerEvent) => {
        if (!pointerDown) return;
        const r = canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) * (W / r.width);
        basketX = Math.max(BW / 2 + 10, Math.min(W - BW / 2 - 10, x));
      });
      canvas.addEventListener("pointerup", () => { pointerDown = false; });

      function loop() {
        ctx.fillStyle = "#020616"; ctx.fillRect(0, 0, W, H);

        // Stars
        const t = Date.now() * 0.0003;
        for (let i = 0; i < 40; i++) {
          const sx = ((i * 37 + 100) % W), sy = ((i * 53 + 200) % (H - 80));
          ctx.globalAlpha = 0.15 + Math.sin(t + i) * 0.1;
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx, sy, 0.8, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Spawn
        spawnT++;
        if (spawnT >= Math.max(35, 80 - Math.floor(scoreRef.current / 60))) { spawnMeteor(); spawnT = 0; }

        // Meteors
        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i];
          m.tail.push({ x: m.x, y: m.y });
          if (m.tail.length > 12) m.tail.shift();
          m.y += m.vy;

          // Tail
          for (let j = 0; j < m.tail.length; j++) {
            const alpha = (j / m.tail.length) * 0.5;
            ctx.globalAlpha = alpha; ctx.fillStyle = m.color;
            ctx.beginPath(); ctx.arc(m.tail[j].x, m.tail[j].y, m.r * (j / m.tail.length) * 0.8, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;

          // Draw meteor
          const grd = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
          grd.addColorStop(0, m.color + "ff"); grd.addColorStop(0.5, m.color + "aa"); grd.addColorStop(1, m.color + "00");
          ctx.fillStyle = grd; ctx.shadowColor = m.color; ctx.shadowBlur = 16;
          ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

          // Hit basket?
          if (m.y + m.r >= BY && m.y - m.r < BY + BH && Math.abs(m.x - basketX) < BW / 2 + m.r * 0.5) {
            if (m.cidx === basketCidx) {
              updateScore(cfg.correctHitValue); flashText = "CATCH!"; flashColor = m.color; flashTimer = 30; playHit();
              pts.push({ x: m.x, y: BY, text: `+${cfg.correctHitValue}`, life: 1, color: m.color });
              basketCidx = (basketCidx + Math.floor(Math.random() * METEOR_COLS.length - 1) + 1) % METEOR_COLS.length;
            } else {
              updateScore(-cfg.wrongHitPenalty); flashText = "WRONG COLOR!"; flashColor = "#ef4444"; flashTimer = 25; playMiss();
            }
            meteors.splice(i, 1); continue;
          }

          // Missed
          if (m.y > H + 30) {
            updateScore(-Math.floor(cfg.wrongHitPenalty / 2)); flashText = "MISSED"; flashColor = "#ef444460"; flashTimer = 15; playMiss();
            meteors.splice(i, 1);
          }
        }

        // Score popups
        for (let i = pts.length - 1; i >= 0; i--) {
          const p = pts[i]; p.y -= 1.5; p.life -= 0.04;
          if (p.life <= 0) { pts.splice(i, 1); continue; }
          ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.font = "bold 16px Orbitron";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(p.text, p.x, p.y);
        }
        ctx.globalAlpha = 1;

        // Basket
        const bx = basketX - BW / 2;
        const bc = METEOR_COLS[basketCidx];
        const bgrd = ctx.createLinearGradient(bx, BY, bx, BY + BH);
        bgrd.addColorStop(0, bc + "50"); bgrd.addColorStop(1, bc + "20");
        ctx.fillStyle = bgrd; ctx.strokeStyle = bc; ctx.lineWidth = 2.5;
        ctx.shadowColor = bc; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.roundRect(bx, BY, BW, BH, 6); ctx.fill();
        ctx.beginPath(); ctx.roundRect(bx, BY, BW, BH, 6); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = bc; ctx.font = "bold 11px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(NAMES[basketCidx], basketX, BY + BH / 2);

        // Flash text
        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 30; ctx.font = "bold 22px Orbitron";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 25;
          ctx.fillText(flashText, W / 2, H * 0.38); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }

        ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("DRAG BASKET TO MATCH METEOR COLORS", W / 2, H - 18);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(rafRef.current);
    }

    // ─────────────────────────────────────────────────────
    // 5. LASER ENGINE — corridor runner, tap to dodge laser gates
    // ─────────────────────────────────────────────────────
    if (engine === "laser") {
      const ROWS = 3;
      const ROW_H = (H - 80) / ROWS;
      const BALL_X = 70;
      let ballRow = 1; // 0 = top, 1 = mid, 2 = bot
      let ballAnim = ballRow * ROW_H + ROW_H / 2 + 40; // actual Y of ball
      interface Gate { x: number; openRow: number; color: string; passed: boolean; }
      let gates: Gate[] = [];
      let bgOffset = 0;
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let hitFlash = 0;
      let spawnT = 0;
      const GATE_SPEED_BASE = 3.5;

      function spawnGate() {
        const openRow = Math.floor(Math.random() * ROWS);
        const COLS_G = ["#ef4444", "#f97316", "#a855f7", "#ec4899", "#06b6d4"];
        gates.push({ x: W + 40, openRow, color: COLS_G[Math.floor(Math.random() * COLS_G.length)], passed: false });
      }

      function tryMove(y: number) {
        const clickRow = Math.min(ROWS - 1, Math.floor((y - 40) / ROW_H));
        ballRow = clickRow;
      }

      const onClick = (e: MouseEvent) => tryMove(getXY(e).y);
      const onTouch = (e: TouchEvent) => { e.preventDefault(); tryMove(getXY(e).y); };
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("touchstart", onTouch, { passive: false });

      function loop() {
        ctx.fillStyle = "#020b18"; ctx.fillRect(0, 0, W, H);

        // Scrolling grid floor
        bgOffset += 2;
        ctx.strokeStyle = "rgba(6,182,212,0.07)"; ctx.lineWidth = 1;
        const gx = (bgOffset % 40);
        for (let x = -gx; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, H - 40); ctx.stroke(); }
        for (let row = 0; row <= ROWS; row++) {
          const ry = 40 + row * ROW_H;
          ctx.strokeStyle = "rgba(6,182,212,0.15)"; ctx.lineWidth = row === 0 || row === ROWS ? 2 : 0.8;
          ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(W, ry); ctx.stroke();
        }

        // Row labels (left side)
        for (let r = 0; r < ROWS; r++) {
          const ry = 40 + r * ROW_H + ROW_H / 2;
          ctx.fillStyle = r === ballRow ? "rgba(168,85,247,0.15)" : "transparent";
          ctx.fillRect(0, 40 + r * ROW_H, W, ROW_H);
        }

        // Ball
        const targetY = 40 + ballRow * ROW_H + ROW_H / 2;
        ballAnim += (targetY - ballAnim) * 0.2;
        const bpulse = Math.sin(Date.now() * 0.008) * 3;
        if (hitFlash > 0) {
          ctx.strokeStyle = `rgba(239,68,68,${hitFlash / 20})`; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(BALL_X, ballAnim, 22 + bpulse, 0, Math.PI * 2); ctx.stroke();
          hitFlash--;
        }
        ctx.fillStyle = "#a855f7"; ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 22 + bpulse;
        ctx.beginPath(); ctx.arc(BALL_X, ballAnim, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#e9d5ff";
        ctx.beginPath(); ctx.arc(BALL_X - 3, ballAnim - 3, 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Gates
        spawnT++;
        const gSpeed = Math.min(9, GATE_SPEED_BASE + scoreRef.current / 200);
        const interval = Math.max(60, 120 - Math.floor(scoreRef.current / 50));
        if (spawnT >= interval) { spawnGate(); spawnT = 0; }

        for (let i = gates.length - 1; i >= 0; i--) {
          const g = gates[i];
          g.x -= gSpeed;
          if (g.x < -50) { gates.splice(i, 1); continue; }

          // Draw gate bars
          for (let r = 0; r < ROWS; r++) {
            if (r === g.openRow) continue;
            const gy = 40 + r * ROW_H + 4, gh = ROW_H - 8;
            const lgrd = ctx.createLinearGradient(g.x - 8, 0, g.x + 8, 0);
            lgrd.addColorStop(0, g.color + "00"); lgrd.addColorStop(0.5, g.color + "cc"); lgrd.addColorStop(1, g.color + "00");
            ctx.fillStyle = lgrd; ctx.shadowColor = g.color; ctx.shadowBlur = 14;
            ctx.beginPath(); ctx.roundRect(g.x - 8, gy, 16, gh, 4); ctx.fill();
            ctx.shadowBlur = 0;
          }

          // Open gap indicator
          const ogy = 40 + g.openRow * ROW_H + 6;
          ctx.strokeStyle = g.color + "30"; ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
          ctx.beginPath(); ctx.rect(g.x - 6, ogy, 12, ROW_H - 12); ctx.stroke();
          ctx.setLineDash([]);

          // Collision check
          if (!g.passed && Math.abs(g.x - BALL_X) < 18) {
            if (g.openRow !== ballRow) {
              updateScore(-cfg.wrongHitPenalty); flashText = "HIT LASER!"; flashColor = "#ef4444"; flashTimer = 28; hitFlash = 20; playMiss();
            } else {
              updateScore(cfg.correctHitValue); flashText = "DODGED!"; flashColor = "#10b981"; flashTimer = 22; playHit();
            }
            g.passed = true;
          }
        }

        // Flash text
        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 28; ctx.font = "bold 20px Orbitron";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 22;
          ctx.fillText(flashText, W * 0.6, H * 0.35); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }

        ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("TAP A ROW TO MOVE THROUGH THE OPEN LASER GATE", W / 2, H - 20);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", onClick); canvas.removeEventListener("touchstart", onTouch); cancelAnimationFrame(rafRef.current); };
    }

    // ─────────────────────────────────────────────────────
    // 6. STACK ENGINE — classic stacker
    // ─────────────────────────────────────────────────────
    if (engine === "stack") {
      const BLOCK_H = 28;
      const COLORS = ["#a855f7", "#06b6d4", "#f59e0b", "#10b981", "#f97316", "#ec4899", "#3b82f6", "#84cc16"];
      const SYMS = ["₿", "Ξ", "Ŧ", "◎", "Ⓢ", "◈"];
      interface Block { x: number; y: number; w: number; color: string; sym: string; }
      let stack: Block[] = [];
      let current = { x: 0, w: W * 0.65, dir: 1, speed: 3.5 };
      let phase: "moving" | "dropped" | "failed" = "moving";
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
      let blockCount = 0;

      // First base block
      const baseY = H - 60;
      const bw = current.w;
      stack.push({ x: (W - bw) / 2, y: baseY, w: bw, color: COLORS[0], sym: SYMS[0] });

      function getCurrentBlockY() {
        return stack.length > 0 ? stack[stack.length - 1].y - BLOCK_H : baseY;
      }

      function dropBlock() {
        if (phase !== "moving") return;
        phase = "dropped";
        const prev = stack[stack.length - 1];
        const curLeft = current.x, curRight = current.x + current.w;
        const prevLeft = prev.x, prevRight = prev.x + prev.w;
        const left = Math.max(curLeft, prevLeft);
        const right = Math.min(curRight, prevRight);
        const overlap = right - left;

        if (overlap <= 0) {
          // Missed completely
          updateScore(-cfg.wrongHitPenalty); flashText = "FELL OFF!"; flashColor = "#ef4444"; flashTimer = 35; playMiss();
          // Emit fall particles
          for (let i = 0; i < 10; i++) {
            const a = Math.random() * Math.PI * 2;
            particles.push({ x: current.x + current.w / 2, y: getCurrentBlockY(), vx: Math.cos(a) * 4, vy: Math.sin(a) * 4 - 2, life: 1, color: COLORS[blockCount % COLORS.length] });
          }
          setTimeout(() => { if (!gameEndedRef.current) phase = "moving"; }, 600);
          return;
        }

        // Trim and land
        const isPerfect = Math.abs(overlap - prev.w) < 4;
        const newBlock: Block = {
          x: left, y: getCurrentBlockY(), w: overlap,
          color: COLORS[(blockCount + 1) % COLORS.length],
          sym: SYMS[(blockCount + 1) % SYMS.length],
        };
        stack.push(newBlock);
        blockCount++;

        if (isPerfect) {
          updateScore(cfg.correctHitValue + 5); flashText = "PERFECT!"; flashColor = "#f59e0b"; flashTimer = 35; playPerfect();
        } else {
          updateScore(cfg.correctHitValue); flashText = "STACKED!"; flashColor = "#10b981"; flashTimer = 28; playHit();
        }

        // Chop particles
        if (!isPerfect) {
          const chopW = current.w - overlap;
          const chopX = overlap > 0 ? (curLeft < prevLeft ? curLeft : curRight - chopW) : current.x;
          for (let i = 0; i < 8; i++) {
            particles.push({ x: chopX + Math.random() * chopW, y: newBlock.y, vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 3, life: 1, color: newBlock.color });
          }
        }

        // Update current
        const newW = Math.max(10, newBlock.w);
        current = { x: newBlock.x, w: newW, dir: Math.random() < 0.5 ? 1 : -1, speed: Math.min(10, 3.5 + blockCount * 0.3) };

        // Scroll view if needed
        if (stack.length > 14) stack.shift();

        setTimeout(() => { if (!gameEndedRef.current) phase = "moving"; }, 200);
      }

      const onClick = () => dropBlock();
      const onTouch = (e: TouchEvent) => { e.preventDefault(); dropBlock(); };
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("touchstart", onTouch, { passive: false });

      function loop() {
        ctx.fillStyle = "#040410"; ctx.fillRect(0, 0, W, H);

        // Grid bg
        ctx.strokeStyle = "rgba(168,85,247,0.04)"; ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        // Draw stack
        const stackOffsetY = Math.max(0, (stack.length - 12) * BLOCK_H);
        for (const b of stack) {
          const ry = b.y - stackOffsetY;
          const grad = ctx.createLinearGradient(b.x, ry, b.x + b.w, ry + BLOCK_H);
          grad.addColorStop(0, b.color + "cc"); grad.addColorStop(1, b.color + "66");
          ctx.fillStyle = grad;
          ctx.shadowColor = b.color; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.roundRect(b.x, ry, b.w, BLOCK_H - 3, 4); ctx.fill();
          ctx.strokeStyle = b.color + "80"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(b.x, ry, b.w, BLOCK_H - 3, 4); ctx.stroke();
          ctx.shadowBlur = 0;
          if (b.w > 24) {
            ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = `bold ${Math.min(12, b.w / 4)}px Orbitron`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(b.sym, b.x + b.w / 2, ry + BLOCK_H / 2 - 1.5);
          }
        }

        // Moving current block
        if (phase === "moving") {
          current.x += current.dir * current.speed;
          if (current.x < 0) { current.x = 0; current.dir = 1; }
          if (current.x + current.w > W) { current.x = W - current.w; current.dir = -1; }

          const cy = getCurrentBlockY() - stackOffsetY;
          const cc = COLORS[blockCount % COLORS.length];
          const cgrad = ctx.createLinearGradient(current.x, cy, current.x + current.w, cy + BLOCK_H);
          cgrad.addColorStop(0, cc + "dd"); cgrad.addColorStop(1, cc + "88");
          ctx.fillStyle = cgrad; ctx.shadowColor = cc; ctx.shadowBlur = 18;
          ctx.beginPath(); ctx.roundRect(current.x, cy, current.w, BLOCK_H - 3, 4); ctx.fill();
          ctx.strokeStyle = cc; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(current.x, cy, current.w, BLOCK_H - 3, 4); ctx.stroke();
          ctx.shadowBlur = 0;
          if (current.w > 24) {
            ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.min(12, current.w / 4)}px Orbitron`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(SYMS[blockCount % SYMS.length], current.x + current.w / 2, cy + BLOCK_H / 2 - 1.5);
          }
        }

        // Particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.05;
          if (p.life <= 0) { particles.splice(i, 1); continue; }
          ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y - stackOffsetY, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Flash text
        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 35; ctx.font = "bold 22px Orbitron";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 28;
          ctx.fillText(flashText, W / 2, 80); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }

        // Block count
        ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.font = "10px Orbitron"; ctx.textAlign = "right";
        ctx.fillText(`BLOCKS: ${blockCount}`, W - 14, 30);

        ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("TAP TO DROP THE BLOCK ON THE STACK", W / 2, H - 20);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", onClick); canvas.removeEventListener("touchstart", onTouch); cancelAnimationFrame(rafRef.current); };
    }

    // ─────────────────────────────────────────────────────
    // 7. GRAVITY ENGINE — auto-runner with gravity flip
    // ─────────────────────────────────────────────────────
    if (engine === "gravity") {
      const TOP_WALL = 50, BOT_WALL = H - 50;
      let ballY = (TOP_WALL + BOT_WALL) / 2;
      let ballVY = 0;
      let gravDir = 1; // 1 = down, -1 = up
      interface Wall { x: number; gapY: number; gapH: number; color: string; passed: boolean; }
      let walls: Wall[] = [];
      let bgOff = 0;
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let trail: { x: number; y: number }[] = [];
      let spawnT = 0;
      const BALL_X = 80;
      const GRAV_STR = 0.35;
      const WALL_COLORS = ["#a855f7", "#06b6d4", "#f97316", "#ec4899", "#10b981"];
      let flipFlash = 0;
      let dist = 0;

      function flip() {
        gravDir *= -1; ballVY = -ballVY * 0.5 + gravDir * (-2);
        flipFlash = 12; playHit();
      }

      const onClick = () => flip();
      const onTouch = (e: TouchEvent) => { e.preventDefault(); flip(); };
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("touchstart", onTouch, { passive: false });

      function spawnWall() {
        const gapH = Math.max(110 - Math.floor(scoreRef.current / 80) * 6, 65);
        const range = (BOT_WALL - TOP_WALL) - gapH - 20;
        const gapY = TOP_WALL + 10 + Math.random() * range;
        const color = WALL_COLORS[walls.length % WALL_COLORS.length];
        walls.push({ x: W + 20, gapY, gapH, color, passed: false });
      }

      function loop() {
        ctx.fillStyle = "#030610"; ctx.fillRect(0, 0, W, H);

        // Scrolling neon grid
        bgOff += 3; dist++;
        const go = bgOff % 50;
        ctx.strokeStyle = "rgba(168,85,247,0.06)"; ctx.lineWidth = 1;
        for (let x = -go; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x, TOP_WALL); ctx.lineTo(x, BOT_WALL); ctx.stroke(); }

        // Walls (top/bottom)
        ctx.fillStyle = "rgba(6,182,212,0.5)"; ctx.shadowColor = "#06b6d4"; ctx.shadowBlur = 12;
        ctx.fillRect(0, 0, W, TOP_WALL);
        ctx.fillRect(0, BOT_WALL, W, H - BOT_WALL);
        ctx.shadowBlur = 0;
        // Wall edge glow
        ctx.strokeStyle = "#06b6d4"; ctx.lineWidth = 2; ctx.shadowColor = "#06b6d4"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(0, TOP_WALL); ctx.lineTo(W, TOP_WALL); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, BOT_WALL); ctx.lineTo(W, BOT_WALL); ctx.stroke();
        ctx.shadowBlur = 0;

        // Physics
        ballVY += GRAV_STR * gravDir;
        ballVY = Math.max(-8, Math.min(8, ballVY));
        ballY += ballVY;

        // Wall collision
        let died = false;
        if (ballY - 10 < TOP_WALL + 2) { ballY = TOP_WALL + 12; ballVY = Math.abs(ballVY) * 0.3; updateScore(-cfg.wrongHitPenalty); died = true; }
        if (ballY + 10 > BOT_WALL - 2) { ballY = BOT_WALL - 12; ballVY = -Math.abs(ballVY) * 0.3; updateScore(-cfg.wrongHitPenalty); died = true; }
        if (died) { flashText = "WALL HIT!"; flashColor = "#ef4444"; flashTimer = 20; playMiss(); }

        // Trail
        trail.push({ x: BALL_X, y: ballY });
        if (trail.length > 20) trail.shift();
        for (let i = 0; i < trail.length; i++) {
          ctx.globalAlpha = (i / trail.length) * 0.5;
          ctx.fillStyle = "#a855f7";
          ctx.beginPath(); ctx.arc(trail[i].x, trail[i].y, 6 * (i / trail.length), 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Ball
        if (flipFlash > 0) {
          ctx.strokeStyle = `rgba(245,158,11,${flipFlash / 12})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(BALL_X, ballY, 20, 0, Math.PI * 2); ctx.stroke();
          flipFlash--;
        }
        ctx.fillStyle = "#c084fc"; ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(BALL_X, ballY, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#f3e8ff"; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(BALL_X - 3, ballY - 3, 3.5, 0, Math.PI * 2); ctx.fill();

        // Gravity arrow
        const arrY = ballY + (gravDir === 1 ? 18 : -18);
        ctx.fillStyle = "rgba(245,158,11,0.6)"; ctx.font = "14px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(gravDir === 1 ? "▼" : "▲", BALL_X, arrY);

        // Spawn walls
        const wSpeed = Math.min(8, 3 + scoreRef.current / 150);
        spawnT++;
        if (spawnT >= Math.max(80, 150 - Math.floor(scoreRef.current / 40))) { spawnWall(); spawnT = 0; }

        for (let i = walls.length - 1; i >= 0; i--) {
          const w = walls[i];
          w.x -= wSpeed;
          if (w.x < -30) { walls.splice(i, 1); continue; }

          // Draw wall
          const ww = 20;
          ctx.fillStyle = w.color + "aa"; ctx.shadowColor = w.color; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.roundRect(w.x - ww / 2, TOP_WALL, ww, w.gapY - TOP_WALL, 3); ctx.fill();
          ctx.beginPath(); ctx.roundRect(w.x - ww / 2, w.gapY + w.gapH, ww, BOT_WALL - (w.gapY + w.gapH), 3); ctx.fill();
          ctx.shadowBlur = 0;
          // Gap guide line
          ctx.strokeStyle = w.color + "40"; ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
          ctx.beginPath(); ctx.moveTo(w.x, w.gapY + 2); ctx.lineTo(w.x, w.gapY + w.gapH - 2); ctx.stroke();
          ctx.setLineDash([]);

          // Collision (ball vs wall)
          if (Math.abs(w.x - BALL_X) < ww / 2 + 10) {
            const inGap = ballY > w.gapY && ballY < w.gapY + w.gapH;
            if (!inGap) {
              updateScore(-cfg.wrongHitPenalty); flashText = "CRASHED!"; flashColor = "#ef4444"; flashTimer = 22; playMiss();
              w.passed = true;
            } else if (!w.passed) {
              updateScore(cfg.correctHitValue); flashText = "THROUGH!"; flashColor = "#10b981"; flashTimer = 18; playHit();
              w.passed = true;
            }
          }
        }

        // Distance score
        if (dist % 8 === 0) {
          scoreRef.current = Math.max(scoreRef.current, Math.floor(dist / 8));
          setScore(scoreRef.current);
        }

        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 22; ctx.font = "bold 20px Orbitron";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 22;
          ctx.fillText(flashText, W * 0.6, (TOP_WALL + BOT_WALL) / 2); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }

        ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("TAP ANYWHERE TO FLIP GRAVITY", W / 2, H - 18);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", onClick); canvas.removeEventListener("touchstart", onTouch); cancelAnimationFrame(rafRef.current); };
    }

    // ─────────────────────────────────────────────────────
    // 8. SLASHER ENGINE — swipe to slash objects
    // ─────────────────────────────────────────────────────
    if (engine === "slasher") {
      interface Obj { x: number; y: number; vx: number; vy: number; r: number; type: "enemy" | "friend" | "bomb"; slashed: boolean; slashAnim: number; sym: string; color: string; }
      let objs: Obj[] = [];
      let trail: { x: number; y: number; alpha: number }[] = [];
      let slashTrail: { x: number; y: number }[] = [];
      let sparks: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let spawnT = 0;
      let pointerDown = false;

      const ENEMY_SYMS = ["☠", "⚠", "✗", "⛔", "◈"];
      const FRIEND_SYMS = ["✓", "★", "♥", "◎", "⊕"];
      const BOMB_SYM = "💣";

      function spawnObj() {
        const side = Math.floor(Math.random() * 4);
        let sx: number, sy: number, vx: number, vy: number;
        const speed = 1.5 + Math.random() * 2 + scoreRef.current / 300;
        if (side === 0) { sx = Math.random() * W; sy = -30; vx = (Math.random() - 0.5) * speed; vy = speed; }
        else if (side === 1) { sx = W + 30; sy = Math.random() * H; vx = -speed; vy = (Math.random() - 0.5) * speed; }
        else if (side === 2) { sx = Math.random() * W; sy = H + 30; vx = (Math.random() - 0.5) * speed; vy = -speed; }
        else { sx = -30; sy = Math.random() * H; vx = speed; vy = (Math.random() - 0.5) * speed; }
        const rnd = Math.random();
        let type: "enemy" | "friend" | "bomb";
        if (rnd < 0.55) type = "enemy";
        else if (rnd < 0.85) type = "friend";
        else type = "bomb";
        const color = type === "enemy" ? "#ef4444" : type === "friend" ? "#10b981" : "#374151";
        const sym = type === "enemy" ? ENEMY_SYMS[Math.floor(Math.random() * ENEMY_SYMS.length)] : type === "friend" ? FRIEND_SYMS[Math.floor(Math.random() * FRIEND_SYMS.length)] : BOMB_SYM;
        objs.push({ x: sx!, y: sy!, vx: vx!, vy: vy!, r: 22 + Math.random() * 8, type, slashed: false, slashAnim: 0, sym, color });
      }

      function lineCircleHit(a: {x:number,y:number}, b: {x:number,y:number}, o: {x:number,y:number,r:number}) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const fx = a.x - o.x, fy = a.y - o.y;
        const A = dx*dx + dy*dy; if (A < 0.001) return false;
        const B = 2*(fx*dx + fy*dy), C = fx*fx + fy*fy - o.r*o.r;
        const disc = B*B - 4*A*C; if (disc < 0) return false;
        const t = (-B - Math.sqrt(disc)) / (2*A);
        return t >= 0 && t <= 1;
      }

      function slash(idx: number) {
        const o = objs[idx]; if (o.slashed) return;
        o.slashed = true; o.slashAnim = 1;
        for (let k = 0; k < 14; k++) {
          const a = Math.random() * Math.PI * 2;
          sparks.push({ x: o.x, y: o.y, vx: Math.cos(a) * (2 + Math.random() * 5), vy: Math.sin(a) * (2 + Math.random() * 5), life: 1, color: o.color });
        }
        if (o.type === "enemy") { updateScore(cfg.correctHitValue); flashText = "SLASH!"; flashColor = "#ef4444"; flashTimer = 20; playHit(); }
        else if (o.type === "friend") { updateScore(-cfg.wrongHitPenalty); flashText = "WRONG TARGET!"; flashColor = "#f59e0b"; flashTimer = 28; playMiss(); }
        else { updateScore(-cfg.wrongHitPenalty * 2); flashText = "BOMB!"; flashColor = "#374151"; flashTimer = 32; playMiss(); }
      }

      const onPointerDown = (e: PointerEvent) => {
        pointerDown = true; slashTrail = [];
        const r = canvas.getBoundingClientRect();
        slashTrail.push({ x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) });
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!pointerDown) return;
        const r = canvas.getBoundingClientRect();
        const pt = { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
        slashTrail.push(pt);
        if (slashTrail.length > 18) slashTrail.shift();
        if (slashTrail.length >= 2) {
          const a = slashTrail[slashTrail.length - 2], b = slashTrail[slashTrail.length - 1];
          for (let i = objs.length - 1; i >= 0; i--) {
            if (!objs[i].slashed && lineCircleHit(a, b, objs[i])) slash(i);
          }
        }
      };
      const onPointerUp = () => { pointerDown = false; setTimeout(() => { slashTrail = []; }, 200); };

      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);

      function loop() {
        ctx.fillStyle = "#03030a"; ctx.fillRect(0, 0, W, H);

        // Hex grid bg
        const hex = 28, t = Date.now() * 0.0005;
        for (let row = -1; row < H / hex + 1; row++) {
          for (let col = -1; col < W / hex + 1; col++) {
            const hx = col * hex * 1.5 + (row % 2 === 0 ? 0 : hex * 0.75);
            const hy = row * hex * 0.866;
            ctx.strokeStyle = `rgba(168,85,247,${0.04 + Math.sin(hx * 0.02 + hy * 0.02 + t) * 0.02})`; ctx.lineWidth = 0.5;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
              const a = k * Math.PI / 3;
              k === 0 ? ctx.moveTo(hx + Math.cos(a) * hex * 0.48, hy + Math.sin(a) * hex * 0.48) : ctx.lineTo(hx + Math.cos(a) * hex * 0.48, hy + Math.sin(a) * hex * 0.48);
            }
            ctx.closePath(); ctx.stroke();
          }
        }

        // Spawn
        spawnT++;
        if (spawnT >= Math.max(40, 80 - Math.floor(scoreRef.current / 80))) { spawnObj(); spawnT = 0; }

        // Objects
        for (let i = objs.length - 1; i >= 0; i--) {
          const o = objs[i];
          if (o.slashed) {
            o.slashAnim -= 0.05;
            if (o.slashAnim <= 0) { objs.splice(i, 1); continue; }
            ctx.globalAlpha = o.slashAnim;
            ctx.strokeStyle = o.color; ctx.lineWidth = 3; ctx.shadowColor = o.color; ctx.shadowBlur = 20;
            ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (2 - o.slashAnim), 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0; ctx.globalAlpha = 1; continue;
          }
          o.x += o.vx; o.y += o.vy;
          if (o.x < -60 || o.x > W + 60 || o.y < -60 || o.y > H + 60) {
            if (o.type === "enemy") { updateScore(-Math.floor(cfg.wrongHitPenalty / 2)); flashText = "ESCAPED!"; flashColor = "#f97316"; flashTimer = 15; }
            objs.splice(i, 1); continue;
          }
          // Draw object
          const pulse = 0.8 + Math.sin(Date.now() * 0.005 + o.x) * 0.2;
          ctx.fillStyle = o.color + "18"; ctx.strokeStyle = o.color; ctx.lineWidth = 2.5;
          ctx.shadowColor = o.color; ctx.shadowBlur = 12 * pulse;
          ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.fillStyle = o.type === "friend" ? "#10b981" : o.type === "bomb" ? "#9ca3af" : "#fca5a5";
          ctx.font = `bold ${Math.round(o.r * 0.85)}px Orbitron`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(o.sym, o.x, o.y);
        }

        // Slash trail
        if (slashTrail.length >= 2) {
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.7;
          ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 15;
          ctx.beginPath(); ctx.moveTo(slashTrail[0].x, slashTrail[0].y);
          for (const p of slashTrail) ctx.lineTo(p.x, p.y);
          ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        }

        // Sparks
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i]; s.x += s.vx; s.y += s.vy; s.vy += 0.1; s.life -= 0.06;
          if (s.life <= 0) { sparks.splice(i, 1); continue; }
          ctx.globalAlpha = s.life; ctx.fillStyle = s.color;
          ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Flash text
        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 32; ctx.font = "bold 22px Orbitron";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 28;
          ctx.fillText(flashText, W / 2, H * 0.25); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }

        // Legend
        ctx.fillStyle = "rgba(239,68,68,0.6)"; ctx.font = "8px Orbitron"; ctx.textAlign = "left";
        ctx.fillText("RED=SLASH", 12, H - 30);
        ctx.fillStyle = "rgba(16,185,129,0.6)"; ctx.fillText("GREEN=SPARE", 12, H - 18);
        ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.textAlign = "center";
        ctx.fillText("SWIPE TO SLASH HOSTILE TARGETS", W / 2, H - 6);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        cancelAnimationFrame(rafRef.current);
      };
    }

    // ─────────────────────────────────────────────────────
    // 9. SIMON ENGINE — memory sequence grid
    // ─────────────────────────────────────────────────────
    if (engine === "simon") {
      const ROWS_G = 3, COLS_G = 4, CELLS = ROWS_G * COLS_G;
      const SYMS_G = ["₿", "Ξ", "Ŧ", "◎", "Ⓢ", "◈", "⬡", "⬢", "Ð", "Ł", "ℕ", "Ⓒ"];
      const CELL_COLS = ["#a855f7","#06b6d4","#f59e0b","#10b981","#f97316","#ec4899","#3b82f6","#84cc16","#f43f5e","#8b5cf6","#14b8a6","#fb923c"];
      const TOP_PAD = 60;
      const cellW = W / COLS_G, cellH = (H - TOP_PAD - 60) / ROWS_G;

      let sequence: number[] = [];
      let playerSeq: number[] = [];
      let phase: "show" | "input" | "wait" = "show";
      let litCell = -1;
      let feedbackCell = -1;
      let feedbackOk = false;
      let feedbackTimer = 0;
      let round = 1;
      let cleanedUp = false;

      function addToSeq() { sequence.push(Math.floor(Math.random() * CELLS)); }
      addToSeq();

      function showSequence() {
        phase = "show"; litCell = -1; let i = 0;
        const showDur = Math.max(220, 500 - round * 25);
        const blankDur = Math.max(60, 150 - round * 8);
        function next() {
          if (cleanedUp) return;
          if (i < sequence.length) {
            litCell = sequence[i];
            playTone(300 + sequence[i] * 40, 0.15, "sine", 0.15);
            setTimeout(() => {
              if (cleanedUp) return;
              litCell = -1; i++;
              setTimeout(next, blankDur);
            }, showDur);
          } else {
            phase = "input"; playerSeq = [];
          }
        }
        setTimeout(next, 350);
      }
      showSequence();

      function tapCell(cellIdx: number) {
        if (phase !== "input") return;
        playerSeq.push(cellIdx);
        const pos = playerSeq.length - 1;
        if (cellIdx === sequence[pos]) {
          feedbackCell = cellIdx; feedbackOk = true; feedbackTimer = 30;
          updateScore(cfg.correctHitValue); playHit();
          if (playerSeq.length === sequence.length) {
            round++; phase = "wait";
            setTimeout(() => {
              if (cleanedUp) return;
              addToSeq(); showSequence();
            }, 700);
          }
        } else {
          feedbackCell = cellIdx; feedbackOk = false; feedbackTimer = 40;
          updateScore(-cfg.wrongHitPenalty); playMiss();
          phase = "wait";
          setTimeout(() => { if (cleanedUp) return; showSequence(); }, 900);
        }
      }

      const onClick = (e: MouseEvent) => {
        const { x, y } = getXY(e);
        const col = Math.min(COLS_G - 1, Math.floor(x / cellW));
        const row = Math.min(ROWS_G - 1, Math.floor((y - TOP_PAD) / cellH));
        if (row >= 0) tapCell(row * COLS_G + col);
      };
      const onTouch = (e: TouchEvent) => { e.preventDefault(); onClick(e as unknown as MouseEvent); };
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("touchstart", onTouch, { passive: false });

      function loop() {
        ctx.fillStyle = "#03030c"; ctx.fillRect(0, 0, W, H);

        // Header
        const phaseLabel = phase === "show" ? "WATCH  THE  SEQUENCE" : phase === "input" ? `YOUR TURN — ${playerSeq.length}/${sequence.length}` : "...";
        ctx.font = "bold 10px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = phase === "input" ? "#10b981" : "#a855f7";
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
        ctx.fillText(phaseLabel, W / 2, 30); ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(245,158,11,0.6)"; ctx.font = "8px Orbitron";
        ctx.fillText(`ROUND ${round}  —  SEQ ${sequence.length}`, W / 2, 50);

        // Grid
        for (let r = 0; r < ROWS_G; r++) {
          for (let c = 0; c < COLS_G; c++) {
            const idx = r * COLS_G + c;
            const cx = c * cellW, cy = TOP_PAD + r * cellH;
            const ccx = cx + cellW / 2, ccy = cy + cellH / 2;
            const isLit = litCell === idx;
            const isFb = feedbackCell === idx && feedbackTimer > 0;
            const col = CELL_COLS[idx];
            const fbCol = feedbackOk ? "#10b981" : "#ef4444";

            // Background
            ctx.fillStyle = isLit ? col + "28" : isFb ? fbCol + "22" : "rgba(255,255,255,0.03)";
            ctx.beginPath(); ctx.roundRect(cx + 4, cy + 4, cellW - 8, cellH - 8, 10); ctx.fill();

            // Border
            ctx.strokeStyle = isLit ? col : isFb ? fbCol : "rgba(255,255,255,0.07)";
            ctx.lineWidth = isLit ? 2.5 : isFb ? 2.5 : 1;
            if (isLit || isFb) { ctx.shadowColor = isLit ? col : fbCol; ctx.shadowBlur = 20; }
            ctx.beginPath(); ctx.roundRect(cx + 4, cy + 4, cellW - 8, cellH - 8, 10); ctx.stroke();
            ctx.shadowBlur = 0;

            // Symbol
            ctx.font = `${isLit || isFb ? "bold " : ""}${Math.min(cellW, cellH) * 0.4}px Orbitron`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillStyle = isLit ? col : isFb ? fbCol : "rgba(255,255,255,0.2)";
            ctx.fillText(SYMS_G[idx], ccx, ccy);
          }
        }

        if (feedbackTimer > 0) feedbackTimer--;

        // Progress bar
        const pbY = TOP_PAD + ROWS_G * cellH + 14;
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath(); ctx.roundRect(16, pbY, W - 32, 6, 3); ctx.fill();
        if (phase === "input" && playerSeq.length > 0) {
          ctx.fillStyle = "#10b981"; ctx.shadowColor = "#10b981"; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.roundRect(16, pbY, (W - 32) * (playerSeq.length / sequence.length), 6, 3); ctx.fill();
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("TAP THE CELLS IN THE SAME ORDER SHOWN", W / 2, H - 18);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        cleanedUp = true;
        canvas.removeEventListener("click", onClick);
        canvas.removeEventListener("touchstart", onTouch);
        cancelAnimationFrame(rafRef.current);
      };
    }

    // ─────────────────────────────────────────────────────
    // 10. SHIELD ENGINE — rotate shield, deflect projectiles
    // ─────────────────────────────────────────────────────
    {
      const CX = W / 2, CY = H / 2 - 10;
      const CORE_R = 22, SHIELD_R = 85;
      const SHIELD_ARC = Math.PI * 0.42; // ~75° arc
      let shieldAngle = -Math.PI / 2;
      interface Proj { angle: number; dist: number; speed: number; color: string; blocked: boolean; blockAnim: number; }
      let projs: Proj[] = [];
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let coreFlash = 0;
      let shieldFlash = 0;
      let particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
      let spawnT = 0;
      const PROJ_COLS = ["#ef4444", "#f97316", "#f59e0b", "#ec4899", "#a855f7"];
      let rot = 0;

      function spawnProj() {
        const a = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 1.5 + scoreRef.current / 250;
        projs.push({ angle: a, dist: SHIELD_R + 100 + Math.random() * 80, speed, color: PROJ_COLS[Math.floor(Math.random() * PROJ_COLS.length)], blocked: false, blockAnim: 0 });
      }

      function rotateShield(dir: number) {
        shieldAngle += dir * (Math.PI / 6);
        shieldFlash = 8;
      }

      const onClick = (e: MouseEvent) => {
        const { x } = getXY(e);
        rotateShield(x < W / 2 ? -1 : 1);
      };
      const onTouch = (e: TouchEvent) => {
        e.preventDefault();
        const { x } = getXY(e);
        rotateShield(x < W / 2 ? -1 : 1);
      };
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("touchstart", onTouch, { passive: false });

      function loop() {
        ctx.fillStyle = "#030308"; ctx.fillRect(0, 0, W, H);

        rot += 0.003;

        // Outer rings
        for (let i = 4; i >= 1; i--) {
          ctx.strokeStyle = `rgba(168,85,247,${0.04 * i})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(CX, CY, SHIELD_R + 30 * i, 0, Math.PI * 2); ctx.stroke();
        }

        // Arena floor
        ctx.fillStyle = "rgba(168,85,247,0.03)";
        ctx.beginPath(); ctx.arc(CX, CY, SHIELD_R + 20, 0, Math.PI * 2); ctx.fill();

        // Rotating decorative lines
        for (let i = 0; i < 8; i++) {
          const a = rot + (i * Math.PI / 4);
          ctx.strokeStyle = "rgba(168,85,247,0.06)"; ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(CX + Math.cos(a) * CORE_R * 1.5, CY + Math.sin(a) * CORE_R * 1.5);
          ctx.lineTo(CX + Math.cos(a) * SHIELD_R + 5, CY + Math.sin(a) * SHIELD_R + 5);
          ctx.stroke();
        }

        // Spawn projectiles
        spawnT++;
        const interval = Math.max(40, 100 - Math.floor(scoreRef.current / 60));
        if (spawnT >= interval) { spawnProj(); spawnT = 0; }

        // Projectiles
        for (let i = projs.length - 1; i >= 0; i--) {
          const p = projs[i];
          if (p.blocked) {
            p.blockAnim -= 0.05;
            if (p.blockAnim <= 0) { projs.splice(i, 1); continue; }
            const px = CX + Math.cos(p.angle) * SHIELD_R;
            const py = CY + Math.sin(p.angle) * SHIELD_R;
            ctx.globalAlpha = p.blockAnim; ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 20;
            ctx.beginPath(); ctx.arc(px, py, 10 * (1 + (1 - p.blockAnim)), 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0; ctx.globalAlpha = 1; continue;
          }

          p.dist -= p.speed;

          // Hit shield?
          if (p.dist <= SHIELD_R + 8) {
            const diff = Math.abs(((p.angle - shieldAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            if (diff < SHIELD_ARC * 0.5) {
              // Blocked
              p.blocked = true; p.blockAnim = 1;
              updateScore(cfg.correctHitValue); flashText = "BLOCKED!"; flashColor = "#10b981"; flashTimer = 22; shieldFlash = 18; playHit();
              for (let k = 0; k < 10; k++) {
                const a = p.angle + (Math.random() - 0.5) * 1;
                particles.push({ x: CX + Math.cos(p.angle) * SHIELD_R, y: CY + Math.sin(p.angle) * SHIELD_R, vx: Math.cos(a) * (2 + Math.random() * 4), vy: Math.sin(a) * (2 + Math.random() * 4), life: 1, color: p.color });
              }
            } else if (p.dist <= CORE_R + 6) {
              // Hit core
              updateScore(-cfg.wrongHitPenalty); flashText = "CORE HIT!"; flashColor = "#ef4444"; flashTimer = 28; coreFlash = 22; playMiss();
              projs.splice(i, 1); continue;
            }
          }

          if (p.dist < -20) { projs.splice(i, 1); continue; }

          // Draw projectile
          const px = CX + Math.cos(p.angle) * p.dist;
          const py = CY + Math.sin(p.angle) * p.dist;
          ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.shadowBlur = 0;
          ctx.beginPath(); ctx.arc(px - 2, py - 2, 2, 0, Math.PI * 2); ctx.fill();

          // Trail
          for (let k = 1; k <= 4; k++) {
            const td = p.dist + k * 8;
            if (td > SHIELD_R + 110) continue;
            ctx.globalAlpha = (4 - k) / 6;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(CX + Math.cos(p.angle) * td, CY + Math.sin(p.angle) * td, 7 - k, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        // Particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const s = particles[i]; s.x += s.vx; s.y += s.vy; s.life -= 0.07;
          if (s.life <= 0) { particles.splice(i, 1); continue; }
          ctx.globalAlpha = s.life; ctx.fillStyle = s.color;
          ctx.beginPath(); ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Shield arc
        const sa1 = shieldAngle - SHIELD_ARC / 2, sa2 = shieldAngle + SHIELD_ARC / 2;
        const shieldCol = shieldFlash > 0 ? "#10b981" : "#a855f7";
        ctx.strokeStyle = shieldCol; ctx.lineWidth = 10;
        ctx.shadowColor = shieldCol; ctx.shadowBlur = shieldFlash > 0 ? 30 : 18;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(CX, CY, SHIELD_R, sa1, sa2); ctx.stroke();
        ctx.shadowBlur = 0; ctx.lineCap = "butt";
        if (shieldFlash > 0) shieldFlash--;

        // Core
        if (coreFlash > 0) {
          ctx.strokeStyle = `rgba(239,68,68,${coreFlash / 22})`; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(CX, CY, CORE_R + 8, 0, Math.PI * 2); ctx.stroke();
          coreFlash--;
        }
        const coreGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, CORE_R);
        coreGrad.addColorStop(0, "#c084fc"); coreGrad.addColorStop(1, "#7c3aed");
        ctx.fillStyle = coreGrad; ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(CX, CY, CORE_R, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#e9d5ff"; ctx.font = "bold 11px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("⬡", CX, CY);

        // Flash text
        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 28; ctx.font = "bold 20px Orbitron";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 25;
          ctx.fillText(flashText, W / 2, CY - SHIELD_R - 35); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }

        // Controls hint
        ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.font = "9px Orbitron"; ctx.textAlign = "left";
        ctx.fillText("TAP LEFT", 10, H - 28);
        ctx.textAlign = "right"; ctx.fillText("TAP RIGHT", W - 10, H - 28);
        ctx.textAlign = "center"; ctx.fillText("TO ROTATE SHIELD AND BLOCK ATTACKS", W / 2, H - 14);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", onClick); canvas.removeEventListener("touchstart", onTouch); cancelAnimationFrame(rafRef.current); };
    }
  }, [gameState, config, game]);

  if (!config || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080f]">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const targetScore = config.targetScore;
  const progressPct = Math.min(100, (score / targetScore) * 100);
  const timeWarning = timeLeft <= 10;
  const engineName = getEngine(game.slug, game.category);
  const ENGINE_LABELS: Record<string, string> = {
    rhythm: "RHYTHM LANE", pendulum: "VAULT DIAL", powerbar: "POWER BAR",
    meteor: "METEOR CATCH", laser: "LASER GATE", stack: "STACK BLOCK",
    gravity: "GRAVITY FLIP", slasher: "BOT SLASHER", simon: "CRYPTO SEQ", shield: "SHIELD ARC",
  };

  return (
    <div className="fixed inset-0 bg-[#08080f] flex flex-col overflow-hidden">
      {/* HUD */}
      <div className="relative z-10 flex items-center justify-between px-4 py-2.5 bg-black/50 backdrop-blur border-b border-purple-900/40">
        <button onClick={() => { if (!gameEndedRef.current) endGame(scoreRef.current); navigate("/"); }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-5">
          <div className="text-center">
            <div className="text-[9px] text-purple-400 tracking-widest uppercase">Score</div>
            <div className="text-xl font-black text-foreground tabular-nums leading-tight">{score}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-amber-400 tracking-widest uppercase">Target</div>
            <div className="text-xl font-black text-accent tabular-nums leading-tight">{targetScore}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-purple-400 tracking-widest uppercase">Time</div>
            <div className={`text-xl font-black tabular-nums leading-tight ${timeWarning ? "text-red-400 animate-pulse" : "text-foreground"}`}>{timeLeft}s</div>
          </div>
        </div>
        <div className="w-8" />
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-black/40 relative">
        <div className="absolute inset-y-0 left-0 transition-all duration-200 rounded-r" style={{ width: `${progressPct}%`, background: progressPct >= 80 ? "linear-gradient(90deg,#a855f7,#f59e0b)" : progressPct >= 40 ? "#7c3aed" : "#4c1d95" }} />
        <div className="absolute top-0 right-0 bottom-0 w-0.5 bg-amber-400" />
      </div>

      {/* Engine label */}
      <div className="text-center py-1 text-[9px] font-bold tracking-[0.25em] text-purple-500/50 uppercase">
        {game.name} &mdash; {ENGINE_LABELS[engineName] || engineName.toUpperCase()}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        {gameState === "countdown" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: "rgba(8,8,15,0.85)", backdropFilter: "blur(4px)" }}>
            <div className="text-center">
              <div className="text-xs text-purple-400 tracking-[0.3em] mb-3 uppercase">Get Ready</div>
              <div className="text-9xl font-black text-primary" style={{ textShadow: "0 0 60px rgba(168,85,247,0.9), 0 0 120px rgba(168,85,247,0.4)" }}>{countdown}</div>
              <div className="mt-4 text-xs text-muted-foreground tracking-widest">{game.name.toUpperCase()}</div>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} width={400} height={620} className="w-full h-full" style={{ cursor: "crosshair", touchAction: "none" }} />
      </div>

      {/* Result overlay */}
      {gameState === "ended" && sessionResult && (
        <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: "rgba(4,4,14,0.9)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm mx-5 rounded-2xl border p-8 text-center space-y-5"
            style={{ background: sessionResult.won ? "rgba(16,185,129,0.07)" : "rgba(239,68,68,0.07)", borderColor: sessionResult.won ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.25)" }}>
            <div className="text-6xl font-black tracking-wider" style={{ color: sessionResult.won ? "#10b981" : "#ef4444", textShadow: `0 0 40px ${sessionResult.won ? "#10b981" : "#ef4444"}60` }}>
              {sessionResult.won ? "VICTORY" : "DEFEAT"}
            </div>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Final Score</span><span className="font-bold">{sessionResult.finalScore}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Target</span><span className="font-bold">{sessionResult.targetScore}</span></div>
              {sessionResult.won && (
                <div className="flex justify-between text-sm"><span className="text-amber-400">Prize Earned</span><span className="font-black text-accent">+{sessionResult.prize.toFixed(2)} SKZ</span></div>
              )}
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => navigate("/")} className="flex-1 py-3 rounded-xl font-bold text-sm tracking-wider bg-muted text-muted-foreground hover:text-foreground transition-colors">Lobby</button>
              <button onClick={() => navigate(`/game/${game.id}`)} className="flex-1 py-3 rounded-xl font-black text-sm tracking-wider bg-primary text-primary-foreground" style={{ boxShadow: "0 0 20px rgba(168,85,247,0.4)" }}>Play Again</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
