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
    "beat-drop": "vault", "conductor": "vault", "rhythm-gate": "vault",
    "time-warp": "vault", "gravity-drop": "vault",
    "zero-lag": "vault", "sniper-window": "vault", "chain-lightning": "vault",
    "pulse-strike": "heartbeat", "metronome": "heartbeat", "signal-match": "heartbeat",
    "tap-the-gap": "heartbeat", "sync-or-sink": "heartbeat",
    "mole-madness": "botslash", "hyperclick": "botslash", "neon-pop": "botslash",
    "flash-tap": "botslash", "plasma-swipe": "botslash",
    "color-cascade": "meteor", "neon-meteor": "meteor",
    "dead-center": "spinsniper", "no-scope": "spinsniper", "orbital-strike": "spinsniper",
    "laser-aim": "spinsniper", "pixel-perfect": "spinsniper", "snipe-the-flag": "spinsniper",
    "micro-targets": "spinsniper", "shrinking-zones": "spinsniper",
    "crosshair-king": "spinsniper", "moving-target": "spinsniper",
    "repeat-after": "simon", "cipher-sequence": "simon", "symbol-flash": "simon",
    "neural-link": "simon", "grid-memory": "simon", "mirror-maze": "simon",
    "reverse-trail": "simon", "path-finder": "simon", "stack-memory": "simon",
    "elastic-bounce": "magnet", "gravity-well": "magnet", "wrecking-ball": "magnet",
    "black-hole": "magnet", "particle-storm": "magnet", "zero-gravity": "magnet",
    "plasma-field": "magnet", "collapse-zone": "magnet",
    "void-runner": "physics", "gravity-flip": "physics",
  };
  if (MAP[slug]) return MAP[slug];
  if (category === "Timing") return "heartbeat";
  if (category === "Reflex") return "targets";
  if (category === "Aim") return "spinsniper";
  if (category === "Pattern") return "simon";
  if (category === "Physics") return "physics";
  return "targets";
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
  function playHit() { playTone(520, 0.08, "square", 0.18); }
  function playMiss() { playTone(140, 0.2, "sawtooth", 0.12); }
  function playPerfect() { playTone(880, 0.12, "sine", 0.25); setTimeout(() => playTone(1100, 0.1, "sine", 0.2), 80); }
  function playWin() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.2, "sine", 0.3), i * 100)); }
  function playLose() { [300, 250, 200].forEach((f, i) => setTimeout(() => playTone(f, 0.25, "sawtooth", 0.2), i * 120)); }

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

  // ─────────────────────────── GAME ENGINES ───────────────────────────
  useEffect(() => {
    if (gameState !== "playing" || !config || !canvasRef.current || !game) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    const cfg = config;

    function updateScore(delta: number) {
      scoreRef.current = Math.max(0, scoreRef.current + delta);
      setScore(scoreRef.current);
      if (scoreRef.current >= cfg.targetScore) endGame(scoreRef.current);
    }

    const gameSlug = game.slug;
    const gameCategory = game.category;
    const engine = getEngine(gameSlug, gameCategory);

    // ══════════════════════════════════════════════
    // ENGINE: TARGETS  (Reflex / Aim)
    // ══════════════════════════════════════════════
    if (engine === "targets") {
      interface Target { x: number; y: number; r: number; life: number; maxLife: number; color: string; hit: boolean; expand: number; vx: number; vy: number; }
      interface Ptcl { x: number; y: number; vx: number; vy: number; life: number; color: string; }
      const targets: Target[] = [];
      const ptcls: Ptcl[] = [];
      const COLS = ["#a855f7", "#06b6d4", "#f59e0b", "#10b981", "#f97316", "#ec4899"];
      let spawnT = 0;
      const SPAWN = gameCategory === "Aim" ? 90 : 55;
      const BASE_LIFE = gameCategory === "Aim" ? 100 : 65;
      let missFlash = 0;
      let scorePopups: { x: number; y: number; text: string; life: number; color: string }[] = [];

      function getXY(e: MouseEvent | TouchEvent) {
        const r = canvas.getBoundingClientRect();
        const sx = W / r.width, sy = H / r.height;
        if (e instanceof TouchEvent) return [(e.touches[0].clientX - r.left) * sx, (e.touches[0].clientY - r.top) * sy];
        return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
      }

      function handleClick(e: MouseEvent | TouchEvent) {
        const [cx, cy] = getXY(e);
        let hitAny = false;
        for (const t of targets) {
          if (t.hit) continue;
          const d = Math.hypot(cx - t.x, cy - t.y);
          if (d < t.r + 8) {
            t.hit = true; t.expand = 1.0; hitAny = true;
            for (let i = 0; i < 14; i++) ptcls.push({ x: t.x, y: t.y, vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 8, life: 35 + Math.random() * 20, color: t.color });
            scorePopups.push({ x: t.x, y: t.y - t.r - 10, text: `+${cfg.correctHitValue}`, life: 45, color: t.color });
            updateScore(cfg.correctHitValue);
            const perfect = d < t.r * 0.5;
            if (perfect) { playPerfect(); scorePopups.push({ x: t.x, y: t.y - t.r - 28, text: "PERFECT", life: 50, color: "#f59e0b" }); }
            else playHit();
            break;
          }
        }
        if (!hitAny) { updateScore(-cfg.wrongHitPenalty); playMiss(); missFlash = 12; }
      }

      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleClick(e); }, { passive: false });

      function loop() {
        ctx.fillStyle = "#08080f";
        ctx.fillRect(0, 0, W, H);
        // Hex grid BG
        ctx.strokeStyle = "rgba(168,85,247,0.06)";
        ctx.lineWidth = 1;
        const HEX = 40;
        for (let row = 0; row * HEX * 0.87 < H + HEX; row++) {
          for (let col = -1; col * HEX < W + HEX; col++) {
            const cx2 = col * HEX + (row % 2) * HEX / 2;
            const cy2 = row * HEX * 0.87;
            ctx.beginPath();
            for (let s = 0; s < 6; s++) {
              const a = (s / 6) * Math.PI * 2 - Math.PI / 6;
              s === 0 ? ctx.moveTo(cx2 + Math.cos(a) * 20, cy2 + Math.sin(a) * 20) : ctx.lineTo(cx2 + Math.cos(a) * 20, cy2 + Math.sin(a) * 20);
            }
            ctx.closePath(); ctx.stroke();
          }
        }

        if (missFlash > 0) { ctx.fillStyle = `rgba(239,68,68,${missFlash / 40})`; ctx.fillRect(0, 0, W, H); missFlash--; }

        // Particles
        for (let i = ptcls.length - 1; i >= 0; i--) {
          const p = ptcls[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.91; p.vy *= 0.91; p.life--;
          if (p.life <= 0) { ptcls.splice(i, 1); continue; }
          ctx.globalAlpha = p.life / 55;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color; ctx.shadowBlur = 4;
          ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;

        // Spawn
        spawnT++;
        if (spawnT >= SPAWN && targets.filter(t => !t.hit).length < 6) {
          const r = (gameCategory === "Aim" ? 14 : 20) + Math.random() * 14;
          const speed = gameCategory === "Aim" ? 0 : (Math.random() - .5) * 1.2;
          targets.push({ x: r + Math.random() * (W - 2 * r), y: r + Math.random() * (H - 2 * r - 80), r, life: BASE_LIFE + Math.random() * 30, maxLife: BASE_LIFE + 30, color: COLS[Math.floor(Math.random() * COLS.length)], hit: false, expand: 0, vx: speed, vy: (Math.random() - .5) * speed });
          spawnT = 0;
        }

        // Draw targets
        for (let i = targets.length - 1; i >= 0; i--) {
          const t = targets[i];
          if (t.hit) {
            t.expand -= 0.07;
            if (t.expand <= 0) { targets.splice(i, 1); continue; }
            ctx.globalAlpha = t.expand;
            ctx.strokeStyle = t.color; ctx.lineWidth = 3;
            ctx.shadowColor = t.color; ctx.shadowBlur = 20;
            ctx.beginPath(); ctx.arc(t.x, t.y, t.r * (2.5 - t.expand * 1.5), 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0; ctx.globalAlpha = 1;
            continue;
          }
          if (gameCategory === "Aim") { t.x = Math.max(t.r, Math.min(W - t.r, t.x + t.vx)); t.y = Math.max(t.r, Math.min(H - t.r - 80, t.y + t.vy)); if (t.x <= t.r || t.x >= W - t.r) t.vx *= -1; if (t.y <= t.r || t.y >= H - t.r - 80) t.vy *= -1; }
          t.life--;
          if (t.life <= 0) { targets.splice(i, 1); updateScore(-cfg.wrongHitPenalty); missFlash = 8; continue; }
          const progress = t.life / t.maxLife;
          const pulse = Math.sin(Date.now() * 0.01 + t.x) * 0.2 + 0.8;
          const alpha = Math.min(1, t.life / 15);
          // Glow fill
          const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.r);
          g.addColorStop(0, t.color + "55"); g.addColorStop(1, t.color + "00");
          ctx.globalAlpha = alpha * pulse; ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
          // Timer arc
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = t.color + "40"; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(t.x, t.y, t.r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();
          // Main circle
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = t.color; ctx.lineWidth = 2.5;
          ctx.shadowColor = t.color; ctx.shadowBlur = 12 * pulse;
          ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.stroke();
          ctx.shadowBlur = 0;
          // Crosshair for Aim
          if (gameCategory === "Aim") {
            ctx.strokeStyle = t.color; ctx.lineWidth = 1; ctx.globalAlpha = alpha * 0.6;
            ctx.beginPath(); ctx.moveTo(t.x - t.r + 4, t.y); ctx.lineTo(t.x + t.r - 4, t.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(t.x, t.y - t.r + 4); ctx.lineTo(t.x, t.y + t.r - 4); ctx.stroke();
            // Corner brackets
            ctx.lineWidth = 2;
            const b = t.r * 0.4;
            ctx.beginPath(); ctx.moveTo(t.x - t.r - 4, t.y - b); ctx.lineTo(t.x - t.r - 4, t.y - t.r - 4); ctx.lineTo(t.x - b, t.y - t.r - 4); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(t.x + t.r + 4, t.y - b); ctx.lineTo(t.x + t.r + 4, t.y - t.r - 4); ctx.lineTo(t.x + b, t.y - t.r - 4); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }

        // Score popups
        for (let i = scorePopups.length - 1; i >= 0; i--) {
          const p = scorePopups[i]; p.y -= 1.2; p.life--;
          if (p.life <= 0) { scorePopups.splice(i, 1); continue; }
          ctx.globalAlpha = p.life / 50;
          ctx.fillStyle = p.color; ctx.font = `bold 14px Orbitron, sans-serif`; ctx.textAlign = "center";
          ctx.fillText(p.text, p.x, p.y); ctx.globalAlpha = 1;
        }

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", handleClick); cancelAnimationFrame(rafRef.current); };
    }

    // ══════════════════════════════════════════════
    // ENGINE: HEARTBEAT  (ECG line — click at peaks)
    // ══════════════════════════════════════════════
    if (engine === "heartbeat") {
      const lineY = H * 0.55;
      const SCROLL_X = W * 0.62; // click zone x position
      const ECG_HISTORY: number[] = Array(W).fill(lineY);
      let phase = 0; // 0..1 within one beat cycle
      let speed = 0.012;
      let hitCount = 0;
      let feedbackTimer = 0, feedbackText = "", feedbackColor = "#fff";
      let peakTimer = 0; // frames since last peak
      let expectingClick = false;
      let clickWindow = 0; // frames remaining in click window
      const PEAK_INTERVAL = 60; // frames between peaks (decreases)
      let nextPeak = PEAK_INTERVAL;

      function handleClick() {
        if (clickWindow > 0) {
          const accuracy = clickWindow / 22; // 1=perfect, 0=barely
          const pts = accuracy > 0.7 ? cfg.correctHitValue : Math.round(cfg.correctHitValue * 0.6);
          updateScore(pts);
          if (accuracy > 0.7) { playPerfect(); feedbackText = "PERFECT SYNC"; feedbackColor = "#10b981"; }
          else { playHit(); feedbackText = "GOOD"; feedbackColor = "#a855f7"; }
          feedbackTimer = 40; clickWindow = 0; hitCount++;
          if (hitCount % 4 === 0) { speed = Math.min(0.032, speed * 1.12); nextPeak = Math.max(28, nextPeak - 4); }
        } else {
          updateScore(-cfg.wrongHitPenalty); playMiss();
          feedbackText = "OUT OF SYNC"; feedbackColor = "#ef4444"; feedbackTimer = 35;
        }
      }

      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleClick(); }, { passive: false });

      function ecgY(p: number): number {
        // ECG waveform: flat baseline with a sharp spike
        const m = p % 1;
        if (m < 0.08) return lineY - m * 80; // upswing Q
        if (m < 0.12) return lineY - (0.12 - m) * 600 + lineY * 0; // sharp peak R (goes up dramatically)
        if (m < 0.16) return lineY + (m - 0.12) * 300; // drop S
        if (m < 0.2) return lineY + 20 - (m - 0.16) * 100; // T wave
        if (m < 0.28) return lineY + 20 * (1 - (m - 0.2) / 0.08); // return to baseline
        return lineY;
      }
      // Adjusted for better visual peak
      function computeY(p: number): number {
        const m = p % 1;
        if (m < 0.05) return lineY;
        if (m < 0.1) return lineY - (m - 0.05) * 400; // Q-R upswing
        if (m < 0.13) return lineY - 20 + (m - 0.1) * 1500; // PEAK (R wave)
        if (m < 0.17) return lineY - 20 + (0.17 - m) * 800; // R-S downswing
        if (m < 0.2) return lineY + (0.2 - m) * 200;
        if (m < 0.3) return lineY + Math.sin((m - 0.2) / 0.1 * Math.PI) * 18; // T wave
        return lineY;
      }

      let frameCount = 0;

      function loop() {
        frameCount++;
        ctx.fillStyle = "rgba(5,15,8,0.92)";
        ctx.fillRect(0, 0, W, H);

        // Grid lines horizontal
        ctx.strokeStyle = "rgba(16,185,129,0.06)"; ctx.lineWidth = 1;
        for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

        // Scroll ECG history
        for (let x = 0; x < W - 1; x++) ECG_HISTORY[x] = ECG_HISTORY[x + 1];
        phase += speed;
        ECG_HISTORY[W - 1] = computeY(phase);

        // Draw ECG line with glow
        ctx.shadowColor = "#10b981"; ctx.shadowBlur = 8;
        ctx.strokeStyle = "#10b981"; ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let x = 0; x < W; x++) {
          const fade = x / W;
          ctx.globalAlpha = 0.2 + fade * 0.8;
          if (x === 0) ctx.moveTo(x, ECG_HISTORY[x]);
          else ctx.lineTo(x, ECG_HISTORY[x]);
        }
        ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;

        // Click window countdown
        peakTimer++;
        if (peakTimer >= nextPeak) { peakTimer = 0; clickWindow = 22; }
        if (clickWindow > 0) clickWindow--;

        // Click zone indicator
        const inWindow = clickWindow > 0;
        const zonePulse = Math.sin(Date.now() * 0.015) * 0.3 + 0.7;
        ctx.fillStyle = inWindow ? `rgba(245,158,11,${0.15 * zonePulse})` : "rgba(168,85,247,0.06)";
        ctx.fillRect(SCROLL_X - 18, 0, 36, H);
        ctx.strokeStyle = inWindow ? "#f59e0b" : "rgba(168,85,247,0.3)";
        ctx.lineWidth = inWindow ? 2 : 1;
        ctx.shadowColor = inWindow ? "#f59e0b" : "transparent";
        ctx.shadowBlur = inWindow ? 12 : 0;
        ctx.beginPath(); ctx.moveTo(SCROLL_X, 0); ctx.lineTo(SCROLL_X, H); ctx.stroke();
        ctx.shadowBlur = 0;

        if (inWindow) {
          ctx.fillStyle = "#f59e0b"; ctx.font = "bold 9px Orbitron, sans-serif"; ctx.textAlign = "center";
          ctx.fillText("CLICK", SCROLL_X, H * 0.25);
          ctx.fillText("NOW", SCROLL_X, H * 0.25 + 14);
        }

        // BPM indicator
        const bpm = Math.round(speed * 5000 / nextPeak * 10);
        ctx.fillStyle = "rgba(16,185,129,0.6)"; ctx.font = "bold 11px Orbitron, sans-serif"; ctx.textAlign = "left";
        ctx.fillText(`${bpm} BPM`, 16, 40);

        // Feedback
        if (feedbackTimer > 0) {
          ctx.globalAlpha = feedbackTimer / 45;
          ctx.fillStyle = feedbackColor; ctx.font = "bold 20px Orbitron, sans-serif"; ctx.textAlign = "center";
          ctx.shadowColor = feedbackColor; ctx.shadowBlur = 20;
          ctx.fillText(feedbackText, W / 2, H * 0.3);
          ctx.shadowBlur = 0; ctx.globalAlpha = 1; feedbackTimer--;
        }

        ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.font = "9px Orbitron, sans-serif"; ctx.textAlign = "center";
        ctx.fillText("TAP WHEN THE GOLD BAR IS ACTIVE", W / 2, H - 20);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", handleClick); cancelAnimationFrame(rafRef.current); };
    }

    // ══════════════════════════════════════════════
    // ENGINE: VAULT  (spinning dial — click in golden arc)
    // ══════════════════════════════════════════════
    if (engine === "vault") {
      const CX = W / 2, CY = H * 0.48;
      const RING_R = Math.min(W, H) * 0.28;
      let needleAngle = -Math.PI / 2;
      let dialSpeed = 0.022 + Math.random() * 0.008;
      let hitCount = 0;
      const ARC_START = Math.PI * 0.6 + Math.random() * Math.PI;
      const ARC_SIZE = 0.38;
      interface Spark { x: number; y: number; vx: number; vy: number; life: number; }
      const sparks: Spark[] = [];
      let feedbackTimer = 0, feedbackText = "", feedbackColor = "#fff";
      let screenFlash = 0, flashColor = "rgba(0,0,0,0)";

      function handleClick() {
        const norm = ((needleAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const arcNorm = ((ARC_START % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const diff = Math.min(Math.abs(norm - arcNorm), Math.PI * 2 - Math.abs(norm - arcNorm));
        if (diff < ARC_SIZE / 2 + 0.06) {
          updateScore(cfg.correctHitValue); playHit(); hitCount++;
          const sx = CX + Math.cos(needleAngle) * RING_R, sy = CY + Math.sin(needleAngle) * RING_R;
          for (let i = 0; i < 18; i++) sparks.push({ x: sx, y: sy, vx: (Math.random() - .5) * 10, vy: (Math.random() - .5) * 10, life: 35 + Math.random() * 15 });
          feedbackText = hitCount % 5 === 0 ? "MASTER CRACKER" : "CRACKED"; feedbackColor = "#f59e0b"; feedbackTimer = 45;
          screenFlash = 12; flashColor = "rgba(245,158,11,0.15)";
          if (hitCount % 4 === 0) dialSpeed = Math.min(0.07, dialSpeed * 1.15);
        } else {
          updateScore(-cfg.wrongHitPenalty); playMiss();
          feedbackText = "MISSED"; feedbackColor = "#ef4444"; feedbackTimer = 30;
          screenFlash = 10; flashColor = "rgba(239,68,68,0.2)";
        }
      }

      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleClick(); }, { passive: false });

      function loop() {
        ctx.fillStyle = "#070712";
        ctx.fillRect(0, 0, W, H);
        // Scan lines
        for (let y = 0; y < H; y += 3) { ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(0, y, W, 1); }

        if (screenFlash > 0) { ctx.fillStyle = flashColor; ctx.fillRect(0, 0, W, H); screenFlash--; }

        // Decorative outer rings
        for (let i = 3; i >= 0; i--) {
          ctx.strokeStyle = `rgba(168,85,247,${0.04 + i * 0.02})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(CX, CY, RING_R + 35 + i * 18, 0, Math.PI * 2); ctx.stroke();
        }

        // Metallic ring base
        ctx.strokeStyle = "#2a2a4a"; ctx.lineWidth = 20;
        ctx.beginPath(); ctx.arc(CX, CY, RING_R, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "#4a4a7a"; ctx.lineWidth = 16;
        ctx.beginPath(); ctx.arc(CX, CY, RING_R, 0, Math.PI * 2); ctx.stroke();

        // Tick marks
        for (let i = 0; i < 36; i++) {
          const a = (i / 36) * Math.PI * 2;
          const big = i % 9 === 0;
          ctx.strokeStyle = big ? "rgba(168,85,247,0.7)" : "rgba(100,100,180,0.4)";
          ctx.lineWidth = big ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(CX + Math.cos(a) * (RING_R - 12), CY + Math.sin(a) * (RING_R - 12));
          ctx.lineTo(CX + Math.cos(a) * (RING_R - 4), CY + Math.sin(a) * (RING_R - 4));
          ctx.stroke();
        }

        // Golden arc (sweet spot)
        const aPulse = Math.sin(Date.now() * 0.007) * 0.25 + 0.75;
        ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 18 * aPulse;
        ctx.strokeStyle = `rgba(245,158,11,${0.75 * aPulse})`; ctx.lineWidth = 22;
        ctx.beginPath(); ctx.arc(CX, CY, RING_R, ARC_START - ARC_SIZE / 2, ARC_START + ARC_SIZE / 2);
        ctx.stroke(); ctx.shadowBlur = 0;
        // Golden arc label
        const labelA = ARC_START;
        ctx.fillStyle = "#f59e0b"; ctx.font = "bold 8px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("ZONE", CX + Math.cos(labelA) * (RING_R + 24), CY + Math.sin(labelA) * (RING_R + 24));

        // Center hub
        const hub = ctx.createRadialGradient(CX, CY, 0, CX, CY, 22);
        hub.addColorStop(0, "#c026d3"); hub.addColorStop(1, "#581c87");
        ctx.fillStyle = hub; ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 25;
        ctx.beginPath(); ctx.arc(CX, CY, 20, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Needle rotation
        needleAngle += dialSpeed;
        const nx = CX + Math.cos(needleAngle) * (RING_R - 8), ny = CY + Math.sin(needleAngle) * (RING_R - 8);
        const norm2 = ((needleAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const arcN2 = ((ARC_START % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const nearArc = Math.min(Math.abs(norm2 - arcN2), Math.PI * 2 - Math.abs(norm2 - arcN2)) < ARC_SIZE * 0.7;
        const needleColor = nearArc ? "#f59e0b" : "#06b6d4";
        ctx.strokeStyle = needleColor; ctx.lineWidth = 3;
        ctx.shadowColor = needleColor; ctx.shadowBlur = nearArc ? 22 : 10;
        ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(nx, ny); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = needleColor;
        ctx.beginPath(); ctx.arc(nx, ny, 6, 0, Math.PI * 2); ctx.fill();

        // Sparks
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i]; s.x += s.vx; s.y += s.vy; s.vx *= 0.88; s.vy *= 0.88; s.life--;
          if (s.life <= 0) { sparks.splice(i, 1); continue; }
          ctx.globalAlpha = s.life / 50;
          ctx.fillStyle = "#f59e0b"; ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 5;
          ctx.beginPath(); ctx.arc(s.x, s.y, 2 + s.life / 20, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;

        // Speed indicator
        ctx.fillStyle = "rgba(168,85,247,0.5)"; ctx.font = "9px Orbitron"; ctx.textAlign = "left";
        ctx.fillText(`SPEED: ${(dialSpeed * 1000).toFixed(0)}`, 16, 30);

        // Feedback
        if (feedbackTimer > 0) {
          ctx.globalAlpha = feedbackTimer / 50;
          ctx.fillStyle = feedbackColor; ctx.font = "bold 22px Orbitron"; ctx.textAlign = "center";
          ctx.shadowColor = feedbackColor; ctx.shadowBlur = 25;
          ctx.fillText(feedbackText, CX, CY - RING_R - 30);
          ctx.shadowBlur = 0; ctx.globalAlpha = 1; feedbackTimer--;
        }

        ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("TAP WHEN NEEDLE IS IN THE GOLDEN ZONE", W / 2, H - 20);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", handleClick); cancelAnimationFrame(rafRef.current); };
    }

    // ══════════════════════════════════════════════
    // ENGINE: BOTSLASH  (tap bots before they vanish)
    // ══════════════════════════════════════════════
    if (engine === "botslash") {
      interface Bot { x: number; y: number; r: number; life: number; maxLife: number; hostile: boolean; slashed: boolean; slashAnim: number; }
      interface SlashLine { x1: number; y1: number; x2: number; y2: number; life: number; }
      const bots: Bot[] = [];
      const slashes: SlashLine[] = [];
      let waveTimer = 0;
      const WAVE = 50;
      let screenFlash = 0, flashCol = "rgba(0,0,0,0)";

      function getXY(e: MouseEvent | TouchEvent) {
        const r = canvas.getBoundingClientRect();
        const sx = W / r.width, sy = H / r.height;
        if (e instanceof TouchEvent) return [(e.touches[0].clientX - r.left) * sx, (e.touches[0].clientY - r.top) * sy];
        return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
      }

      function handleClick(e: MouseEvent | TouchEvent) {
        const [cx, cy] = getXY(e);
        let hit = false;
        for (const b of bots) {
          if (b.slashed) continue;
          if (Math.hypot(cx - b.x, cy - b.y) < b.r + 8) {
            b.slashed = true; b.slashAnim = 1.0;
            slashes.push({ x1: cx - b.r * 1.3, y1: cy - b.r * 0.8, x2: cx + b.r * 1.3, y2: cy + b.r * 0.8, life: 20 });
            if (b.hostile) { updateScore(cfg.correctHitValue); playHit(); screenFlash = 8; flashCol = "rgba(168,85,247,0.18)"; }
            else { updateScore(-cfg.wrongHitPenalty * 2); playMiss(); screenFlash = 10; flashCol = "rgba(239,68,68,0.25)"; }
            hit = true; break;
          }
        }
        if (!hit) { updateScore(-cfg.wrongHitPenalty); playMiss(); }
      }

      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleClick(e); }, { passive: false });

      function spawnBot() {
        const r = 28 + Math.random() * 18;
        const hostile = Math.random() > 0.28;
        bots.push({ x: r + Math.random() * (W - 2 * r), y: r + Math.random() * (H - 2 * r - 90), r, life: (hostile ? 80 : 110) + Math.random() * 40, maxLife: 120, hostile, slashed: false, slashAnim: 0 });
      }

      function drawBotFace(ctx: CanvasRenderingContext2D, b: Bot, alpha: number) {
        const color = b.hostile ? "#f97316" : "#10b981";
        const pulse = Math.sin(Date.now() * 0.01 + b.x) * 0.15 + 0.85;
        const progress = b.life / b.maxLife;

        // Outer glow
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r + 8);
        g.addColorStop(0, color + "40"); g.addColorStop(1, color + "00");
        ctx.globalAlpha = alpha * 0.6; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 8, 0, Math.PI * 2); ctx.fill();

        // Body circle
        ctx.globalAlpha = alpha;
        ctx.fillStyle = b.hostile ? "#1a0a05" : "#051a0a";
        ctx.strokeStyle = color; ctx.lineWidth = 2.5;
        ctx.shadowColor = color; ctx.shadowBlur = 12 * pulse;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;

        // Eyes
        const eyeOff = b.r * 0.3;
        ctx.fillStyle = color;
        if (b.hostile) {
          // X eyes
          const ew = b.r * 0.2;
          for (const dx of [-eyeOff, eyeOff]) {
            ctx.lineWidth = 2; ctx.strokeStyle = color;
            ctx.beginPath(); ctx.moveTo(b.x + dx - ew, b.y - eyeOff - ew); ctx.lineTo(b.x + dx + ew, b.y - eyeOff + ew); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(b.x + dx + ew, b.y - eyeOff - ew); ctx.lineTo(b.x + dx - ew, b.y - eyeOff + ew); ctx.stroke();
          }
          // Angry mouth
          ctx.lineWidth = 2; ctx.strokeStyle = color;
          ctx.beginPath(); ctx.arc(b.x, b.y + eyeOff * 0.6, b.r * 0.35, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        } else {
          // Dot eyes
          for (const dx of [-eyeOff, eyeOff]) { ctx.beginPath(); ctx.arc(b.x + dx, b.y - eyeOff, b.r * 0.12, 0, Math.PI * 2); ctx.fill(); }
          // Smile
          ctx.lineWidth = 2; ctx.strokeStyle = color;
          ctx.beginPath(); ctx.arc(b.x, b.y + eyeOff * 0.2, b.r * 0.35, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        }

        // Timer arc
        ctx.strokeStyle = color + "60"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();

        // Label
        ctx.fillStyle = color; ctx.font = `bold ${b.r * 0.28}px Orbitron`; ctx.textAlign = "center";
        ctx.fillText(b.hostile ? "HOSTILE" : "SAFE", b.x, b.y + b.r + 14);
      }

      function loop() {
        ctx.fillStyle = "rgba(8,8,15,0.88)";
        ctx.fillRect(0, 0, W, H);
        // Neon grid
        ctx.strokeStyle = "rgba(168,85,247,0.07)"; ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 35) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 35) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        if (screenFlash > 0) { ctx.fillStyle = flashCol; ctx.fillRect(0, 0, W, H); screenFlash--; }

        // Spawn
        waveTimer++;
        if (waveTimer >= WAVE && bots.filter(b => !b.slashed).length < 6) { spawnBot(); if (Math.random() > 0.5) spawnBot(); waveTimer = 0; }

        // Slashes
        for (let i = slashes.length - 1; i >= 0; i--) {
          const sl = slashes[i]; sl.life--;
          if (sl.life <= 0) { slashes.splice(i, 1); continue; }
          ctx.globalAlpha = sl.life / 20;
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3;
          ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.moveTo(sl.x1, sl.y1); ctx.lineTo(sl.x2, sl.y2); ctx.stroke();
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        }

        // Bots
        for (let i = bots.length - 1; i >= 0; i--) {
          const b = bots[i];
          if (b.slashed) {
            b.slashAnim -= 0.06;
            if (b.slashAnim <= 0) { bots.splice(i, 1); continue; }
            ctx.globalAlpha = b.slashAnim;
            ctx.strokeStyle = b.hostile ? "#f97316" : "#10b981"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (2 - b.slashAnim), 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1; continue;
          }
          b.life--;
          if (b.life <= 0) {
            bots.splice(i, 1);
            if (b.hostile) { updateScore(-cfg.wrongHitPenalty); screenFlash = 8; flashCol = "rgba(239,68,68,0.15)"; }
            continue;
          }
          drawBotFace(ctx, b, Math.min(1, b.life / 12));
          ctx.globalAlpha = 1;
        }

        ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("TAP HOSTILE BOTS — AVOID SAFE ONES", W / 2, H - 18);
        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", handleClick); cancelAnimationFrame(rafRef.current); };
    }

    // ══════════════════════════════════════════════
    // ENGINE: METEOR  (color-match falling meteors)
    // ══════════════════════════════════════════════
    if (engine === "meteor") {
      const METEOR_COLORS = ["#a855f7", "#06b6d4", "#f59e0b", "#10b981"];
      const METEOR_NAMES = ["PURPLE", "CYAN", "GOLD", "GREEN"];
      let basketColorIdx = 0;
      interface Meteor { x: number; y: number; colorIdx: number; speed: number; size: number; trail: { x: number; y: number }[]; exploding: boolean; explodeAnim: number; hit: boolean; }
      const meteors: Meteor[] = [];
      let spawnTimer = 0;
      const SPAWN_RATE = 80;
      const BASKET_Y = H - 55;
      const BASKET_W = 70, BASKET_H = 36;
      const BASKET_X = W / 2 - BASKET_W / 2;
      let scorePopups: { x: number; y: number; text: string; life: number; color: string }[] = [];
      // Stars
      const stars: { x: number; y: number; r: number; twinkle: number }[] = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.8, r: 0.5 + Math.random() * 1.5, twinkle: Math.random() * Math.PI * 2 }));

      function handleClick(e: MouseEvent | TouchEvent) {
        const rect = canvas.getBoundingClientRect();
        const sx = W / rect.width, sy = H / rect.height;
        let cx: number, cy: number;
        if (e instanceof TouchEvent) { cx = (e.touches[0].clientX - rect.left) * sx; cy = (e.touches[0].clientY - rect.top) * sy; }
        else { cx = (e.clientX - rect.left) * sx; cy = (e.clientY - rect.top) * sy; }
        // Click on basket = cycle color
        if (cx > BASKET_X - 20 && cx < BASKET_X + BASKET_W + 20 && cy > BASKET_Y - 20) {
          basketColorIdx = (basketColorIdx + 1) % METEOR_COLORS.length;
          playTone(440 + basketColorIdx * 80, 0.1, "sine", 0.15);
        }
      }

      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleClick(e); }, { passive: false });

      function loop() {
        ctx.fillStyle = "#04040e";
        ctx.fillRect(0, 0, W, H);
        // Stars
        for (const s of stars) {
          s.twinkle += 0.04;
          ctx.globalAlpha = 0.4 + Math.sin(s.twinkle) * 0.3;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Nebula glow
        for (let i = 0; i < 3; i++) {
          const ng = ctx.createRadialGradient(W * [0.2, 0.7, 0.5][i], H * [0.2, 0.15, 0.4][i], 0, W * [0.2, 0.7, 0.5][i], H * [0.2, 0.15, 0.4][i], 80);
          ng.addColorStop(0, ["rgba(168,85,247,0.08)", "rgba(6,182,212,0.06)", "rgba(245,158,11,0.05)"][i]);
          ng.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = ng; ctx.fillRect(0, 0, W, H);
        }

        // Spawn meteors
        spawnTimer++;
        if (spawnTimer >= SPAWN_RATE) {
          spawnTimer = 0;
          const cIdx = Math.floor(Math.random() * METEOR_COLORS.length);
          meteors.push({ x: 20 + Math.random() * (W - 40), y: -20, colorIdx: cIdx, speed: 2.5 + Math.random() * 2, size: 14 + Math.random() * 10, trail: [], exploding: false, explodeAnim: 0, hit: false });
        }

        // Meteors
        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i];
          if (m.exploding) {
            m.explodeAnim += 0.08;
            if (m.explodeAnim >= 1) { meteors.splice(i, 1); continue; }
            const ec = METEOR_COLORS[m.colorIdx];
            ctx.globalAlpha = 1 - m.explodeAnim;
            ctx.strokeStyle = ec; ctx.lineWidth = 2;
            ctx.shadowColor = ec; ctx.shadowBlur = 20;
            ctx.beginPath(); ctx.arc(m.x, m.y, m.size * (1 + m.explodeAnim * 4), 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0; ctx.globalAlpha = 1; continue;
          }
          m.trail.push({ x: m.x, y: m.y });
          if (m.trail.length > 12) m.trail.shift();
          m.y += m.speed;

          // Check basket catch
          if (m.y >= BASKET_Y - m.size && m.y < BASKET_Y + m.size && m.x > BASKET_X && m.x < BASKET_X + BASKET_W && !m.hit) {
            m.hit = true; m.exploding = true;
            if (m.colorIdx === basketColorIdx) {
              updateScore(cfg.correctHitValue); playHit();
              scorePopups.push({ x: m.x, y: BASKET_Y - 30, text: `+${cfg.correctHitValue}`, life: 45, color: METEOR_COLORS[m.colorIdx] });
            } else {
              updateScore(-cfg.wrongHitPenalty); playMiss();
              scorePopups.push({ x: m.x, y: BASKET_Y - 30, text: "WRONG COLOR!", life: 40, color: "#ef4444" });
            }
          } else if (m.y > H && !m.hit) {
            meteors.splice(i, 1);
            updateScore(-cfg.wrongHitPenalty);
            continue;
          }

          // Trail
          const col = METEOR_COLORS[m.colorIdx];
          for (let t = 0; t < m.trail.length; t++) {
            const trailAlpha = (t / m.trail.length) * 0.6;
            ctx.globalAlpha = trailAlpha;
            ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 5;
            const r = m.size * (t / m.trail.length) * 0.7;
            ctx.beginPath(); ctx.arc(m.trail[t].x, m.trail[t].y, r, 0, Math.PI * 2); ctx.fill();
          }
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;

          // Meteor body
          const mg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size);
          mg.addColorStop(0, "#ffffff"); mg.addColorStop(0.4, col); mg.addColorStop(1, col + "00");
          ctx.fillStyle = mg; ctx.shadowColor = col; ctx.shadowBlur = 15;
          ctx.beginPath(); ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Score popups
        for (let i = scorePopups.length - 1; i >= 0; i--) {
          const p = scorePopups[i]; p.y -= 1.5; p.life--;
          if (p.life <= 0) { scorePopups.splice(i, 1); continue; }
          ctx.globalAlpha = p.life / 50; ctx.fillStyle = p.color; ctx.font = "bold 13px Orbitron"; ctx.textAlign = "center";
          ctx.fillText(p.text, p.x, p.y); ctx.globalAlpha = 1;
        }

        // Basket
        const bColor = METEOR_COLORS[basketColorIdx];
        const bPulse = Math.sin(Date.now() * 0.008) * 0.2 + 0.8;
        ctx.shadowColor = bColor; ctx.shadowBlur = 20 * bPulse;
        ctx.strokeStyle = bColor; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(BASKET_X, BASKET_Y, BASKET_W, BASKET_H, 6); ctx.stroke();
        ctx.fillStyle = bColor + "20";
        ctx.beginPath(); ctx.roundRect(BASKET_X, BASKET_Y, BASKET_W, BASKET_H, 6); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = bColor; ctx.font = "bold 9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText(METEOR_NAMES[basketColorIdx], W / 2, BASKET_Y + 13);
        ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "8px Orbitron";
        ctx.fillText("TAP TO CHANGE COLOR", W / 2, BASKET_Y + 26);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", handleClick); cancelAnimationFrame(rafRef.current); };
    }

    // ══════════════════════════════════════════════
    // ENGINE: SPINSNIPER  (rotating wheel — shoot through gap)
    // ══════════════════════════════════════════════
    if (engine === "spinsniper") {
      const CX = W / 2, CY = H * 0.42;
      const RING_R = Math.min(W, H) * 0.3;
      const GAP_SIZE = 0.42; // radians
      let wheelAngle = 0;
      let wheelSpeed = 0.018 + Math.random() * 0.008;
      let hitCount = 0;
      interface Bullet { y: number; hit: boolean; life: number; }
      let bullet: Bullet | null = null;
      let feedbackTimer = 0, feedbackText = "", feedbackColor = "#fff";
      let explosion: { life: number; x: number; y: number } | null = null;
      interface Spark { x: number; y: number; vx: number; vy: number; life: number; }
      const sparks: Spark[] = [];

      function handleClick() {
        if (bullet) return;
        // Fire bullet from bottom
        bullet = { y: CY + RING_R + 60, hit: false, life: 60 };
        playTone(660, 0.08, "square", 0.2);
      }

      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleClick(); }, { passive: false });

      function gapContainsAngle(testAngle: number): boolean {
        // Gap is at top (270deg = -PI/2), or wherever current gapCenter is
        const gapCenter = wheelAngle + Math.PI * 1.5; // gap always at top of wheel relative to rotation
        const norm = (testAngle - gapCenter + Math.PI * 4) % (Math.PI * 2);
        return norm < GAP_SIZE / 2 || norm > Math.PI * 2 - GAP_SIZE / 2;
      }

      function loop() {
        ctx.fillStyle = "#060610";
        ctx.fillRect(0, 0, W, H);
        // Concentric rings BG
        for (let i = 5; i >= 0; i--) {
          ctx.strokeStyle = `rgba(6,182,212,${0.03 + i * 0.01})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(CX, CY, (RING_R + 80) * (i / 5), 0, Math.PI * 2); ctx.stroke();
        }

        // Bullseye (behind wheel)
        const bullseye = [
          { r: 10, c: "#ffffff" }, { r: 25, c: "#ef4444" }, { r: 40, c: "#ffffff" },
          { r: 55, c: "#ef4444" }, { r: 70, c: "#ffffff" }, { r: 85, c: "#3b82f6" },
        ];
        for (const b of bullseye) {
          ctx.fillStyle = b.c + "30"; ctx.strokeStyle = b.c + "60"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(CX, CY, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }

        // Spinning wheel (drawn as arcs with gap)
        wheelAngle += wheelSpeed;
        const gapCenter = (wheelAngle + Math.PI * 1.5) % (Math.PI * 2);
        const gapStart = gapCenter - GAP_SIZE / 2;
        const gapEnd = gapCenter + GAP_SIZE / 2;

        // Metallic rim
        ctx.strokeStyle = "#334155"; ctx.lineWidth = 32;
        ctx.beginPath(); ctx.arc(CX, CY, RING_R, gapEnd, gapStart); ctx.stroke();
        ctx.strokeStyle = "#475569"; ctx.lineWidth = 28;
        ctx.beginPath(); ctx.arc(CX, CY, RING_R, gapEnd, gapStart); ctx.stroke();
        // Neon edge
        ctx.strokeStyle = "#06b6d4"; ctx.lineWidth = 2;
        ctx.shadowColor = "#06b6d4"; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(CX, CY, RING_R, gapEnd, gapStart); ctx.stroke();
        ctx.shadowBlur = 0;

        // Gap edges glow
        for (const angle of [gapStart, gapEnd]) {
          ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 3;
          ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.moveTo(CX + Math.cos(angle) * (RING_R - 16), CY + Math.sin(angle) * (RING_R - 16));
          ctx.lineTo(CX + Math.cos(angle) * (RING_R + 16), CY + Math.sin(angle) * (RING_R + 16));
          ctx.stroke(); ctx.shadowBlur = 0;
        }

        // Gap label
        const gapLabelAngle = gapCenter;
        const outside = RING_R + 28;
        ctx.fillStyle = "#f59e0b"; ctx.font = "bold 8px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("GAP", CX + Math.cos(gapLabelAngle) * outside, CY + Math.sin(gapLabelAngle) * outside + 3);

        // Bullet (fires upward from bottom)
        if (bullet) {
          bullet.y -= 14; bullet.life--;
          const hitY = CY + RING_R; const innerY = CY - RING_R;
          // Check if bullet reaches the wheel
          if (bullet.y <= hitY && !bullet.hit) {
            bullet.hit = true;
            const bulletAngle = -Math.PI / 2; // bullet comes from bottom, angle = -90deg in wheel space
            if (gapContainsAngle(bulletAngle)) {
              // Miss inner target
            }
            // Actually check if gap faces downward (bottom = 90deg = PI/2)
            const bottomAngle = Math.PI / 2;
            const normGap = (gapCenter + Math.PI * 4) % (Math.PI * 2);
            const diff = Math.abs(normGap - bottomAngle);
            const minDiff = Math.min(diff, Math.PI * 2 - diff);
            if (minDiff < GAP_SIZE / 2 + 0.08) {
              // Hit through gap!
              updateScore(cfg.correctHitValue); hitCount++;
              feedbackText = "BULLSEYE"; feedbackColor = "#f59e0b"; feedbackTimer = 45;
              explosion = { life: 30, x: CX, y: CY };
              for (let i = 0; i < 20; i++) sparks.push({ x: CX, y: CY, vx: (Math.random() - .5) * 12, vy: (Math.random() - .5) * 12, life: 30 + Math.random() * 20 });
              playPerfect();
              if (hitCount % 4 === 0) wheelSpeed = Math.min(0.06, wheelSpeed * 1.12);
            } else {
              // Hit wheel
              updateScore(-cfg.wrongHitPenalty); playMiss();
              feedbackText = "BLOCKED"; feedbackColor = "#ef4444"; feedbackTimer = 30;
              for (let i = 0; i < 8; i++) sparks.push({ x: CX, y: CY + RING_R, vx: (Math.random() - .5) * 6, vy: -Math.random() * 8, life: 20 });
            }
          }
          if (bullet.y < innerY || bullet.life <= 0) bullet = null;
          if (bullet) {
            ctx.fillStyle = "#facc15"; ctx.shadowColor = "#facc15"; ctx.shadowBlur = 15;
            ctx.beginPath(); ctx.arc(CX, bullet.y, 5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#facc15"; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
            ctx.beginPath(); ctx.moveTo(CX, bullet.y); ctx.lineTo(CX, bullet.y + 20); ctx.stroke();
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          }
        }

        // Explosion
        if (explosion) {
          explosion.life--;
          ctx.globalAlpha = explosion.life / 30;
          ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 3;
          ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 30;
          ctx.beginPath(); ctx.arc(explosion.x, explosion.y, (30 - explosion.life) * 3, 0, Math.PI * 2); ctx.stroke();
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
          if (explosion.life <= 0) explosion = null;
        }

        // Sparks
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i]; s.x += s.vx; s.y += s.vy; s.vy += 0.3; s.life--;
          if (s.life <= 0) { sparks.splice(i, 1); continue; }
          ctx.globalAlpha = s.life / 50;
          ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Fire button
        const fireY = H - 55;
        ctx.strokeStyle = bullet ? "rgba(106,182,212,0.4)" : "#06b6d4";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#06b6d4"; ctx.shadowBlur = bullet ? 5 : 15;
        ctx.strokeRect(CX - 35, fireY, 70, 28);
        ctx.shadowBlur = 0;
        ctx.fillStyle = bullet ? "rgba(6,182,212,0.1)" : "rgba(6,182,212,0.2)";
        ctx.fillRect(CX - 35, fireY, 70, 28);
        ctx.fillStyle = bullet ? "rgba(6,182,212,0.4)" : "#06b6d4";
        ctx.font = "bold 10px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("FIRE", CX, fireY + 17);

        // Feedback
        if (feedbackTimer > 0) {
          ctx.globalAlpha = feedbackTimer / 50;
          ctx.fillStyle = feedbackColor; ctx.font = "bold 22px Orbitron"; ctx.textAlign = "center";
          ctx.shadowColor = feedbackColor; ctx.shadowBlur = 25;
          ctx.fillText(feedbackText, CX, H * 0.12);
          ctx.shadowBlur = 0; ctx.globalAlpha = 1; feedbackTimer--;
        }

        ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("FIRE WHEN THE GAP FACES DOWN", W / 2, H - 18);
        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", handleClick); cancelAnimationFrame(rafRef.current); };
    }

    // ══════════════════════════════════════════════
    // ENGINE: SIMON  (crypto sequence memory)
    // ══════════════════════════════════════════════
    if (engine === "simon") {
      const SYMBOLS = ["₿", "Ξ", "Ŧ", "◎", "Ⓢ", "₳", "⚡", "Ṁ", "⊕"];
      const COLORS_S = ["#f59e0b", "#a855f7", "#06b6d4", "#10b981", "#f97316", "#ec4899", "#84cc16", "#06b6d4", "#8b5cf6"];
      const GRID = 3;
      const CELL = Math.min((W - 60) / GRID, 90);
      const OX = (W - GRID * CELL) / 2, OY = (H - GRID * CELL) / 2 - 20;
      let sequence: number[] = [];
      let playerSeq: number[] = [];
      let phase: "showing" | "input" | "waiting" = "waiting";
      let showIdx = 0, showTimer = 0;
      let lit: { idx: number; alpha: number } | null = null;
      let inputLocked = true;
      let roundNum = 0;
      let feedbackTimer = 0, feedbackText = "", feedbackColor = "#fff";

      function nextRound() {
        sequence.push(Math.floor(Math.random() * GRID * GRID));
        playerSeq = []; phase = "showing"; showIdx = 0; showTimer = 0; lit = null; inputLocked = true; roundNum++;
      }
      setTimeout(nextRound, 600);

      function getXY(e: MouseEvent | TouchEvent) {
        const r = canvas.getBoundingClientRect();
        const sx = W / r.width, sy = H / r.height;
        if (e instanceof TouchEvent) return [(e.touches[0].clientX - r.left) * sx, (e.touches[0].clientY - r.top) * sy];
        return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
      }

      function handleClick(e: MouseEvent | TouchEvent) {
        if (phase !== "input" || inputLocked) return;
        const [cx, cy] = getXY(e);
        const col = Math.floor((cx - OX) / CELL), row = Math.floor((cy - OY) / CELL);
        if (col < 0 || col >= GRID || row < 0 || row >= GRID) return;
        const idx = row * GRID + col;
        lit = { idx, alpha: 1 };
        if (idx === sequence[playerSeq.length]) {
          playerSeq.push(idx);
          playTone(300 + idx * 60, 0.12, "sine", 0.2);
          if (playerSeq.length === sequence.length) {
            updateScore(cfg.correctHitValue * sequence.length);
            feedbackText = `SEQUENCE ${roundNum} CLEARED`; feedbackColor = "#10b981"; feedbackTimer = 50;
            phase = "waiting"; setTimeout(nextRound, 1000);
          }
        } else {
          updateScore(-cfg.wrongHitPenalty); playMiss();
          feedbackText = "WRONG SEQUENCE"; feedbackColor = "#ef4444"; feedbackTimer = 45;
          playerSeq = []; phase = "waiting"; setTimeout(nextRound, 900);
        }
      }

      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleClick(e); }, { passive: false });

      function loop() {
        ctx.fillStyle = "#080810";
        ctx.fillRect(0, 0, W, H);
        // Subtle grid
        ctx.strokeStyle = "rgba(16,185,129,0.05)"; ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 25) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        // Sequence display
        if (phase === "showing") {
          showTimer++;
          if (showTimer === 5) { lit = { idx: sequence[showIdx], alpha: 1 }; playTone(300 + sequence[showIdx] * 60, 0.15, "sine", 0.2); }
          if (showTimer > 35) { lit = null; showIdx++; showTimer = 0; if (showIdx >= sequence.length) { phase = "input"; inputLocked = false; } }
        }
        if (lit) lit.alpha = Math.max(0, lit.alpha - 0.035);

        // Draw grid
        for (let r2 = 0; r2 < GRID; r2++) {
          for (let c2 = 0; c2 < GRID; c2++) {
            const idx = r2 * GRID + c2;
            const x = OX + c2 * CELL, y = OY + r2 * CELL;
            const color = COLORS_S[idx];
            const isLit = lit?.idx === idx ? lit.alpha : 0;
            const isCompleted = playerSeq.includes(idx);

            // Cell background
            ctx.fillStyle = color + (isLit > 0.3 ? "55" : "18");
            ctx.strokeStyle = color + (isCompleted ? "cc" : isLit > 0 ? "cc" : "55");
            ctx.lineWidth = isLit > 0 ? 3 : 1.5;
            ctx.shadowColor = color; ctx.shadowBlur = isLit > 0 ? 25 * isLit : (isCompleted ? 8 : 0);
            ctx.beginPath(); ctx.roundRect(x + 5, y + 5, CELL - 10, CELL - 10, 12);
            ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;

            // Symbol
            ctx.fillStyle = color + (isLit > 0 ? "ff" : isCompleted ? "cc" : "88");
            ctx.font = `bold ${CELL * 0.42}px Orbitron, serif`;
            ctx.textAlign = "center";
            ctx.fillText(SYMBOLS[idx], x + CELL / 2, y + CELL / 2 + CELL * 0.16);
          }
        }

        // Phase label
        const phaseLabel = phase === "showing" ? `WATCH: ${showIdx + 1}/${sequence.length}` : phase === "input" ? `YOUR TURN: ${playerSeq.length}/${sequence.length}` : "PROCESSING...";
        const phaseColor = phase === "showing" ? "#f59e0b" : phase === "input" ? "#a855f7" : "#06b6d4";
        ctx.fillStyle = phaseColor; ctx.font = "bold 11px Orbitron"; ctx.textAlign = "center";
        ctx.fillText(phaseLabel, W / 2, OY - 22);

        // Progress dots
        const dotY = OY + GRID * CELL + 28;
        for (let i = 0; i < sequence.length; i++) {
          const dotX = W / 2 - (sequence.length - 1) * 9 + i * 18;
          ctx.fillStyle = i < playerSeq.length ? "#10b981" : "rgba(255,255,255,0.2)";
          ctx.shadowColor = i < playerSeq.length ? "#10b981" : "transparent";
          ctx.shadowBlur = i < playerSeq.length ? 8 : 0;
          ctx.beginPath(); ctx.arc(dotX, dotY, 6, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Round indicator
        ctx.fillStyle = "rgba(168,85,247,0.5)"; ctx.font = "9px Orbitron"; ctx.textAlign = "left";
        ctx.fillText(`ROUND ${roundNum}`, 16, 28);

        // Feedback
        if (feedbackTimer > 0) {
          ctx.globalAlpha = feedbackTimer / 55;
          ctx.fillStyle = feedbackColor; ctx.font = "bold 16px Orbitron"; ctx.textAlign = "center";
          ctx.shadowColor = feedbackColor; ctx.shadowBlur = 20;
          ctx.fillText(feedbackText, W / 2, H - 42);
          ctx.shadowBlur = 0; ctx.globalAlpha = 1; feedbackTimer--;
        }

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", handleClick); cancelAnimationFrame(rafRef.current); };
    }

    // ══════════════════════════════════════════════
    // ENGINE: PHYSICS  (gravity flip survival)
    // ══════════════════════════════════════════════
    if (engine === "physics") {
      let playerY = H / 2, playerVY = 0, grav = 0.45;
      const PLAYER_X = 60, PLAYER_R = 14;
      const GAP = 130;
      interface Obs { x: number; topH: number; score: boolean; color: string; }
      const obsList: Obs[] = [];
      let obsTimer = 0;
      const OBS_SPEED = 3.2;
      const OBS_COLS = ["#a855f7", "#06b6d4", "#f59e0b", "#10b981"];
      let trail: { x: number; y: number; a: number }[] = [];
      let screenFlash = 0;
      let passCount = 0;

      function handleClick() { grav = -grav; playerVY = 0; playTone(440, 0.06, "sine", 0.15); }
      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleClick(); }, { passive: false });

      function loop() {
        ctx.fillStyle = "#05050f";
        ctx.fillRect(0, 0, W, H);
        // Speed lines BG
        for (let i = 0; i < 8; i++) {
          const lineY2 = (Date.now() * 0.05 + i * 75) % H;
          ctx.strokeStyle = `rgba(168,85,247,0.04)`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(0, lineY2); ctx.lineTo(W, lineY2); ctx.stroke();
        }
        // Neon wall borders
        ctx.fillStyle = "#a855f7"; ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 10;
        ctx.fillRect(0, 0, W, 5); ctx.fillRect(0, H - 5, W, 5); ctx.shadowBlur = 0;

        if (screenFlash > 0) { ctx.fillStyle = "rgba(239,68,68,0.2)"; ctx.fillRect(0, 0, W, H); screenFlash--; }

        // Spawn obstacles
        obsTimer++;
        if (obsTimer > 95) {
          obsTimer = 0;
          const topH = 30 + Math.random() * (H - GAP - 60);
          const col = OBS_COLS[Math.floor(Math.random() * OBS_COLS.length)];
          obsList.push({ x: W, topH, score: false, color: col });
        }

        // Draw obstacles
        for (let i = obsList.length - 1; i >= 0; i--) {
          const o = obsList[i];
          o.x -= OBS_SPEED;
          if (o.x < -40) { obsList.splice(i, 1); continue; }

          // Score when passed
          if (!o.score && o.x + 30 < PLAYER_X) {
            o.score = true; updateScore(cfg.correctHitValue); passCount++;
            if (passCount % 5 === 0) {} // difficulty increase handled by speed
          }

          // Obstacle blocks
          const g1 = ctx.createLinearGradient(o.x, 0, o.x + 30, 0);
          g1.addColorStop(0, o.color + "cc"); g1.addColorStop(1, o.color + "44");
          ctx.fillStyle = g1;
          ctx.fillRect(o.x, 0, 30, o.topH);
          ctx.fillRect(o.x, o.topH + GAP, 30, H - o.topH - GAP);
          ctx.strokeStyle = o.color; ctx.lineWidth = 2;
          ctx.shadowColor = o.color; ctx.shadowBlur = 8;
          ctx.strokeRect(o.x, 0, 30, o.topH);
          ctx.strokeRect(o.x, o.topH + GAP, 30, H - o.topH - GAP);
          ctx.shadowBlur = 0;

          // Collision
          const inX = PLAYER_X + PLAYER_R > o.x && PLAYER_X - PLAYER_R < o.x + 30;
          if (inX && (playerY - PLAYER_R < o.topH || playerY + PLAYER_R > o.topH + GAP)) {
            updateScore(-cfg.wrongHitPenalty * 2); playMiss(); screenFlash = 10;
            obsList.splice(i, 1);
          }
        }

        // Player physics
        playerVY += grav; playerVY = Math.max(-8, Math.min(8, playerVY));
        playerY = Math.max(PLAYER_R + 5, Math.min(H - PLAYER_R - 5, playerY + playerVY));

        // Wall collision
        if (playerY <= PLAYER_R + 6 || playerY >= H - PLAYER_R - 6) { updateScore(-cfg.wrongHitPenalty); playMiss(); screenFlash = 6; grav = -grav; }

        // Trail
        trail.push({ x: PLAYER_X, y: playerY, a: 1 });
        if (trail.length > 20) trail.shift();
        for (let t = 0; t < trail.length; t++) {
          const tr = trail[t];
          ctx.globalAlpha = (t / trail.length) * 0.5;
          ctx.fillStyle = "#f59e0b"; ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 6;
          const r = PLAYER_R * (t / trail.length) * 0.7;
          ctx.beginPath(); ctx.arc(tr.x, tr.y, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;

        // Player orb
        const pg = ctx.createRadialGradient(PLAYER_X, playerY, 0, PLAYER_X, playerY, PLAYER_R);
        pg.addColorStop(0, "#ffffff"); pg.addColorStop(0.5, "#f59e0b"); pg.addColorStop(1, "#d97706");
        ctx.fillStyle = pg; ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(PLAYER_X, playerY, PLAYER_R, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Gravity arrow
        ctx.fillStyle = "rgba(245,158,11,0.6)"; ctx.font = "16px sans-serif"; ctx.textAlign = "left";
        ctx.fillText(grav > 0 ? "▼" : "▲", PLAYER_X - 8, playerY + (grav > 0 ? 30 : -20));

        ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("TAP TO FLIP GRAVITY", W / 2, H / 2);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", handleClick); cancelAnimationFrame(rafRef.current); };
    }

    // ══════════════════════════════════════════════
    // ENGINE: MAGNET  (attract coins, repel bombs)
    // ══════════════════════════════════════════════
    if (engine === "magnet") {
      const CX = W / 2, CY = H * 0.45;
      type Polarity = "attract" | "repel";
      let polarity: Polarity = "attract";
      interface Coin { x: number; y: number; vx: number; vy: number; type: "coin" | "bomb"; collected: boolean; exploding: number; }
      const coins: Coin[] = [];
      let spawnTimer = 0;
      let feedbackTimer = 0, feedbackText = "", feedbackColor = "#fff";
      interface Ptcl { x: number; y: number; vx: number; vy: number; life: number; color: string; }
      const ptcls: Ptcl[] = [];
      // Spawn initial coins
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const dist = 100 + Math.random() * 80;
        coins.push({ x: CX + Math.cos(angle) * dist, y: CY + Math.sin(angle) * dist, vx: (Math.random() - .5) * 1.5, vy: (Math.random() - .5) * 1.5, type: Math.random() > 0.3 ? "coin" : "bomb", collected: false, exploding: 0 });
      }

      function handleClick() {
        polarity = polarity === "attract" ? "repel" : "attract";
        playTone(polarity === "attract" ? 440 : 220, 0.1, "sine", 0.15);
      }
      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleClick(); }, { passive: false });

      function loop() {
        ctx.fillStyle = "#04040e";
        ctx.fillRect(0, 0, W, H);

        // Magnetic field lines
        const fieldColor = polarity === "attract" ? "#3b82f6" : "#f97316";
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const t = (Date.now() * 0.001 + i * 0.5) % 1;
          const dist = t * 160;
          ctx.globalAlpha = (1 - t) * 0.3;
          ctx.strokeStyle = fieldColor; ctx.lineWidth = 1;
          const sa = angle - 0.15, ea = angle + 0.15;
          ctx.beginPath();
          ctx.arc(CX + Math.cos(angle) * dist * 0.3, CY + Math.sin(angle) * dist * 0.3, dist * 0.1, sa, ea);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Magnet base
        const magnetPulse = Math.sin(Date.now() * 0.006) * 0.2 + 0.8;
        const mg = ctx.createRadialGradient(CX, CY, 0, CX, CY, 38);
        mg.addColorStop(0, polarity === "attract" ? "#1d4ed8" : "#c2410c");
        mg.addColorStop(1, polarity === "attract" ? "#1e3a8a" : "#7c2d12");
        ctx.fillStyle = mg; ctx.shadowColor = fieldColor; ctx.shadowBlur = 30 * magnetPulse;
        ctx.beginPath(); ctx.arc(CX, CY, 36, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = fieldColor; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(CX, CY, 36, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff"; ctx.font = "bold 16px Orbitron"; ctx.textAlign = "center";
        ctx.fillText(polarity === "attract" ? "N" : "S", CX, CY + 6);

        // Polarity label
        ctx.fillStyle = fieldColor; ctx.font = "bold 11px Orbitron"; ctx.textAlign = "center";
        ctx.fillText(polarity === "attract" ? "ATTRACTING" : "REPELLING", CX, CY - 52);

        // Spawn
        spawnTimer++;
        if (spawnTimer >= 70 && coins.filter(c => !c.collected).length < 12) {
          spawnTimer = 0;
          const angle = Math.random() * Math.PI * 2;
          const dist = 180 + Math.random() * 60;
          coins.push({ x: CX + Math.cos(angle) * dist, y: CY + Math.sin(angle) * dist, vx: (Math.random() - .5) * 2, vy: (Math.random() - .5) * 2, type: Math.random() > 0.35 ? "coin" : "bomb", collected: false, exploding: 0 });
        }

        // Particles
        for (let i = ptcls.length - 1; i >= 0; i--) {
          const p = ptcls[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy *= 0.9; p.life--;
          if (p.life <= 0) { ptcls.splice(i, 1); continue; }
          ctx.globalAlpha = p.life / 30; ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        }

        // Coins/Bombs
        for (let i = coins.length - 1; i >= 0; i--) {
          const c = coins[i];
          if (c.collected) { coins.splice(i, 1); continue; }
          if (c.exploding > 0) {
            c.exploding -= 0.06;
            if (c.exploding <= 0) { coins.splice(i, 1); continue; }
            ctx.globalAlpha = c.exploding;
            ctx.strokeStyle = c.type === "coin" ? "#f59e0b" : "#ef4444"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(c.x, c.y, 20 * (1 - c.exploding), 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1; continue;
          }

          // Physics: attract/repel
          const dx = CX - c.x, dy = CY - c.y;
          const dist2 = Math.hypot(dx, dy);
          const force = 0.12 / Math.max(dist2, 30) * (polarity === "attract" ? 1 : -1);
          c.vx += dx * force * dist2 * 0.1; c.vy += dy * force * dist2 * 0.1;
          c.vx *= 0.97; c.vy *= 0.97;
          c.x += c.vx; c.y += c.vy;

          // Check collection (reached magnet)
          if (dist2 < 38) {
            c.exploding = 1; c.collected = true;
            if (c.type === "coin") {
              updateScore(cfg.correctHitValue); playHit();
              for (let p = 0; p < 12; p++) ptcls.push({ x: c.x, y: c.y, vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 8, life: 25, color: "#f59e0b" });
              feedbackText = "+COIN"; feedbackColor = "#f59e0b"; feedbackTimer = 20;
            } else {
              updateScore(-cfg.wrongHitPenalty); playMiss();
              for (let p = 0; p < 8; p++) ptcls.push({ x: c.x, y: c.y, vx: (Math.random() - .5) * 10, vy: (Math.random() - .5) * 10, life: 20, color: "#ef4444" });
              feedbackText = "BOMB HIT"; feedbackColor = "#ef4444"; feedbackTimer = 25;
            }
            continue;
          }

          // Keep in bounds
          if (c.x < 10) { c.x = 10; c.vx = Math.abs(c.vx); }
          if (c.x > W - 10) { c.x = W - 10; c.vx = -Math.abs(c.vx); }
          if (c.y < 10) { c.y = 10; c.vy = Math.abs(c.vy); }
          if (c.y > H - 10) { c.y = H - 10; c.vy = -Math.abs(c.vy); }

          // Draw coin/bomb
          const col2 = c.type === "coin" ? "#f59e0b" : "#ef4444";
          const cg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 14);
          cg.addColorStop(0, col2 + "cc"); cg.addColorStop(1, col2 + "22");
          ctx.fillStyle = cg; ctx.shadowColor = col2; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(c.x, c.y, 13, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = col2; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(c.x, c.y, 13, 0, Math.PI * 2); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#fff"; ctx.font = "bold 10px Orbitron"; ctx.textAlign = "center";
          ctx.fillText(c.type === "coin" ? "₿" : "✕", c.x, c.y + 4);
        }

        // Feedback
        if (feedbackTimer > 0) {
          ctx.globalAlpha = feedbackTimer / 30; ctx.fillStyle = feedbackColor;
          ctx.font = "bold 16px Orbitron"; ctx.textAlign = "center"; ctx.fillText(feedbackText, CX, CY - 70);
          ctx.globalAlpha = 1; feedbackTimer--;
        }

        // Tap instruction
        ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.font = "9px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("TAP TO FLIP POLARITY — COLLECT COINS, AVOID BOMBS", W / 2, H - 18);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => { canvas.removeEventListener("click", handleClick); cancelAnimationFrame(rafRef.current); };
    }

    // Fallback: targets engine
    return undefined;
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
    targets: "TARGET STRIKE", heartbeat: "HEARTBEAT", vault: "VAULT CRACKER",
    botslash: "BOT SLASH", meteor: "METEOR CATCH", spinsniper: "SPIN SNIPER",
    simon: "CRYPTO SEQUENCE", physics: "GRAVITY FLIP", magnet: "COIN MAGNET",
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
        {/* Target tick */}
        <div className="absolute top-0 right-0 bottom-0 w-0.5 bg-amber-400" />
      </div>

      {/* Game title strip */}
      <div className="text-center py-1 text-[9px] font-bold tracking-[0.25em] text-purple-500/50 uppercase">
        {game.name} &mdash; {ENGINE_LABELS[engineName] || engineName.toUpperCase()}
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative">
        {gameState === "countdown" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: "rgba(8,8,15,0.85)", backdropFilter: "blur(4px)" }}>
            <div className="text-center">
              <div className="text-xs text-purple-400 tracking-[0.3em] mb-3 uppercase">Get Ready</div>
              <div className="text-9xl font-black text-primary" style={{ textShadow: "0 0 60px rgba(168,85,247,0.9), 0 0 120px rgba(168,85,247,0.4)" }}>
                {countdown}
              </div>
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
