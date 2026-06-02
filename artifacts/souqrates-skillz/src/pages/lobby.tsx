import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useListGames } from "@workspace/api-client-react";
import { History, ChevronRight, Star, Clock, Atom, Zap, Brain, Cpu } from "lucide-react";

const CATEGORIES = ["All", "Timing", "Physics", "Swipe", "Memory", "Strategy"];

const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string; glow: string; desc: string }> = {
  All:      { icon: <Star className="w-3.5 h-3.5" />,    color: "#a855f7", glow: "rgba(168,85,247,0.25)",  desc: "All 50 Games" },
  Timing:   { icon: <Clock className="w-3.5 h-3.5" />,   color: "#f59e0b", glow: "rgba(245,158,11,0.25)",  desc: "Reflex & Rhythm" },
  Physics:  { icon: <Atom className="w-3.5 h-3.5" />,    color: "#ec4899", glow: "rgba(236,72,153,0.25)",  desc: "Balance & Force" },
  Swipe:    { icon: <Zap className="w-3.5 h-3.5" />,     color: "#f97316", glow: "rgba(249,115,22,0.25)",  desc: "Slash & Draw" },
  Memory:   { icon: <Brain className="w-3.5 h-3.5" />,   color: "#10b981", glow: "rgba(16,185,129,0.25)",  desc: "Memory & Focus" },
  Strategy: { icon: <Cpu className="w-3.5 h-3.5" />,     color: "#06b6d4", glow: "rgba(6,182,212,0.25)",   desc: "Logic & Skill" },
};

const DIFFICULTY_META: Record<string, { color: string; bars: number }> = {
  Easy:   { color: "#10b981", bars: 1 },
  Medium: { color: "#f59e0b", bars: 2 },
  Hard:   { color: "#ef4444", bars: 3 },
};

const ENGINE_LABELS: Record<string, string> = {
  Timing:   "TIMING ENGINE",
  Physics:  "PHYSICS ENGINE",
  Swipe:    "SWIPE ENGINE",
  Memory:   "MEMORY ENGINE",
  Strategy: "STRATEGY ENGINE",
};

function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.3 + Math.random() * 1.3, twinkle: Math.random() * Math.PI * 2, speed: 0.01 + Math.random() * 0.03,
    }));
    let raf: number;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        s.twinkle += s.speed;
        ctx.globalAlpha = 0.15 + Math.sin(s.twinkle) * 0.12;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

