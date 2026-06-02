import { useState } from "react";
import { useLocation } from "wouter";
import { useListGames } from "@workspace/api-client-react";
import { Clock, Trophy, Zap, Target, Music, Brain, Atom, History, ChevronRight } from "lucide-react";

const CATEGORIES = ["All", "Reflex", "Aim", "Timing", "Pattern", "Physics"];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  All: <Zap className="w-4 h-4" />,
  Reflex: <Zap className="w-4 h-4" />,
  Aim: <Target className="w-4 h-4" />,
  Timing: <Music className="w-4 h-4" />,
  Pattern: <Brain className="w-4 h-4" />,
  Physics: <Atom className="w-4 h-4" />,
};

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: "text-emerald-400",
  Medium: "text-yellow-400",
  Hard: "text-red-400",
};

const CATEGORY_ACCENT: Record<string, string> = {
  Reflex: "#a855f7",
  Aim: "#06b6d4",
  Timing: "#f59e0b",
  Pattern: "#10b981",
  Physics: "#f97316",
};

export default function Lobby() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [, navigate] = useLocation();

  const { data: games = [], isLoading } = useListGames(
    activeCategory !== "All" ? { category: activeCategory } : {}
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="max-w-screen-md mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground tracking-widest uppercase">Souqrates</div>
            <div className="text-lg font-black text-primary tracking-wider">SKILLZ</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/history")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
            >
              <History className="w-3.5 h-3.5" />
              History
            </button>
          </div>
        </div>

        {/* Category filters */}
        <div className="max-w-screen-md mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {CATEGORY_ICONS[cat]}
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Games grid */}
      <div className="max-w-screen-md mx-auto px-4 py-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {games.map((game) => {
              const accent = CATEGORY_ACCENT[game.category] || "#a855f7";
              return (
                <button
                  key={game.id}
                  onClick={() => navigate(`/game/${game.id}`)}
                  className="game-card relative rounded-xl p-4 text-left bg-card border border-border/60 overflow-hidden"
                  style={{ "--accent-color": accent } as React.CSSProperties}
                >
                  {/* Glow accent top */}
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
                    style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
                  />

                  {/* Category badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ color: accent, backgroundColor: `${accent}20` }}
                    >
                      {game.category}
                    </span>
                    {game.difficultyLabel && (
                      <span className={`text-xs font-semibold ${DIFFICULTY_COLORS[game.difficultyLabel] || "text-muted-foreground"}`}>
                        {game.difficultyLabel}
                      </span>
                    )}
                  </div>

                  {/* Game name */}
                  <div className="text-sm font-black leading-tight text-foreground mb-1 tracking-wide">
                    {game.name.toUpperCase()}
                  </div>

                  {/* Description */}
                  <div className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                    {game.description}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Trophy className="w-3 h-3" />
                      <span>{game.totalPlays.toLocaleString()}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!isLoading && games.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <div className="text-sm">No games found in this category.</div>
          </div>
        )}
      </div>
    </div>
  );
}
