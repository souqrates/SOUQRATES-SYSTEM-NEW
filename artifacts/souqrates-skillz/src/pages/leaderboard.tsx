import { useLocation, useParams } from "wouter";
import { useFetchLeaderboard, useGetGame } from "@workspace/api-client-react";
import { ArrowLeft, Trophy, Crown } from "lucide-react";

export default function LeaderboardPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = parseInt(params.gameId || "0");
  const [, navigate] = useLocation();

  const { data: entries = [], isLoading } = useFetchLeaderboard({ game_id: gameId, limit: 20 });
  const { data: game } = useGetGame(gameId);

  const rankColors = ["text-yellow-400", "text-gray-300", "text-amber-600"];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="max-w-screen-md mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-xs text-muted-foreground tracking-widest">
              {game?.name ?? `Game #${gameId}`}
            </div>
            <div className="text-base font-black tracking-wider">LEADERBOARD</div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-md mx-auto px-4 py-4 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <div className="text-sm">No scores yet. Be the first to play!</div>
          </div>
        ) : (
          entries.map((entry, i) => (
            <div
              key={entry.userId}
              className={`rounded-xl p-4 border flex items-center gap-4 ${
                i === 0 ? "bg-yellow-400/5 border-yellow-400/30" : "bg-card border-border/60"
              }`}
            >
              <div className={`text-xl font-black w-8 text-center ${rankColors[i] || "text-muted-foreground"}`}>
                {i < 3 ? <Crown className="w-5 h-5 mx-auto" /> : `#${entry.rank}`}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground truncate">
                  {entry.firstName || entry.username || `Player ${entry.userId}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {entry.totalWins} win{entry.totalWins !== 1 ? "s" : ""}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-black text-primary">{entry.bestScore.toLocaleString()}</div>
                <div className="text-xs text-accent font-semibold">
                  +{(entry.totalPrizeEarned ?? 0).toFixed(0)} SKZ
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