export default function Lobby() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [, navigate] = useLocation();
  const { data: games = [], isLoading } = useListGames(
    activeCategory !== "All" ? { category: activeCategory } : {}
  );

  return (
    <div className="min-h-screen bg-[#06060f] relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <StarField />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(168,85,247,0.08) 0%, transparent 70%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 40% 30% at 80% 80%, rgba(6,182,212,0.05) 0%, transparent 60%)" }} />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/5" style={{ background: "rgba(6,6,15,0.92)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-screen-md mx-auto px-4 pt-4 pb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-purple-500/60 uppercase mb-0.5">Souqrates</div>
            <div className="text-2xl font-black tracking-[0.15em] leading-none" style={{ background: "linear-gradient(90deg, #a855f7, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              SKILLZ
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">50 GAMES &bull; WIN SKZ PRIZES</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/leaderboard")} className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5 border border-white/5">
              <Star className="w-3 h-3" />
              Board
            </button>
            <button onClick={() => navigate("/history")} className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5 border border-white/5">
              <History className="w-3 h-3" />
              History
            </button>
          </div>
        </div>

        {/* Category pills */}
        <div className="max-w-screen-md mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat];
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all duration-200 border"
                  style={active ? {
                    color: meta.color,
                    backgroundColor: `${meta.color}18`,
                    borderColor: `${meta.color}50`,
                    boxShadow: `0 0 14px ${meta.glow}`,
                  } : {
                    color: "rgba(255,255,255,0.35)",
                    backgroundColor: "rgba(255,255,255,0.03)",
                    borderColor: "rgba(255,255,255,0.07)",
                  }}
                >
                  <span style={active ? { color: meta.color } : { color: "rgba(255,255,255,0.3)" }}>{meta.icon}</span>
                  {cat}
                </button>
              );
            })}
          </div>
          {activeCategory !== "All" && (
            <div className="text-[10px] mt-1.5 pl-1" style={{ color: CATEGORY_META[activeCategory].color + "80" }}>
              {CATEGORY_META[activeCategory].desc}
            </div>
          )}
        </div>
      </div>

      {/* Games grid */}
      <div className="relative z-10 max-w-screen-md mx-auto px-4 py-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {games.map((game) => {
              const meta = CATEGORY_META[game.category] || CATEGORY_META["All"];
              const diff = DIFFICULTY_META[game.difficultyLabel || "Medium"] || DIFFICULTY_META["Medium"];
              const engineLabel = ENGINE_LABELS[game.category] || game.category.toUpperCase();
              const isNew = game.totalPlays < 50;

              return (
                <button
                  key={game.id}
                  onClick={() => navigate(`/game/${game.id}`)}
                  className="group relative rounded-2xl text-left overflow-hidden transition-all duration-200 active:scale-95"
                  style={{ background: "rgba(10,10,22,0.97)", border: `1px solid rgba(255,255,255,0.06)` }}
                >
                  {/* Top color bar */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />

                  {/* Visual preview */}
                  <div className="relative flex items-center justify-center py-6 overflow-hidden" style={{ background: `linear-gradient(135deg, ${meta.color}0c 0%, transparent 65%)` }}>
                    <div className="absolute" style={{ width: 84, height: 84, borderRadius: "50%", border: `1px solid ${meta.color}18` }} />
                    <div className="absolute" style={{ width: 58, height: 58, borderRadius: "50%", border: `1px solid ${meta.color}12` }} />
                    <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full" style={{ background: `${meta.color}18`, border: `2px solid ${meta.color}40`, boxShadow: `0 0 20px ${meta.color}28` }}>
                      <div style={{ color: meta.color, transform: "scale(1.5)" }}>{meta.icon}</div>
                    </div>
                    <div className="absolute bottom-1.5 left-3 right-3 text-center">
                      <span className="text-[7.5px] font-bold tracking-widest" style={{ color: meta.color + "65" }}>{engineLabel}</span>
                    </div>
                    {isNew && (
                      <div className="absolute top-2 right-2 text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: meta.color, color: "#fff" }}>NEW</div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="px-3 pb-3">
                    <div className="text-[11px] font-black text-foreground tracking-wide leading-tight mb-1.5 line-clamp-1">
                      {game.name.toUpperCase()}
                    </div>
                    <div className="text-[9px] text-muted-foreground leading-relaxed line-clamp-2 mb-2.5" style={{ minHeight: "2.4em" }}>
                      {game.description}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3].map((bar) => (
                          <div key={bar} className="w-3 h-1.5 rounded-sm" style={{
                            background: bar <= diff.bars ? diff.color : "rgba(255,255,255,0.08)",
                            boxShadow: bar <= diff.bars ? `0 0 4px ${diff.color}60` : "none",
                          }} />
                        ))}
                        <span className="text-[8px] ml-1" style={{ color: diff.color + "80" }}>{game.difficultyLabel}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground/50">
                        <span>{game.totalPlays.toLocaleString()}</span>
                        <ChevronRight className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: meta.color }} />
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ boxShadow: `inset 0 0 30px ${meta.color}0c, 0 0 20px ${meta.color}12` }} />
                </button>
              );
            })}
          </div>
        )}

        {!isLoading && games.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <div className="text-sm">No games in this category.</div>
          </div>
        )}
        <div className="h-8" />
      </div>
    </div>
  );
}
