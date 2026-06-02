import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useGetGame, useEndGameSession } from "@workspace/api-client-react";
import { X, Trophy, Zap } from "lucide-react";

type GameState = "countdown" | "playing" | "ended";

interface SessionParams {
  sessionId: string;
  gameId: string;
  tier: string;
}

interface GameConfig {
  targetScore: number;
  timeLimitSeconds: number;
  correctHitValue: number;
  wrongHitPenalty: number;
  prize: number;
  entryPrice: number;
}

export default function Play() {
  const params = useParams<SessionParams>();
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

  // Audio context for sound effects
  const audioCtxRef = useRef<AudioContext | null>(null);

  function playTone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.3) {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur);
    } catch {}
  }

  function playHit() { playTone(440, 0.12, "square", 0.2); }
  function playMiss() { playTone(150, 0.18, "sawtooth", 0.15); }
  function playWin() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.2, "sine", 0.3), i * 100));
  }
  function playLose() {
    [300, 250, 200].forEach((f, i) => setTimeout(() => playTone(f, 0.25, "sawtooth", 0.2), i * 120));
  }

  // Extract config from the session data embedded in URL or game
  useEffect(() => {
    const tier = parseInt(searchParams.get("tier") || "1");
    if (game?.tickets) {
      const ticket = game.tickets.find((t) => t.tier === tier) || game.tickets[0];
      if (ticket) {
        setConfig({
          targetScore: ticket.targetScore,
          timeLimitSeconds: ticket.timeLimitSeconds,
          correctHitValue: ticket.correctHitValue,
          wrongHitPenalty: ticket.wrongHitPenalty,
          prize: ticket.prize,
          entryPrice: ticket.entryPrice,
        });
        setTimeLeft(ticket.timeLimitSeconds);
      }
    }
  }, [game]);

  // Countdown
  useEffect(() => {
    if (!config) return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setGameState("playing");
          return 0;
        }
        return c - 1;
      });
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
      const result = await endSession.mutateAsync({
        sessionId,
        data: { finalScore, won },
      });
      setSessionResult({
        won: result.won,
        prize: result.prizeAwarded,
        finalScore: result.finalScore,
        targetScore: result.targetScore,
      });
    } catch {
      setSessionResult({
        won,
        prize: won ? (config?.prize ?? 0) : 0,
        finalScore,
        targetScore: config?.targetScore ?? 0,
      });
    }
  }

  // Timer
  useEffect(() => {
    if (gameState !== "playing" || !config) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          endGame(scoreRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState, config]);

  // --- GAME ENGINE ---
  useEffect(() => {
    if (gameState !== "playing" || !config || !canvasRef.current || !game) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    const category = game.category;

    // Shared helpers
    function updateScore(delta: number) {
      scoreRef.current = Math.max(0, scoreRef.current + delta);
      setScore(scoreRef.current);
      if (scoreRef.current >= config!.targetScore) {
        endGame(scoreRef.current);
      }
    }

    if (category === "Reflex" || category === "Aim") {
      // --- REFLEX / AIM ENGINE: tap glowing targets ---
      interface Target {
        x: number; y: number; r: number; life: number; maxLife: number;
        color: string; hit: boolean; hitAnim: number;
      }
      const targets: Target[] = [];
      const COLORS = ["#a855f7", "#06b6d4", "#f59e0b", "#10b981", "#f97316"];
      let spawnTimer = 0;
      const SPAWN_INTERVAL = category === "Aim" ? 80 : 55;
      const BASE_LIFE = category === "Aim" ? 90 : 70;

      // Particles
      interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }
      const particles: Particle[] = [];

      function spawnTarget() {
        const r = 22 + Math.random() * 18;
        targets.push({
          x: r + Math.random() * (W - 2 * r),
          y: r + Math.random() * (H - 2 * r - 80),
          r,
          life: BASE_LIFE + Math.random() * 40,
          maxLife: BASE_LIFE + 40,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          hit: false,
          hitAnim: 0,
        });
      }

      function handleClick(e: MouseEvent | TouchEvent) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = W / rect.width;
        const scaleY = H / rect.height;
        let cx: number, cy: number;
        if (e instanceof TouchEvent) {
          cx = (e.touches[0]?.clientX ?? 0 - rect.left) * scaleX;
          cy = (e.touches[0]?.clientY ?? 0 - rect.top) * scaleY;
        } else {
          cx = (e.clientX - rect.left) * scaleX;
          cy = (e.clientY - rect.top) * scaleY;
        }

        let hitAny = false;
        for (const t of targets) {
          if (t.hit) continue;
          const dx = cx - t.x, dy = cy - t.y;
          if (Math.sqrt(dx * dx + dy * dy) < t.r + 6) {
            t.hit = true;
            t.hitAnim = 1;
            hitAny = true;
            for (let i = 0; i < 8; i++) {
              particles.push({
                x: t.x, y: t.y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 30 + Math.random() * 20,
                color: t.color,
              });
            }
            updateScore(config!.correctHitValue);
            playHit();
            break;
          }
        }
        if (!hitAny) {
          updateScore(-config!.wrongHitPenalty);
          playMiss();
          // flash effect
          ctx.fillStyle = "rgba(239,68,68,0.15)";
          ctx.fillRect(0, 0, W, H);
        }
      }

      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleClick(e); }, { passive: false });

      function loop() {
        ctx.fillStyle = "rgba(10,10,20,0.85)";
        ctx.fillRect(0, 0, W, H);

        // Grid lines
        ctx.strokeStyle = "rgba(147,51,234,0.08)";
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        // Particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.life--;
          if (p.life <= 0) { particles.splice(i, 1); continue; }
          ctx.globalAlpha = p.life / 50;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Spawn
        spawnTimer++;
        if (spawnTimer >= SPAWN_INTERVAL && targets.filter(t => !t.hit).length < 5) {
          spawnTarget();
          spawnTimer = 0;
        }

        // Draw targets
        for (let i = targets.length - 1; i >= 0; i--) {
          const t = targets[i];
          if (t.hit) {
            t.hitAnim -= 0.08;
            if (t.hitAnim <= 0) { targets.splice(i, 1); continue; }
            ctx.globalAlpha = t.hitAnim;
            ctx.strokeStyle = t.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.r * (2 - t.hitAnim), 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
            continue;
          }

          t.life--;
          if (t.life <= 0) {
            targets.splice(i, 1);
            updateScore(-config!.wrongHitPenalty);
            continue;
          }

          const alpha = Math.min(1, t.life / 20);
          const pulse = Math.sin(Date.now() * 0.008) * 0.3 + 0.7;

          // Outer ring (timer)
          const progress = t.life / t.maxLife;
          ctx.strokeStyle = t.color;
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          ctx.stroke();

          // Glow
          const gradient = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.r);
          gradient.addColorStop(0, t.color + "cc");
          gradient.addColorStop(1, t.color + "00");
          ctx.globalAlpha = alpha * pulse;
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
          ctx.fill();

          // Circle
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = t.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
          ctx.stroke();

          // Cross hair (aim category)
          if (category === "Aim") {
            ctx.strokeStyle = t.color;
            ctx.lineWidth = 1;
            ctx.globalAlpha = alpha * 0.6;
            ctx.beginPath(); ctx.moveTo(t.x - t.r, t.y); ctx.lineTo(t.x + t.r, t.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(t.x, t.y - t.r); ctx.lineTo(t.x, t.y + t.r); ctx.stroke();
          }

          ctx.globalAlpha = 1;
        }

        rafRef.current = requestAnimationFrame(loop);
      }

      rafRef.current = requestAnimationFrame(loop);
      return () => {
        canvas.removeEventListener("click", handleClick);
        cancelAnimationFrame(rafRef.current);
      };

    } else if (category === "Timing") {
      // --- TIMING ENGINE: moving bar hits target zone ---
      let barX = 0;
      let direction = 1;
      const SPEED = 4 + Math.random() * 2;
      const TARGET_W = 60 + 20 * (1 / (config!.targetScore / 50));
      const TARGET_X = W / 2 - TARGET_W / 2;
      const BAR_Y = H * 0.55;
      let lastClickTime = 0;

      function handleClick() {
        const now = Date.now();
        if (now - lastClickTime < 200) return;
        lastClickTime = now;
        const inZone = barX >= TARGET_X - 10 && barX <= TARGET_X + TARGET_W + 10;
        if (inZone) {
          updateScore(config!.correctHitValue);
          playHit();
        } else {
          updateScore(-config!.wrongHitPenalty);
          playMiss();
        }
      }

      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleClick(); }, { passive: false });

      function loop() {
        ctx.fillStyle = "rgba(10,10,20,0.9)";
        ctx.fillRect(0, 0, W, H);

        // Track
        const trackY = BAR_Y;
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.roundRect(20, trackY - 8, W - 40, 16, 8);
        ctx.fill();

        // Target zone
        const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(245,158,11,${0.25 * pulse})`;
        ctx.fillRect(TARGET_X, trackY - 20, TARGET_W, 40);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.strokeRect(TARGET_X, trackY - 20, TARGET_W, 40);

        // "HIT ZONE" label
        ctx.fillStyle = "#f59e0b";
        ctx.font = "bold 10px Orbitron, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("HIT", TARGET_X + TARGET_W / 2, trackY - 26);

        // Bar (moving)
        barX += direction * SPEED;
        if (barX >= W - 20) direction = -1;
        if (barX <= 20) direction = 1;

        const inZone = barX >= TARGET_X - 5 && barX <= TARGET_X + TARGET_W + 5;
        ctx.fillStyle = inZone ? "#f59e0b" : "#a855f7";
        ctx.shadowColor = inZone ? "#f59e0b" : "#a855f7";
        ctx.shadowBlur = 15;
        ctx.fillRect(barX - 4, trackY - 24, 8, 48);
        ctx.shadowBlur = 0;

        // Instruction
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "12px Orbitron, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("TAP WHEN THE BAR IS IN THE GOLDEN ZONE", W / 2, H * 0.75);

        // Decorative circles
        for (let i = 0; i < 5; i++) {
          const angle = (Date.now() * 0.0008 + i * Math.PI * 0.4) % (Math.PI * 2);
          const cx = W / 2 + Math.cos(angle) * 80;
          const cy = H * 0.25 + Math.sin(angle) * 50;
          ctx.globalAlpha = 0.2;
          ctx.strokeStyle = "#a855f7";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        canvas.removeEventListener("click", handleClick);
        cancelAnimationFrame(rafRef.current);
      };

    } else if (category === "Pattern") {
      // --- PATTERN ENGINE: Simon Says with grid ---
      const GRID_SIZE = 3;
      const CELL = Math.min((W - 80) / GRID_SIZE, 80);
      const OFFSET_X = (W - GRID_SIZE * CELL) / 2;
      const OFFSET_Y = (H - GRID_SIZE * CELL) / 2;

      let sequence: number[] = [];
      let playerSequence: number[] = [];
      let phase: "showing" | "input" = "showing";
      let showIdx = 0;
      let showTimer = 0;
      const highlightCell: { idx: number; alpha: number } | null = null;
      let highlighted: { idx: number; alpha: number } | null = null;
      let inputLocked = false;

      const COLORS_PAT = ["#a855f7", "#06b6d4", "#f59e0b", "#10b981", "#f97316", "#ec4899", "#84cc16", "#14b8a6", "#8b5cf6"];

      function addToSequence() {
        sequence.push(Math.floor(Math.random() * GRID_SIZE * GRID_SIZE));
        playerSequence = [];
        phase = "showing";
        showIdx = 0;
        showTimer = 0;
        inputLocked = true;
      }

      addToSequence();

      function handleClick(e: MouseEvent | TouchEvent) {
        if (phase !== "input" || inputLocked) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = W / rect.width;
        const scaleY = H / rect.height;
        let cx: number, cy: number;
        if (e instanceof TouchEvent) {
          cx = (e.touches[0].clientX - rect.left) * scaleX;
          cy = (e.touches[0].clientY - rect.top) * scaleY;
        } else {
          cx = (e.clientX - rect.left) * scaleX;
          cy = (e.clientY - rect.top) * scaleY;
        }

        const col = Math.floor((cx - OFFSET_X) / CELL);
        const row = Math.floor((cy - OFFSET_Y) / CELL);
        if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return;
        const idx = row * GRID_SIZE + col;

        highlighted = { idx, alpha: 1 };

        if (idx === sequence[playerSequence.length]) {
          playerSequence.push(idx);
          playHit();
          if (playerSequence.length === sequence.length) {
            updateScore(config!.correctHitValue * sequence.length);
            setTimeout(() => addToSequence(), 600);
          }
        } else {
          updateScore(-config!.wrongHitPenalty);
          playMiss();
          playerSequence = [];
          highlighted = { idx, alpha: 1 };
        }
      }

      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleClick(e); }, { passive: false });

      function loop() {
        ctx.fillStyle = "rgba(10,10,20,0.92)";
        ctx.fillRect(0, 0, W, H);

        // Show sequence
        if (phase === "showing") {
          showTimer++;
          if (showTimer === 1) inputLocked = true;
          if (showTimer > 30) { highlighted = { idx: sequence[showIdx], alpha: 1 }; }
          if (showTimer > 50) {
            highlighted = null;
            showIdx++;
            showTimer = 0;
            if (showIdx >= sequence.length) {
              phase = "input";
              inputLocked = false;
            }
          }
        }

        // Fade highlight
        if (highlighted) {
          highlighted.alpha = Math.max(0, highlighted.alpha - 0.04);
          if (highlighted.alpha <= 0) highlighted = null;
        }

        // Draw grid
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const idx = r * GRID_SIZE + c;
            const x = OFFSET_X + c * CELL;
            const y = OFFSET_Y + r * CELL;
            const color = COLORS_PAT[idx % COLORS_PAT.length];
            const isHighlighted = highlighted?.idx === idx;

            ctx.globalAlpha = isHighlighted ? 0.2 + highlighted!.alpha * 0.5 : 0.12;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 10);
            ctx.fill();

            ctx.globalAlpha = isHighlighted ? 0.8 + highlighted!.alpha * 0.2 : 0.4;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 10);
            ctx.stroke();

            ctx.globalAlpha = 1;
          }
        }

        // Phase label
        ctx.fillStyle = phase === "showing" ? "#f59e0b" : "#a855f7";
        ctx.font = "bold 11px Orbitron, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          phase === "showing"
            ? `WATCH: STEP ${showIdx + 1} OF ${sequence.length}`
            : `YOUR TURN: ${playerSequence.length}/${sequence.length}`,
          W / 2,
          OFFSET_Y - 20
        );

        // Sequence indicator dots
        const dotY = OFFSET_Y + GRID_SIZE * CELL + 24;
        for (let i = 0; i < sequence.length; i++) {
          const dotX = W / 2 - (sequence.length - 1) * 8 + i * 16;
          ctx.fillStyle = i < playerSequence.length ? "#10b981" : "rgba(255,255,255,0.2)";
          ctx.beginPath();
          ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
          ctx.fill();
        }

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        canvas.removeEventListener("click", handleClick);
        cancelAnimationFrame(rafRef.current);
      };

    } else {
      // --- PHYSICS ENGINE: gravity flip survival ---
      let playerY = H / 2;
      let playerVY = 0;
      let gravity = 0.5;
      const PLAYER_R = 16;
      interface Obstacle { x: number; topH: number; botH: number; gap: number; }
      const obstacles: Obstacle[] = [];
      let obstacleTimer = 0;
      const OBS_SPEED = 3 + Math.random();
      const GAP_SIZE = 120;
      let survived = 0;

      function handleClick() {
        gravity = -gravity;
        playerVY = gravity * -5;
        playHit();
      }

      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleClick(); }, { passive: false });

      function loop() {
        ctx.fillStyle = "rgba(10,10,20,0.88)";
        ctx.fillRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = "rgba(147,51,234,0.06)";
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

        // Obstacles
        obstacleTimer++;
        if (obstacleTimer > 90) {
          obstacleTimer = 0;
          const topH = 40 + Math.random() * (H - GAP_SIZE - 80);
          obstacles.push({ x: W, topH, botH: H - topH - GAP_SIZE, gap: GAP_SIZE });
        }

        for (let i = obstacles.length - 1; i >= 0; i--) {
          const o = obstacles[i];
          o.x -= OBS_SPEED;

          if (o.x < -30) {
            obstacles.splice(i, 1);
            updateScore(config!.correctHitValue);
            survived++;
            continue;
          }

          // Draw
          const g1 = ctx.createLinearGradient(o.x, 0, o.x + 28, 0);
          g1.addColorStop(0, "#7c3aed");
          g1.addColorStop(1, "#4c1d95");
          ctx.fillStyle = g1;
          ctx.fillRect(o.x, 0, 28, o.topH);
          ctx.fillRect(o.x, H - o.botH, 28, o.botH);

          // Neon edge
          ctx.strokeStyle = "#a855f7";
          ctx.lineWidth = 2;
          ctx.strokeRect(o.x, 0, 28, o.topH);
          ctx.strokeRect(o.x, H - o.botH, 28, o.botH);

          // Collision
          if (
            playerY - PLAYER_R < o.topH && 30 > o.x && 30 < o.x + 28 ||
            playerY + PLAYER_R > H - o.botH && 30 > o.x && 30 < o.x + 28
          ) {
            updateScore(-config!.wrongHitPenalty * 2);
            playMiss();
            obstacles.splice(i, 1);
          }
        }

        // Player physics
        playerVY += gravity;
        playerY = Math.max(PLAYER_R, Math.min(H - PLAYER_R, playerY + playerVY));

        // Player wall bounce
        if (playerY <= PLAYER_R || playerY >= H - PLAYER_R) {
          updateScore(-config!.wrongHitPenalty);
          playMiss();
        }

        // Draw player
        const playerGrad = ctx.createRadialGradient(30, playerY, 0, 30, playerY, PLAYER_R);
        playerGrad.addColorStop(0, "#f59e0b");
        playerGrad.addColorStop(1, "#d97706");
        ctx.fillStyle = playerGrad;
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(30, playerY, PLAYER_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Gravity direction arrow
        ctx.fillStyle = "rgba(245,158,11,0.5)";
        ctx.font = "18px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(gravity > 0 ? "↓" : "↑", 8, playerY + 6);

        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = "10px Orbitron, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("TAP TO FLIP GRAVITY", W / 2, H - 12);

        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        canvas.removeEventListener("click", handleClick);
        cancelAnimationFrame(rafRef.current);
      };
    }
  }, [gameState, config, game]);

  if (!config || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const targetScore = config.targetScore;
  const progressPct = Math.min(100, (score / targetScore) * 100);
  const timeWarning = timeLeft <= 10;

  return (
    <div className="fixed inset-0 bg-[#0a0a14] flex flex-col overflow-hidden">
      {/* HUD */}
      <div className="relative z-10 flex items-center justify-between px-4 py-2 bg-black/40 backdrop-blur border-b border-purple-500/20">
        <button
          onClick={() => {
            if (!gameEndedRef.current) endGame(scoreRef.current);
            navigate("/");
          }}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="flex items-center gap-4">
          {/* Score */}
          <div className="text-center">
            <div className="text-xs text-purple-400 tracking-widest">SCORE</div>
            <div className="text-lg font-black text-foreground tabular-nums">{score}</div>
          </div>

          {/* Target indicator */}
          <div className="text-center">
            <div className="text-xs text-amber-400 tracking-widest">TARGET</div>
            <div className="text-lg font-black text-accent tabular-nums">{targetScore}</div>
          </div>

          {/* Timer */}
          <div className="text-center">
            <div className="text-xs text-purple-400 tracking-widest">TIME</div>
            <div className={`text-lg font-black tabular-nums ${timeWarning ? "text-red-400 animate-pulse" : "text-foreground"}`}>
              {timeLeft}s
            </div>
          </div>
        </div>

        <div className="w-8" />
      </div>

      {/* TARGET LINE progress bar */}
      <div className="relative h-1.5 bg-black/30">
        <div
          className="absolute top-0 left-0 h-full transition-all duration-150"
          style={{
            width: `${progressPct}%`,
            background: progressPct >= 80
              ? "linear-gradient(90deg, #a855f7, #f59e0b)"
              : progressPct >= 50
              ? "linear-gradient(90deg, #7c3aed, #a855f7)"
              : "#4c1d95",
          }}
        />
        {/* TARGET LINE marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-amber-400"
          style={{ left: "100%", transform: "none" }}
          title="Target"
        />
      </div>

      {/* Game name */}
      <div className="text-center py-1 text-xs font-bold tracking-widest text-purple-400/60 uppercase">
        {game.name} — {game.category}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        {gameState === "countdown" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
            <div className="text-center">
              <div className="text-xs text-purple-400 tracking-widest mb-2 uppercase">Get Ready</div>
              <div className="text-8xl font-black text-primary" style={{ textShadow: "0 0 40px rgba(147,51,234,0.8)" }}>
                {countdown}
              </div>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={400}
          height={600}
          className="w-full h-full"
          style={{ cursor: "crosshair", touchAction: "none" }}
        />
      </div>

      {/* Result overlay */}
      {gameState === "ended" && sessionResult && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 rounded-2xl border p-8 text-center space-y-4"
            style={{
              background: sessionResult.won ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
              borderColor: sessionResult.won ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.3)",
            }}
          >
            <div className="text-5xl font-black tracking-wider" style={{
              color: sessionResult.won ? "#10b981" : "#ef4444",
              textShadow: `0 0 30px ${sessionResult.won ? "#10b981" : "#ef4444"}80`,
            }}>
              {sessionResult.won ? "VICTORY" : "DEFEAT"}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Final Score</span>
                <span className="font-bold text-foreground">{sessionResult.finalScore}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Target</span>
                <span className="font-bold text-foreground">{sessionResult.targetScore}</span>
              </div>
              {sessionResult.won && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-400">Prize Earned</span>
                  <span className="font-black text-accent skz-glow">+{sessionResult.prize.toFixed(2)} SKZ</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => navigate("/")}
                className="flex-1 py-3 rounded-xl font-bold text-sm tracking-wider bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                Lobby
              </button>
              <button
                onClick={() => navigate(`/game/${game.id}`)}
                className="flex-1 py-3 rounded-xl font-black text-sm tracking-wider bg-primary text-primary-foreground purple-glow"
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
