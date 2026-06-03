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
    // Timing
    "crypto-rhythm": "rhythm", "heartbeat-sync": "rhythm",
    "thread-cutter": "pendulum", "vault-cracker": "pendulum",
    "shock-switch": "powerbar",
    "meteor-catch": "meteor",
    "laser-gate": "laser",
    "critical-leap": "dodge", "last-turn": "dodge",
    "crypto-shield": "shield",
    // Physics
    "crypto-stack": "stack", "jelly-bridge": "stack",
    "gold-balance": "balance", "tightrope-bot": "balance",
    "coin-magnet": "magnet",
    "fragile-bubble": "bubble",
    "slippery-slope": "gravity", "gravity-flip": "gravity",
    "bounce-arrow": "laser",
    "egg-dash": "meteor",
    // Swipe
    "bot-slasher": "slasher", "cyber-cleaner": "slasher", "cyber-fishing": "slasher",
    "coin-sorter": "meteor",
    "lightning-path": "trace", "star-swiper": "trace", "node-war": "trace", "bomb-defuser": "trace",
    "tornado-escape": "dodge", "neon-rush": "dodge",
    // Memory
    "crypto-sequence": "simon", "code-break": "simon", "mirror-matrix": "simon",
    "color-memory": "grid", "number-flash": "grid", "symbol-map": "grid",
    "pattern-recall": "grid", "path-memory": "grid", "grid-scan": "grid", "speed-match": "grid",
    // Strategy
    "chain-reaction": "trace", "circuit-close": "trace",
    "crypto-bridge": "stack", "stack-overflow": "stack",
    "block-chain": "simon", "hash-clash": "grid",
    "bit-breaker": "breaker", "ping-master": "breaker",
    "signal-surge": "rhythm",
    "data-stream": "dodge",
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
  const comboRef = useRef(0);
  const [combo, setCombo] = useState(0);

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
      if (delta > 0) {
        comboRef.current++;
        setCombo(comboRef.current);
        const multiplier = Math.min(4, 1 + Math.floor(comboRef.current / 4) * 0.5);
        delta = Math.round(delta * multiplier);
      } else {
        comboRef.current = 0;
        setCombo(0);
      }
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
      const OUTER = 36, INNER = 13;

      interface Note { lane: number; y: number; sym: string; color: string; hit: boolean; anim: number; }
      let notes: Note[] = [];
      let spawnT = 0;
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let speed = 4.8;

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
        speed = 4.8 + scoreRef.current / 100;
        const interval = Math.max(13, 40 - Math.floor(scoreRef.current / 60));
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
      let angSpeed = 0.042 + Math.random() * 0.018;
      let markers: { angle: number; hit: boolean; hitAnim: number }[] = [];
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let hitRing = 0;
      const TOL = 0.082; // radians tolerance

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
          angSpeed = Math.min(0.14, angSpeed + 0.010);
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
      let needleSpeed = 6.5;
      let greenH = BH * 0.13; // height of green zone (shrinks over time)
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
          if (hitCount % 4 === 0 && greenH > BH * 0.04) greenH -= BH * 0.022;
          updateScore(cfg.correctHitValue); flashText = "CHARGED!"; flashColor = "#10b981"; flashTimer = 30;
          emitSparks(BX + BW / 2, needleY, "#10b981"); playHit();
          needleSpeed = Math.min(16, needleSpeed + 0.55);
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
        meteors.push({ x: 30 + Math.random() * (W - 60), y: -20, color: METEOR_COLS[cidx], cidx, vy: 4.2 + Math.random() * 3.5 + scoreRef.current / 150, r: 14 + Math.random() * 8, tail: [] });
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
        if (spawnT >= Math.max(18, 58 - Math.floor(scoreRef.current / 45))) { spawnMeteor(); spawnT = 0; }

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
      const GATE_SPEED_BASE = 6.5;

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
        const gSpeed = Math.min(14, GATE_SPEED_BASE + scoreRef.current / 150);
        const interval = Math.max(36, 88 - Math.floor(scoreRef.current / 38));
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
      let current = { x: 0, w: W * 0.65, dir: 1, speed: 6.5 };
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
        current = { x: newBlock.x, w: newW, dir: Math.random() < 0.5 ? 1 : -1, speed: Math.min(16, 6.5 + blockCount * 0.55) };

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
      const GRAV_STR = 0.58;
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
        const gapH = Math.max(82 - Math.floor(scoreRef.current / 65) * 6, 48);
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
        const wSpeed = Math.min(12, 5 + scoreRef.current / 110);
        spawnT++;
        if (spawnT >= Math.max(52, 112 - Math.floor(scoreRef.current / 32))) { spawnWall(); spawnT = 0; }

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
        const speed = 3.0 + Math.random() * 3 + scoreRef.current / 200;
        if (side === 0) { sx = Math.random() * W; sy = -30; vx = (Math.random() - 0.5) * speed; vy = speed; }
        else if (side === 1) { sx = W + 30; sy = Math.random() * H; vx = -speed; vy = (Math.random() - 0.5) * speed; }
        else if (side === 2) { sx = Math.random() * W; sy = H + 30; vx = (Math.random() - 0.5) * speed; vy = -speed; }
        else { sx = -30; sy = Math.random() * H; vx = speed; vy = (Math.random() - 0.5) * speed; }
        const rnd = Math.random();
        let type: "enemy" | "friend" | "bomb";
        if (rnd < 0.48) type = "enemy";
        else if (rnd < 0.76) type = "friend";
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
        if (spawnT >= Math.max(24, 62 - Math.floor(scoreRef.current / 60))) { spawnObj(); spawnT = 0; }

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
    // GRID ENGINE — memorize a set of lit cells, reproduce
    // ─────────────────────────────────────────────────────
    if (engine === "grid") {
      const TOP_PAD = 64, BOT_PAD = 44;
      let gridN = 4;
      let target = new Set<number>();
      let found = new Set<number>();
      let wrong = new Set<number>();
      let phase: "memorize" | "input" | "wait" = "memorize";
      let memFrames = 0;
      let round = 1;
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let cleanedUp = false;

      function dims() { return { cw: W / gridN, ch: (H - TOP_PAD - BOT_PAD) / gridN }; }

      function newRound() {
        gridN = Math.min(6, 4 + Math.floor(scoreRef.current / 140));
        const total = gridN * gridN;
        const count = Math.min(total - 2, 3 + round + Math.floor(scoreRef.current / 90));
        target = new Set(); found = new Set(); wrong = new Set();
        while (target.size < count) target.add(Math.floor(Math.random() * total));
        phase = "memorize";
        memFrames = Math.max(48, 90 - round * 4);
      }
      newRound();

      function tapCell(idx: number) {
        if (phase !== "input") return;
        if (found.has(idx) || wrong.has(idx)) return;
        if (target.has(idx)) {
          found.add(idx);
          updateScore(cfg.correctHitValue); playHit();
          flashText = "CORRECT"; flashColor = "#10b981"; flashTimer = 14;
          if (found.size === target.size) {
            round++; phase = "wait";
            flashText = "PERFECT ROUND!"; flashColor = "#f59e0b"; flashTimer = 30; playPerfect();
            setTimeout(() => { if (!cleanedUp) newRound(); }, 800);
          }
        } else {
          wrong.add(idx);
          updateScore(-cfg.wrongHitPenalty); playMiss();
          flashText = "WRONG CELL"; flashColor = "#ef4444"; flashTimer = 20;
        }
      }

      const onClick = (e: MouseEvent) => {
        if (phase !== "input") return;
        const { x, y } = getXY(e);
        const { cw, ch } = dims();
        const col = Math.floor(x / cw);
        const row = Math.floor((y - TOP_PAD) / ch);
        if (row < 0 || row >= gridN || col < 0 || col >= gridN) return;
        tapCell(row * gridN + col);
      };
      const onTouch = (e: TouchEvent) => { e.preventDefault(); onClick(e as unknown as MouseEvent); };
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("touchstart", onTouch, { passive: false });

      function loop() {
        ctx.fillStyle = "#03030c"; ctx.fillRect(0, 0, W, H);
        const { cw, ch } = dims();

        ctx.font = "bold 11px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (phase === "memorize") { ctx.fillStyle = "#f59e0b"; ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 12; ctx.fillText("MEMORIZE!", W / 2, 30); }
        else if (phase === "input") { ctx.fillStyle = "#10b981"; ctx.shadowColor = "#10b981"; ctx.shadowBlur = 12; ctx.fillText(`REPRODUCE — ${found.size}/${target.size}`, W / 2, 30); }
        else { ctx.fillStyle = "#a855f7"; ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 12; ctx.fillText("...", W / 2, 30); }
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(168,85,247,0.6)"; ctx.font = "8px Orbitron";
        ctx.fillText(`ROUND ${round}  —  ${gridN}×${gridN}`, W / 2, 50);

        const total = gridN * gridN;
        for (let i = 0; i < total; i++) {
          const r = Math.floor(i / gridN), c = i % gridN;
          const cx = c * cw, cy = TOP_PAD + r * ch;
          const showLit = phase === "memorize" && target.has(i);
          const isFound = found.has(i);
          const isWrong = wrong.has(i);
          let col = "rgba(255,255,255,0.04)", bord = "rgba(255,255,255,0.07)", glow = 0;
          if (showLit || isFound) { col = "rgba(16,185,129,0.25)"; bord = "#10b981"; glow = 18; }
          if (isWrong) { col = "rgba(239,68,68,0.2)"; bord = "#ef4444"; glow = 14; }
          if (phase === "wait" && target.has(i) && !isFound) { col = "rgba(245,158,11,0.2)"; bord = "#f59e0b"; glow = 12; }
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.roundRect(cx + 3, cy + 3, cw - 6, ch - 6, 8); ctx.fill();
          ctx.strokeStyle = bord; ctx.lineWidth = glow > 0 ? 2.5 : 1;
          if (glow > 0) { ctx.shadowColor = bord; ctx.shadowBlur = glow; }
          ctx.beginPath(); ctx.roundRect(cx + 3, cy + 3, cw - 6, ch - 6, 8); ctx.stroke();
          ctx.shadowBlur = 0;
        }

        if (phase === "memorize") { memFrames--; if (memFrames <= 0) { phase = "input"; } }

        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 30; ctx.font = "bold 18px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 22;
          ctx.fillText(flashText, W / 2, H - 70); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }
        ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText(phase === "memorize" ? "REMEMBER THE LIT CELLS" : "TAP EVERY CELL YOU SAW", W / 2, H - 16);

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
    // BREAKER ENGINE — paddle + ball + breakable blocks
    // ─────────────────────────────────────────────────────
    if (engine === "breaker") {
      const PADDLE_W = 72, PADDLE_H = 12, PADDLE_Y = H - 44;
      let paddleX = W / 2;
      const BALL_R = 7;
      let ballX = W / 2, ballY = PADDLE_Y - 30;
      let ballVX = 3, ballVY = -4.5;
      const BCOLS = ["#a855f7", "#06b6d4", "#f59e0b", "#10b981", "#ec4899"];
      interface Brick { x: number; y: number; w: number; h: number; color: string; alive: boolean; }
      let bricks: Brick[] = [];
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      const ROWS = 4, COLS = 6, TOP = 72;

      function buildBricks() {
        bricks = [];
        const bw = (W - 20) / COLS, bh = 20;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          bricks.push({ x: 10 + c * bw, y: TOP + r * (bh + 6), w: bw - 6, h: bh, color: BCOLS[r % BCOLS.length], alive: true });
        }
      }
      buildBricks();

      function resetBall() {
        const sp = 4.5 + scoreRef.current / 220;
        ballX = paddleX; ballY = PADDLE_Y - 30;
        ballVX = (Math.random() < 0.5 ? -1 : 1) * sp * 0.6; ballVY = -sp;
      }

      const movePaddle = (x: number) => { paddleX = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, x)); };
      const onClick = (e: MouseEvent) => movePaddle(getXY(e).x);
      const onMove = (e: MouseEvent) => movePaddle(getXY(e).x);
      const onTouch = (e: TouchEvent) => { e.preventDefault(); movePaddle(getXY(e).x); };
      const onTouchMove = (e: TouchEvent) => { e.preventDefault(); movePaddle(getXY(e).x); };
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("mousemove", onMove);
      canvas.addEventListener("touchstart", onTouch, { passive: false });
      canvas.addEventListener("touchmove", onTouchMove, { passive: false });

      function loop() {
        ctx.fillStyle = "#03030b"; ctx.fillRect(0, 0, W, H);
        const sp = 4.5 + scoreRef.current / 220;

        ballX += ballVX; ballY += ballVY;
        if (ballX - BALL_R < 0) { ballX = BALL_R; ballVX = Math.abs(ballVX); }
        if (ballX + BALL_R > W) { ballX = W - BALL_R; ballVX = -Math.abs(ballVX); }
        if (ballY - BALL_R < 0) { ballY = BALL_R; ballVY = Math.abs(ballVY); }

        if (ballVY > 0 && ballY + BALL_R >= PADDLE_Y && ballY + BALL_R <= PADDLE_Y + PADDLE_H + 10 &&
            ballX >= paddleX - PADDLE_W / 2 && ballX <= paddleX + PADDLE_W / 2) {
          ballVY = -Math.abs(ballVY);
          const off = (ballX - paddleX) / (PADDLE_W / 2);
          ballVX = off * sp; playHit();
        }

        if (ballY - BALL_R > H) {
          updateScore(-cfg.wrongHitPenalty); flashText = "BALL LOST!"; flashColor = "#ef4444"; flashTimer = 24; playMiss(); resetBall();
        }

        let aliveCount = 0;
        for (const b of bricks) {
          if (!b.alive) continue; aliveCount++;
          if (ballX + BALL_R > b.x && ballX - BALL_R < b.x + b.w && ballY + BALL_R > b.y && ballY - BALL_R < b.y + b.h) {
            b.alive = false; ballVY *= -1;
            updateScore(cfg.correctHitValue); flashText = "BREAK!"; flashColor = "#10b981"; flashTimer = 10; playHit();
            break;
          }
        }
        if (aliveCount === 0) { buildBricks(); flashText = "CLEARED!"; flashColor = "#f59e0b"; flashTimer = 26; playPerfect(); }

        for (const b of bricks) {
          if (!b.alive) continue;
          ctx.fillStyle = b.color + "cc"; ctx.shadowColor = b.color; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4); ctx.fill(); ctx.shadowBlur = 0;
        }

        ctx.fillStyle = "#a855f7"; ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.roundRect(paddleX - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, 6); ctx.fill(); ctx.shadowBlur = 0;

        ctx.fillStyle = "#06b6d4"; ctx.shadowColor = "#06b6d4"; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 26; ctx.font = "bold 18px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 22;
          ctx.fillText(flashText, W / 2, H * 0.55); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }
        ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("MOVE PADDLE TO KEEP THE BALL IN PLAY", W / 2, H - 14);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        canvas.removeEventListener("click", onClick);
        canvas.removeEventListener("mousemove", onMove);
        canvas.removeEventListener("touchstart", onTouch);
        canvas.removeEventListener("touchmove", onTouchMove);
        cancelAnimationFrame(rafRef.current);
      };
    }

    // ─────────────────────────────────────────────────────
    // DODGE ENGINE — 3-lane auto-runner, switch lanes
    // ─────────────────────────────────────────────────────
    if (engine === "dodge") {
      const LANES = 3, LW = W / LANES;
      let playerLane = 1;
      const PLAYER_Y = H - 90;
      let bars: { y: number; blocked: boolean[]; passed: boolean; color: string }[] = [];
      let spawnT = 0;
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let hitFlash = 0;
      const BARCOLS = ["#ef4444", "#f97316", "#ec4899", "#a855f7"];

      function spawnBar() {
        const blocked = [false, false, false];
        const openLane = Math.floor(Math.random() * LANES);
        for (let i = 0; i < LANES; i++) blocked[i] = i !== openLane && Math.random() < 0.85;
        if (!blocked.some((b) => b)) blocked[(openLane + 1) % LANES] = true;
        bars.push({ y: -30, blocked, passed: false, color: BARCOLS[Math.floor(Math.random() * BARCOLS.length)] });
      }

      const switchLane = (dir: number) => { playerLane = Math.max(0, Math.min(LANES - 1, playerLane + dir)); };
      const onClick = (e: MouseEvent) => switchLane(getXY(e).x < W / 2 ? -1 : 1);
      const onTouch = (e: TouchEvent) => { e.preventDefault(); switchLane(getXY(e).x < W / 2 ? -1 : 1); };
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("touchstart", onTouch, { passive: false });

      function loop() {
        ctx.fillStyle = "#03030b"; ctx.fillRect(0, 0, W, H);

        ctx.setLineDash([6, 10]);
        for (let i = 1; i < LANES; i++) {
          ctx.strokeStyle = "rgba(168,85,247,0.1)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(i * LW, 0); ctx.lineTo(i * LW, H); ctx.stroke();
        }
        ctx.setLineDash([]);

        const speed = 4 + scoreRef.current / 110;
        spawnT++;
        if (spawnT >= Math.max(42, 90 - Math.floor(scoreRef.current / 40))) { spawnBar(); spawnT = 0; }

        for (let i = bars.length - 1; i >= 0; i--) {
          const b = bars[i]; b.y += speed;
          if (!b.passed && b.y >= PLAYER_Y - 18 && b.y <= PLAYER_Y + 18) {
            if (b.blocked[playerLane]) { updateScore(-cfg.wrongHitPenalty); flashText = "CRASH!"; flashColor = "#ef4444"; flashTimer = 22; hitFlash = 18; playMiss(); }
            else { updateScore(cfg.correctHitValue); flashText = "DODGE!"; flashColor = "#10b981"; flashTimer = 14; playHit(); }
            b.passed = true;
          }
          if (b.y > H + 30) { bars.splice(i, 1); continue; }
          for (let l = 0; l < LANES; l++) {
            if (!b.blocked[l]) continue;
            ctx.fillStyle = b.color + "bb"; ctx.shadowColor = b.color; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.roundRect(l * LW + 6, b.y - 14, LW - 12, 28, 6); ctx.fill(); ctx.shadowBlur = 0;
          }
        }

        const px = playerLane * LW + LW / 2;
        if (hitFlash > 0) { ctx.strokeStyle = `rgba(239,68,68,${hitFlash / 18})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, PLAYER_Y, 22, 0, Math.PI * 2); ctx.stroke(); hitFlash--; }
        ctx.fillStyle = "#06b6d4"; ctx.shadowColor = "#06b6d4"; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.moveTo(px, PLAYER_Y - 14); ctx.lineTo(px - 12, PLAYER_Y + 12); ctx.lineTo(px + 12, PLAYER_Y + 12); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;

        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 22; ctx.font = "bold 20px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 24;
          ctx.fillText(flashText, W / 2, H * 0.3); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }
        ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("TAP LEFT / RIGHT TO SWITCH LANES", W / 2, H - 16);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", onClick); canvas.removeEventListener("touchstart", onTouch); cancelAnimationFrame(rafRef.current); };
    }

    // ─────────────────────────────────────────────────────
    // BALANCE ENGINE — tilt a beam, keep the ball centered
    // ─────────────────────────────────────────────────────
    if (engine === "balance") {
      const PIVOT_X = W / 2, PIVOT_Y = H * 0.6, BEAM_LEN = W * 0.72;
      let tilt = 0, tiltVel = 0;
      let ballPos = 0, ballVel = 0;
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let centeredTicks = 0;
      let resetFlash = 0;
      let spawnT = 0;

      const push = (dir: number) => { tiltVel += dir * 0.014; };
      const onClick = (e: MouseEvent) => push(getXY(e).x < W / 2 ? -1 : 1);
      const onTouch = (e: TouchEvent) => { e.preventDefault(); push(getXY(e).x < W / 2 ? -1 : 1); };
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("touchstart", onTouch, { passive: false });

      function loop() {
        ctx.fillStyle = "#03030b"; ctx.fillRect(0, 0, W, H);

        spawnT++;
        const freq = Math.max(34, 90 - Math.floor(scoreRef.current / 26));
        if (spawnT >= freq) { const side = Math.random() < 0.5 ? -1 : 1; tiltVel += side * (0.01 + Math.random() * 0.01 + scoreRef.current / 14000); spawnT = 0; }

        tilt += tiltVel; tiltVel *= 0.96;
        tilt = Math.max(-0.6, Math.min(0.6, tilt));
        ballVel += Math.sin(tilt) * 0.6; ballVel *= 0.97;
        ballPos += ballVel * 0.014;

        if (Math.abs(ballPos) > 1) {
          updateScore(-cfg.wrongHitPenalty); flashText = "FELL OFF!"; flashColor = "#ef4444"; flashTimer = 24; resetFlash = 18; playMiss();
          ballPos = 0; ballVel = 0; tilt = 0; tiltVel = 0;
        } else if (Math.abs(ballPos) < 0.35) {
          centeredTicks++;
          if (centeredTicks >= 30) { updateScore(cfg.correctHitValue); flashText = "BALANCED!"; flashColor = "#10b981"; flashTimer = 14; playHit(); centeredTicks = 0; }
        } else {
          centeredTicks = Math.max(0, centeredTicks - 1);
        }

        const dx = Math.cos(tilt) * BEAM_LEN / 2, dy = Math.sin(tilt) * BEAM_LEN / 2;
        const x1 = PIVOT_X - dx, y1 = PIVOT_Y - dy, x2 = PIVOT_X + dx, y2 = PIVOT_Y + dy;

        ctx.strokeStyle = "rgba(16,185,129,0.4)"; ctx.lineWidth = 1; ctx.setLineDash([4, 8]);
        ctx.beginPath(); ctx.moveTo(PIVOT_X, PIVOT_Y - 40); ctx.lineTo(PIVOT_X, PIVOT_Y - 130); ctx.stroke(); ctx.setLineDash([]);

        ctx.strokeStyle = "#a855f7"; ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.shadowBlur = 0; ctx.lineCap = "butt";

        ctx.fillStyle = "#7c3aed"; ctx.beginPath(); ctx.moveTo(PIVOT_X, PIVOT_Y); ctx.lineTo(PIVOT_X - 16, PIVOT_Y + 32); ctx.lineTo(PIVOT_X + 16, PIVOT_Y + 32); ctx.closePath(); ctx.fill();

        const bx = PIVOT_X + Math.cos(tilt) * (ballPos * BEAM_LEN / 2);
        const by = PIVOT_Y + Math.sin(tilt) * (ballPos * BEAM_LEN / 2) - 14;
        ctx.fillStyle = resetFlash > 0 ? "#ef4444" : "#06b6d4"; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(bx, by, 12, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        if (resetFlash > 0) resetFlash--;

        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 24; ctx.font = "bold 18px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 22;
          ctx.fillText(flashText, W / 2, H * 0.28); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }
        ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("TAP LEFT / RIGHT TO COUNTER THE TILT", W / 2, H - 16);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", onClick); canvas.removeEventListener("touchstart", onTouch); cancelAnimationFrame(rafRef.current); };
    }

    // ─────────────────────────────────────────────────────
    // MAGNET ENGINE — drag magnet, flip polarity, grab coins
    // ─────────────────────────────────────────────────────
    if (engine === "magnet") {
      let magX = W / 2, magY = H - 90;
      let polarity = 1;
      const MAG_R = 26;
      interface Item { x: number; y: number; vx: number; vy: number; type: "coin" | "bomb"; color: string; }
      let items: Item[] = [];
      let spawnT = 0;
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let dragging = false, moved = false, downX = 0, downY = 0;

      function spawnItem() {
        const x = 30 + Math.random() * (W - 60);
        const isBomb = Math.random() < 0.42;
        items.push({ x, y: -20, vx: 0, vy: 1.5 + Math.random() * 1 + scoreRef.current / 320, type: isBomb ? "bomb" : "coin", color: isBomb ? "#ef4444" : "#f59e0b" });
      }

      const setPos = (x: number, y: number) => { magX = Math.max(MAG_R, Math.min(W - MAG_R, x)); magY = Math.max(H * 0.3, Math.min(H - 30, y)); };
      const onDown = (e: PointerEvent) => {
        dragging = true; moved = false;
        const r = canvas.getBoundingClientRect();
        downX = (e.clientX - r.left) * (W / r.width); downY = (e.clientY - r.top) * (H / r.height);
      };
      const onMoveP = (e: PointerEvent) => {
        if (!dragging) return;
        const r = canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
        if (Math.abs(x - downX) > 6 || Math.abs(y - downY) > 6) moved = true;
        setPos(x, y);
      };
      const onUp = () => {
        if (dragging && !moved) {
          polarity *= -1;
          playTone(polarity > 0 ? 440 : 320, 0.1, "square", 0.15);
          flashText = polarity > 0 ? "ATTRACT" : "REPEL"; flashColor = polarity > 0 ? "#f59e0b" : "#06b6d4"; flashTimer = 18;
        }
        dragging = false;
      };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMoveP);
      canvas.addEventListener("pointerup", onUp);

      function loop() {
        ctx.fillStyle = "#03030b"; ctx.fillRect(0, 0, W, H);
        spawnT++;
        if (spawnT >= Math.max(26, 70 - Math.floor(scoreRef.current / 40))) { spawnItem(); spawnT = 0; }

        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          const dx = magX - it.x, dy = magY - it.y, d = Math.hypot(dx, dy) || 1;
          if (d < 175) { const f = polarity * 0.6 * (175 - d) / 175; it.vx += (dx / d) * f; it.vy += (dy / d) * f; }
          it.x += it.vx; it.y += it.vy; it.vy += 0.02;

          if (d < MAG_R + 12) {
            if (it.type === "coin") { updateScore(cfg.correctHitValue); flashText = "+COIN"; flashColor = "#f59e0b"; flashTimer = 12; playHit(); }
            else { updateScore(-cfg.wrongHitPenalty); flashText = "BOMB!"; flashColor = "#ef4444"; flashTimer = 22; playMiss(); }
            items.splice(i, 1); continue;
          }
          if (it.y > H + 30 || it.x < -30 || it.x > W + 30) { items.splice(i, 1); continue; }

          ctx.fillStyle = it.color; ctx.shadowColor = it.color; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(it.x, it.y, it.type === "coin" ? 9 : 10, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
          ctx.fillStyle = "#fff"; ctx.font = "bold 10px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(it.type === "coin" ? "$" : "✦", it.x, it.y);
        }

        const mc = polarity > 0 ? "#f59e0b" : "#06b6d4";
        ctx.strokeStyle = mc + "40"; ctx.lineWidth = 1;
        for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(magX, magY, MAG_R + k * 18, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = mc; ctx.shadowColor = mc; ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.arc(magX, magY, MAG_R, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = "#03030b"; ctx.font = "bold 18px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(polarity > 0 ? "+" : "−", magX, magY);

        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 22; ctx.font = "bold 18px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 22;
          ctx.fillText(flashText, W / 2, 40); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }
        ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("DRAG TO MOVE — TAP TO FLIP POLARITY", W / 2, H - 14);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMoveP);
        canvas.removeEventListener("pointerup", onUp);
        cancelAnimationFrame(rafRef.current);
      };
    }

    // ─────────────────────────────────────────────────────
    // TRACE ENGINE — drag through numbered nodes in order
    // ─────────────────────────────────────────────────────
    if (engine === "trace") {
      interface Node { x: number; y: number; order: number; }
      let nodes: Node[] = [];
      let nextIdx = 0;
      let dragging = false;
      let lastHit = -1;
      let path: { x: number; y: number }[] = [];
      let flashText = "", flashColor = "#fff", flashTimer = 0;

      function buildChain() {
        const count = Math.min(8, 4 + Math.floor(scoreRef.current / 110));
        nodes = []; nextIdx = 0; path = []; lastHit = -1;
        for (let i = 0; i < count; i++) {
          let x = 0, y = 0, ok = false, tries = 0;
          while (!ok && tries < 60) {
            x = 40 + Math.random() * (W - 80); y = 90 + Math.random() * (H - 180);
            ok = nodes.every((n) => Math.hypot(n.x - x, n.y - y) > 62); tries++;
          }
          nodes.push({ x, y, order: i });
        }
      }
      buildChain();

      function nodeAt(x: number, y: number): number { return nodes.findIndex((n) => Math.hypot(n.x - x, n.y - y) < 24); }

      function check(x: number, y: number) {
        const idx = nodeAt(x, y);
        if (idx < 0) { lastHit = -1; return; }
        if (idx === lastHit) return;
        lastHit = idx;
        const n = nodes[idx];
        if (n.order < nextIdx) return;
        if (n.order === nextIdx) {
          updateScore(cfg.correctHitValue); playHit(); nextIdx++;
          flashText = "LINK!"; flashColor = "#10b981"; flashTimer = 10;
          if (nextIdx >= nodes.length) { flashText = "CHAIN COMPLETE!"; flashColor = "#f59e0b"; flashTimer = 28; playPerfect(); buildChain(); }
        } else {
          updateScore(-cfg.wrongHitPenalty); playMiss();
          flashText = "WRONG ORDER"; flashColor = "#ef4444"; flashTimer = 20;
        }
      }

      const onDown = (e: PointerEvent) => {
        dragging = true; lastHit = -1;
        const r = canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
        path = [{ x, y }]; check(x, y);
      };
      const onMoveP = (e: PointerEvent) => {
        if (!dragging) return;
        const r = canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
        path.push({ x, y }); if (path.length > 40) path.shift();
        check(x, y);
      };
      const onUp = () => { dragging = false; lastHit = -1; path = []; };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMoveP);
      canvas.addEventListener("pointerup", onUp);

      function loop() {
        ctx.fillStyle = "#03030b"; ctx.fillRect(0, 0, W, H);

        ctx.font = "bold 10px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "#a855f7"; ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 10;
        ctx.fillText(`TRACE ${nextIdx}/${nodes.length}`, W / 2, 34); ctx.shadowBlur = 0;

        ctx.strokeStyle = "rgba(16,185,129,0.5)"; ctx.lineWidth = 3; ctx.shadowColor = "#10b981"; ctx.shadowBlur = 8;
        for (let i = 0; i < nextIdx - 1; i++) {
          const a = nodes.find((n) => n.order === i), b = nodes.find((n) => n.order === i + 1);
          if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        ctx.shadowBlur = 0;

        for (const n of nodes) {
          const done = n.order < nextIdx, isNext = n.order === nextIdx;
          const col = done ? "#10b981" : isNext ? "#f59e0b" : "#a855f7";
          const pulse = isNext ? 0.7 + Math.sin(Date.now() * 0.006) * 0.3 : 1;
          ctx.fillStyle = col + (done ? "cc" : "22"); ctx.strokeStyle = col; ctx.lineWidth = 2.5;
          ctx.shadowColor = col; ctx.shadowBlur = (isNext ? 22 : 10) * pulse;
          ctx.beginPath(); ctx.arc(n.x, n.y, 18, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(n.x, n.y, 18, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
          ctx.fillStyle = done ? "#03030b" : "#fff"; ctx.font = "bold 12px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(String(n.order + 1), n.x, n.y);
        }

        if (path.length >= 2) {
          ctx.strokeStyle = "rgba(6,182,212,0.6)"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y); for (const p of path) ctx.lineTo(p.x, p.y); ctx.stroke();
        }

        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 28; ctx.font = "bold 18px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 22;
          ctx.fillText(flashText, W / 2, H - 50); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }
        ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("DRAG THROUGH THE NODES IN NUMBER ORDER", W / 2, H - 16);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMoveP);
        canvas.removeEventListener("pointerup", onUp);
        cancelAnimationFrame(rafRef.current);
      };
    }

    // ─────────────────────────────────────────────────────
    // BUBBLE ENGINE — steer a rising bubble through gaps
    // ─────────────────────────────────────────────────────
    if (engine === "bubble") {
      let bubX = W / 2; const bubY = H * 0.62, BUB_R = 14;
      interface Row { y: number; gapX: number; gapW: number; passed: boolean; }
      let rows: Row[] = [];
      let spawnT = 0;
      let flashText = "", flashColor = "#fff", flashTimer = 0;
      let flash = 0;
      let dragging = false;

      function spawnRow() {
        const gapW = Math.max(50, 92 - Math.floor(scoreRef.current / 40));
        const gapX = 20 + Math.random() * (W - 40 - gapW);
        rows.push({ y: -20, gapX, gapW, passed: false });
      }

      function drawSpikeRow(rw: Row) {
        ctx.fillStyle = "#ef444488"; ctx.strokeStyle = "#ef4444"; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 6;
        const segs: [number, number][] = [[0, rw.gapX], [rw.gapX + rw.gapW, W]];
        for (const [sx, ex] of segs) {
          if (ex <= sx) continue;
          ctx.beginPath(); ctx.rect(sx, rw.y - 8, ex - sx, 16); ctx.fill();
          for (let tx = sx; tx < ex; tx += 10) {
            ctx.beginPath(); ctx.moveTo(tx, rw.y + 8); ctx.lineTo(tx + 5, rw.y + 15); ctx.lineTo(tx + 10, rw.y + 8); ctx.closePath(); ctx.fill();
          }
        }
        ctx.shadowBlur = 0;
      }

      const moveX = (x: number) => { bubX = Math.max(BUB_R, Math.min(W - BUB_R, x)); };
      const onDown = (e: PointerEvent) => { dragging = true; const r = canvas.getBoundingClientRect(); moveX((e.clientX - r.left) * (W / r.width)); };
      const onMoveP = (e: PointerEvent) => { if (!dragging) return; const r = canvas.getBoundingClientRect(); moveX((e.clientX - r.left) * (W / r.width)); };
      const onUp = () => { dragging = false; };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMoveP);
      canvas.addEventListener("pointerup", onUp);

      function loop() {
        ctx.fillStyle = "#03030b"; ctx.fillRect(0, 0, W, H);
        const speed = 2.5 + scoreRef.current / 120;

        spawnT++;
        if (spawnT >= Math.max(46, 100 - Math.floor(scoreRef.current / 30))) { spawnRow(); spawnT = 0; }

        for (let i = rows.length - 1; i >= 0; i--) {
          const rw = rows[i]; rw.y += speed;
          if (!rw.passed && rw.y >= bubY - BUB_R && rw.y <= bubY + BUB_R) {
            const inGap = bubX - BUB_R > rw.gapX && bubX + BUB_R < rw.gapX + rw.gapW;
            if (inGap) { updateScore(cfg.correctHitValue); flashText = "THROUGH!"; flashColor = "#10b981"; flashTimer = 14; playHit(); }
            else { updateScore(-cfg.wrongHitPenalty); flashText = "POP!"; flashColor = "#ef4444"; flashTimer = 22; flash = 18; playMiss(); bubX = W / 2; }
            rw.passed = true;
          }
          if (rw.y > H + 20) { rows.splice(i, 1); continue; }
          drawSpikeRow(rw);
        }

        const bc = flash > 0 ? "#ef4444" : "#06b6d4";
        ctx.strokeStyle = bc; ctx.lineWidth = 2.5; ctx.fillStyle = bc + "22"; ctx.shadowColor = bc; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(bubX, bubY, BUB_R, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bubX, bubY, BUB_R, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(bubX - 5, bubY - 5, 4, 0, Math.PI * 2); ctx.fill();
        if (flash > 0) flash--;

        if (flashTimer > 0) {
          ctx.globalAlpha = flashTimer / 22; ctx.font = "bold 18px Orbitron"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 22;
          ctx.fillText(flashText, W / 2, H * 0.28); ctx.shadowBlur = 0; ctx.globalAlpha = 1; flashTimer--;
        }
        ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("DRAG TO STEER THE BUBBLE THROUGH GAPS", W / 2, H - 14);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMoveP);
        canvas.removeEventListener("pointerup", onUp);
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
        const showDur = Math.max(140, 400 - round * 32);
        const blankDur = Math.max(38, 110 - round * 11);
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
    if (engine === "shield") {
      const CX = W / 2, CY = H / 2 - 10;
      const CORE_R = 22, SHIELD_R = 85;
      const SHIELD_ARC = Math.PI * 0.28; // ~50° arc — harder to block
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
        const speed = 3.0 + Math.random() * 2.5 + scoreRef.current / 170;
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
        const interval = Math.max(24, 72 - Math.floor(scoreRef.current / 48));
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

    // Safety guard — getEngine always returns a mapped engine with a block above
    // (simon is the documented fallback). This unconditional return keeps every
    // code path returning a cleanup so the effect type-checks cleanly.
    return () => { cancelAnimationFrame(rafRef.current); };
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
    grid: "MEMORY GRID", breaker: "BLOCK BREAKER", dodge: "LANE DODGE", balance: "BALANCE BEAM",
    magnet: "POLARITY MAGNET", trace: "NODE TRACE", bubble: "BUBBLE DRIFT",
  };

  const comboMultiplier = combo > 0 ? Math.min(4, 1 + Math.floor(combo / 4) * 0.5) : 1;

  return (
    <div className="fixed inset-0 bg-[#08080f] flex flex-col overflow-hidden">
      {/* HUD */}
      <div className="relative z-10 flex items-center justify-between px-3 py-2 border-b border-purple-900/50"
        style={{ background: "linear-gradient(180deg, rgba(10,4,28,0.98) 0%, rgba(8,8,15,0.95) 100%)", boxShadow: "0 1px 0 rgba(168,85,247,0.15), 0 4px 20px rgba(0,0,0,0.5)" }}>
        <button onClick={() => { if (!gameEndedRef.current) endGame(scoreRef.current); navigate("/"); }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">
          <X className="w-4 h-4 text-purple-500/70" />
        </button>
        <div className="flex items-center gap-3">
          <div className="text-center min-w-[48px]">
            <div className="text-[8px] text-purple-400/80 tracking-[0.2em] uppercase font-bold">Score</div>
            <div className="text-lg font-black tabular-nums leading-tight" style={{ color: "#e9d5ff", textShadow: "0 0 12px rgba(168,85,247,0.6)" }}>{score}</div>
          </div>
          {combo >= 2 && (
            <div className="text-center px-2 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)" }}>
              <div className="text-[8px] text-amber-400/80 tracking-widest uppercase font-bold">Combo</div>
              <div className="text-base font-black tabular-nums leading-tight text-amber-400">{combo}x</div>
            </div>
          )}
          <div className="text-center min-w-[48px]">
            <div className="text-[8px] text-amber-400/80 tracking-[0.2em] uppercase font-bold">Target</div>
            <div className="text-lg font-black tabular-nums leading-tight text-amber-400">{targetScore}</div>
          </div>
          <div className="text-center min-w-[40px]">
            <div className="text-[8px] text-purple-400/80 tracking-[0.2em] uppercase font-bold">Time</div>
            <div className={`text-lg font-black tabular-nums leading-tight ${timeWarning ? "text-red-400 animate-pulse" : "text-white"}`}
              style={timeWarning ? { textShadow: "0 0 16px rgba(239,68,68,0.8)" } : {}}>
              {timeLeft}s
            </div>
          </div>
        </div>
        <div className="w-8 flex-shrink-0" />
      </div>

      {/* Progress bar — dual layer */}
      <div className="h-2 relative overflow-hidden" style={{ background: "rgba(0,0,0,0.6)" }}>
        <div className="absolute inset-y-0 left-0 transition-all duration-300"
          style={{
            width: `${progressPct}%`,
            background: progressPct >= 80
              ? "linear-gradient(90deg,#7c3aed,#a855f7,#f59e0b)"
              : progressPct >= 50 ? "linear-gradient(90deg,#4c1d95,#7c3aed,#a855f7)"
              : "linear-gradient(90deg,#1e1b4b,#4c1d95)",
            boxShadow: progressPct >= 50 ? "0 0 8px rgba(168,85,247,0.6)" : "none"
          }} />
        <div className="absolute top-0 right-0 bottom-0 w-0.5 bg-amber-400" style={{ boxShadow: "0 0 6px #f59e0b" }} />
        {comboMultiplier > 1 && (
          <div className="absolute inset-0 opacity-30 animate-pulse"
            style={{ background: "linear-gradient(90deg,transparent,rgba(245,158,11,0.4),transparent)", backgroundSize: "200% 100%", animation: "shimmer 1s infinite" }} />
        )}
      </div>

      {/* Game label */}
      <div className="flex items-center justify-between px-4 py-0.5" style={{ background: "rgba(0,0,0,0.3)" }}>
        <div className="text-[8px] font-bold tracking-[0.22em] text-purple-500/60 uppercase">{game.name}</div>
        <div className="text-[8px] font-bold tracking-[0.15em] text-purple-500/40 uppercase">{ENGINE_LABELS[engineName] || engineName.toUpperCase()}</div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative" style={{ overflow: "hidden" }}>
        {/* Scanline overlay for CRT feel */}
        <div className="absolute inset-0 z-10 pointer-events-none"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)",
            mixBlendMode: "multiply"
          }} />
        {/* Vignette */}
        <div className="absolute inset-0 z-10 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
        {/* Edge glow */}
        <div className="absolute inset-0 z-10 pointer-events-none rounded"
          style={{ boxShadow: "inset 0 0 40px rgba(168,85,247,0.08), inset 0 0 2px rgba(168,85,247,0.2)" }} />

        {gameState === "countdown" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: "rgba(4,2,18,0.92)", backdropFilter: "blur(6px)" }}>
            <div className="text-center">
              <div className="text-[10px] text-purple-400 tracking-[0.4em] mb-4 uppercase font-bold" style={{ letterSpacing: "0.5em" }}>READY TO PLAY</div>
              <div className="text-[100px] font-black leading-none" style={{
                color: "#a855f7",
                textShadow: "0 0 60px rgba(168,85,247,1), 0 0 120px rgba(168,85,247,0.6), 0 0 200px rgba(168,85,247,0.3)",
                fontFamily: "Orbitron, monospace"
              }}>{countdown}</div>
              <div className="mt-5 text-xs text-muted-foreground tracking-[0.3em] uppercase">{game.name}</div>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} width={400} height={620} className="w-full h-full" style={{ cursor: "crosshair", touchAction: "none", display: "block" }} />
      </div>

      {/* Result overlay */}
      {gameState === "ended" && sessionResult && (
        <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: "rgba(2,2,12,0.94)", backdropFilter: "blur(10px)" }}>
          <div className="w-full max-w-sm mx-4 rounded-2xl border p-7 text-center space-y-4"
            style={{
              background: sessionResult.won
                ? "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(8,8,15,0.95) 100%)"
                : "linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(8,8,15,0.95) 100%)",
              borderColor: sessionResult.won ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.3)",
              boxShadow: sessionResult.won ? "0 0 60px rgba(16,185,129,0.15)" : "0 0 60px rgba(239,68,68,0.12)"
            }}>
            <div className="text-5xl font-black tracking-[0.08em]" style={{
              color: sessionResult.won ? "#10b981" : "#ef4444",
              textShadow: `0 0 50px ${sessionResult.won ? "rgba(16,185,129,0.8)" : "rgba(239,68,68,0.7)"}, 0 0 100px ${sessionResult.won ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.2)"}`
            }}>
              {sessionResult.won ? "VICTORY" : "DEFEAT"}
            </div>
            <div className="h-px" style={{ background: sessionResult.won ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)" }} />
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-white/50 tracking-wider uppercase text-[11px]">Final Score</span>
                <span className="font-black text-white text-base">{sessionResult.finalScore}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50 tracking-wider uppercase text-[11px]">Target</span>
                <span className="font-bold text-white/80">{sessionResult.targetScore}</span>
              </div>
              {sessionResult.won && (
                <div className="flex justify-between items-center mt-1 pt-2" style={{ borderTop: "1px solid rgba(245,158,11,0.2)" }}>
                  <span className="text-amber-400 tracking-wider uppercase text-[11px] font-bold">SKZ Earned</span>
                  <span className="font-black text-amber-400 text-lg" style={{ textShadow: "0 0 20px rgba(245,158,11,0.6)" }}>+{sessionResult.prize.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => navigate("/")}
                className="flex-1 py-3 rounded-xl font-bold text-sm tracking-wider transition-all"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
                LOBBY
              </button>
              <button onClick={() => navigate(`/game/${game.id}`)}
                className="flex-1 py-3 rounded-xl font-black text-sm tracking-wider"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", boxShadow: "0 0 24px rgba(168,85,247,0.5)" }}>
                RETRY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
