import { useLocation } from "wouter";
import { useGetSessionHistory } from "@workspace/api-client-react";
import { ArrowLeft, Trophy, Clock, Zap } from "lucide-react";
import { getTelegramId } from "@/lib/user";

export default function History() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useGetSessionHistory({
    telegram_id: getTelegramId(),
    page: 1,
    limit: 50,
  });

  const sessions = data?.sessions ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="max-w-screen-md mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-base font-black tracking-wider">PLAY HISTORY</div>
        </div>
      </div>

      <div className="max-w-screen-md mx-auto px-4 py-4 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <div className="text-sm">No sessions yet. Start playing!</div>
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl p-4 border ${
                s.status === "won"
                  ? "bg-card border-emerald-500/30"
                  : s.status === "lost"
                  ? "bg-card border-red-500/20"
                  : "bg-card border-border/60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      s.status === "won"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : s.status === "lost"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.status.toUpperCase()}
                  </div>
                  <span className="text-xs text-muted-foreground">Session #{s.id}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.startedAt).toLocaleDateString()}
                </span>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Zap className="w-3 h-3 text-primary" />
                  <span>Score: <span className="text-foreground font-semibold">{s.score}</span></span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Trophy className="w-3 h-3 text-primary" />
                  <span>Target: <span className="text-foreground font-semibold">{s.targetScore}</span></span>
                </div>
                {s.status === "won" && (
                  <div className="flex items-center gap-1 text-xs text-accent font-bold skz-glow">
                    +{s.prize.toFixed(0)} SKZ
                  </div>
                )}
                {s.status === "lost" && (
                  <div className="flex items-center gap-1 text-xs text-red-400">
                    -{s.entryPrice.toFixed(0)} SKZ
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
