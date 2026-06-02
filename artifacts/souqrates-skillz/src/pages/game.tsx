import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useGetGame, useStartGameSession } from "@workspace/api-client-react";
import { ArrowLeft, Clock, Zap, Trophy, Target, AlertCircle, ChevronRight } from "lucide-react";
import { getTelegramId } from "@/lib/user";

const TIER_COLORS = ["", "#cd7f32", "#c0c0c0", "#ffd700", "#e5e4e2", "#b9f2ff"];
const TIER_NAMES = ["", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];

export default function GameDetail() {
  const params = useParams<{ id: string }>();
  const gameId = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: game, isLoading } = useGetGame(gameId);
  const startSession = useStartGameSession();

  const selectedTicket = game?.tickets?.find((t) => t.tier === selectedTier);

  async function handlePlay() {
    if (!selectedTicket || !game) return;
    setError(null);
    try {
      const session = await startSession.mutateAsync({
        data: {
          telegramId: getTelegramId(),
          gameId: game.id,
          ticketId: selectedTicket.id,
        },
      });
      navigate(`/play/${session.id}?gameId=${game.id}&tier=${selectedTier}`);
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Failed to start session";
      setError(msg);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Game not found.
      </div>
    );
  }

  const activeTickets = game.tickets?.filter((t) => t.isActive) ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="max-w-screen-md mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-xs text-muted-foreground tracking-widest">{game.category}</div>
            <div className="text-base font-black tracking-wider">{game.name.toUpperCase()}</div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-md mx-auto px-4 py-6 space-y-6">
        {/* Game info */}
        <div className="rounded-xl bg-card border border-border/60 p-5 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />

          <p className="text-sm text-muted-foreground leading-relaxed">{game.description}</p>

          <div className="flex flex-wrap gap-4 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Trophy className="w-3.5 h-3.5 text-accent" />
              <span>{game.totalPlays.toLocaleString()} plays</span>
            </div>
            {game.difficultyLabel && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span>{game.difficultyLabel} difficulty</span>
              </div>
            )}
          </div>

          {/* How to win */}
          <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/40">
            <div className="text-xs font-bold text-primary mb-1 tracking-wider">HOW TO WIN</div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              Reach the <span className="text-foreground font-semibold">TARGET LINE</span> score
              before time runs out. Each correct hit scores points. Misses cost you points.
              Your final score must meet or exceed the target to win the prize.
            </div>
          </div>
        </div>

        {/* Ticket selection */}
        <div>
          <div className="text-xs font-bold text-muted-foreground tracking-widest uppercase mb-3">
            Select Ticket Tier
          </div>
          <div className="space-y-2">
            {activeTickets.map((ticket) => {
              const isSelected = selectedTier === ticket.tier;
              const tierColor = TIER_COLORS[ticket.tier] || "#a855f7";
              return (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTier(ticket.tier)}
                  className={`w-full rounded-xl p-4 border transition-all text-left ${
                    isSelected
                      ? "border-primary bg-primary/10 purple-glow"
                      : "border-border/60 bg-card hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Tier indicator */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                        style={{ backgroundColor: `${tierColor}25`, color: tierColor, border: `2px solid ${tierColor}60` }}
                      >
                        {ticket.tier}
                      </div>
                      <div>
                        <div className="text-sm font-black tracking-wider" style={{ color: tierColor }}>
                          {TIER_NAMES[ticket.tier] || ticket.name.toUpperCase()}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Entry: <span className="text-accent font-bold">{ticket.entryPrice.toFixed(0)} SKZ</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-accent skz-glow">
                        {ticket.prize.toFixed(0)} SKZ
                      </div>
                      <div className="text-xs text-muted-foreground">prize</div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex gap-4 mt-3 pt-3 border-t border-border/40">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Target className="w-3 h-3 text-primary" />
                      <span>Target: <span className="text-foreground">{ticket.targetScore}</span></span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 text-primary" />
                      <span>{ticket.timeLimitSeconds}s</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Zap className="w-3 h-3 text-accent" />
                      <span>+{ticket.correctHitValue} / -{ticket.wrongHitPenalty}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Play button */}
        <button
          onClick={handlePlay}
          disabled={!selectedTicket || startSession.isPending}
          className="w-full py-4 rounded-xl font-black text-base tracking-widest uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed
            bg-primary text-primary-foreground hover:opacity-90 purple-glow flex items-center justify-center gap-2"
        >
          {startSession.isPending ? (
            <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <>
              {selectedTicket ? `Pay ${selectedTicket.entryPrice.toFixed(0)} SKZ & Play` : "Select a Ticket"}
              {selectedTicket && <ChevronRight className="w-5 h-5" />}
            </>
          )}
        </button>

        {/* Leaderboard link */}
        <button
          onClick={() => navigate(`/leaderboard/${game.id}`)}
          className="w-full py-3 rounded-xl font-semibold text-sm tracking-wider text-muted-foreground border border-border/60 hover:border-primary/40 hover:text-foreground transition-all"
        >
          View Leaderboard
        </button>
      </div>
    </div>
  );
}
