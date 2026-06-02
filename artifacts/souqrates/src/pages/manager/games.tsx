import { useState } from "react";
import { useListGames, useGetGame, useUpdateGame, useUpdateGameTicket, useGetGamesStats } from "@workspace/api-client-react";
import { ChevronDown, ChevronRight, ToggleLeft, ToggleRight, Edit3, Save, X, Trophy, Zap, Clock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: "text-emerald-400",
  Medium: "text-yellow-400",
  Hard: "text-red-400",
};

const TIER_NAMES: Record<number, string> = { 1: "Bronze", 2: "Silver", 3: "Gold", 4: "Platinum", 5: "Diamond" };

export default function GamesAdmin() {
  const qc = useQueryClient();
  const [expandedGame, setExpandedGame] = useState<number | null>(null);
  const [editingTicket, setEditingTicket] = useState<{ gameId: number; tier: number } | null>(null);
  const [ticketEdits, setTicketEdits] = useState<Record<string, string | number | boolean>>({});
  const [filter, setFilter] = useState("");

  const { data: stats } = useGetGamesStats();
  const { data: games = [], isLoading } = useListGames({});
  const { data: expandedGameData } = useGetGame(expandedGame ?? 0);

  const updateGame = useUpdateGame();
  const updateTicket = useUpdateGameTicket();

  const filtered = games.filter(
    (g) =>
      g.name.toLowerCase().includes(filter.toLowerCase()) ||
      g.category.toLowerCase().includes(filter.toLowerCase())
  );

  async function toggleActive(gameId: number, current: boolean) {
    await updateGame.mutateAsync({ gameId, data: { isActive: !current } });
    qc.invalidateQueries({ queryKey: ["/api/games"] });
  }

  async function saveTicket(gameId: number, tier: number) {
    await updateTicket.mutateAsync({
      gameId,
      data: {
        tier,
        ...(ticketEdits.entryPrice !== undefined && { entryPrice: Number(ticketEdits.entryPrice) }),
        ...(ticketEdits.prize !== undefined && { prize: Number(ticketEdits.prize) }),
        ...(ticketEdits.targetScore !== undefined && { targetScore: Number(ticketEdits.targetScore) }),
        ...(ticketEdits.timeLimitSeconds !== undefined && { timeLimitSeconds: Number(ticketEdits.timeLimitSeconds) }),
        ...(ticketEdits.correctHitValue !== undefined && { correctHitValue: Number(ticketEdits.correctHitValue) }),
        ...(ticketEdits.wrongHitPenalty !== undefined && { wrongHitPenalty: Number(ticketEdits.wrongHitPenalty) }),
      },
    });
    qc.invalidateQueries({ queryKey: [`/api/games/${gameId}`] });
    setEditingTicket(null);
    setTicketEdits({});
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Games", value: stats.totalGames, icon: Zap },
            { label: "Active Games", value: stats.activeGames, icon: ToggleRight },
            { label: "Total Sessions", value: stats.totalSessions.toLocaleString(), icon: Trophy },
            { label: "Prizes Awarded", value: `${stats.totalPrizesAwarded.toFixed(0)} SKZ`, icon: Clock },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card border border-border/60 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Icon className="w-3 h-3" />
                {label}
              </div>
              <div className="text-lg font-black text-foreground font-orbitron">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <input
        type="search"
        placeholder="Search games..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full px-4 py-2 rounded-lg bg-card border border-border/60 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
      />

      {/* Games list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((game) => {
            const isExpanded = expandedGame === game.id;
            return (
              <div key={game.id} className="rounded-lg border border-border/60 overflow-hidden">
                {/* Game row */}
                <div className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
                  <button
                    onClick={() => setExpandedGame(isExpanded ? null : game.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground font-orbitron">{game.name}</span>
                      <span className="text-xs text-muted-foreground">#{game.id}</span>
                      {game.difficultyLabel && (
                        <span className={`text-xs font-semibold ${DIFFICULTY_COLORS[game.difficultyLabel] || ""}`}>
                          {game.difficultyLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{game.category} · {game.totalPlays} plays</div>
                  </div>

                  <button
                    onClick={() => toggleActive(game.id, game.isActive)}
                    className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded transition-colors ${
                      game.isActive ? "text-emerald-400 hover:text-red-400" : "text-red-400 hover:text-emerald-400"
                    }`}
                  >
                    {game.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    {game.isActive ? "Active" : "Inactive"}
                  </button>
                </div>

                {/* Expanded ticket editor */}
                {isExpanded && expandedGameData && expandedGameData.id === game.id && (
                  <div className="border-t border-border/40 bg-background/50 p-4 space-y-2">
                    <div className="text-xs font-bold text-muted-foreground tracking-widest uppercase mb-3">
                      Ticket Tiers
                    </div>
                    {expandedGameData.tickets?.map((ticket) => {
                      const isEditing = editingTicket?.gameId === game.id && editingTicket.tier === ticket.tier;
                      return (
                        <div key={ticket.tier} className="rounded-lg border border-border/40 p-3 bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-primary font-orbitron">
                                {TIER_NAMES[ticket.tier] || `Tier ${ticket.tier}`}
                              </span>
                              <span className={`text-xs ${ticket.isActive ? "text-emerald-400" : "text-red-400"}`}>
                                {ticket.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                            {!isEditing ? (
                              <button
                                onClick={() => {
                                  setEditingTicket({ gameId: game.id, tier: ticket.tier });
                                  setTicketEdits({
                                    entryPrice: ticket.entryPrice,
                                    prize: ticket.prize,
                                    targetScore: ticket.targetScore,
                                    timeLimitSeconds: ticket.timeLimitSeconds,
                                    correctHitValue: ticket.correctHitValue,
                                    wrongHitPenalty: ticket.wrongHitPenalty,
                                  });
                                }}
                                className="text-muted-foreground hover:text-primary text-xs flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveTicket(game.id, ticket.tier)}
                                  className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1"
                                >
                                  <Save className="w-3 h-3" /> Save
                                </button>
                                <button
                                  onClick={() => { setEditingTicket(null); setTicketEdits({}); }}
                                  className="text-muted-foreground hover:text-red-400 text-xs"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {!isEditing ? (
                            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                              <div>Entry: <span className="text-accent font-bold">{ticket.entryPrice.toFixed(0)} SKZ</span></div>
                              <div>Prize: <span className="text-accent font-bold">{ticket.prize.toFixed(0)} SKZ</span></div>
                              <div>Target: <span className="text-foreground">{ticket.targetScore}</span></div>
                              <div>Time: <span className="text-foreground">{ticket.timeLimitSeconds}s</span></div>
                              <div>Hit +{ticket.correctHitValue}</div>
                              <div>Miss -{ticket.wrongHitPenalty}</div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { key: "entryPrice", label: "Entry Price (SKZ)" },
                                { key: "prize", label: "Prize (SKZ)" },
                                { key: "targetScore", label: "Target Score" },
                                { key: "timeLimitSeconds", label: "Time Limit (s)" },
                                { key: "correctHitValue", label: "Hit Value" },
                                { key: "wrongHitPenalty", label: "Miss Penalty" },
                              ].map(({ key, label }) => (
                                <div key={key}>
                                  <label className="text-xs text-muted-foreground block mb-1">{label}</label>
                                  <input
                                    type="number"
                                    value={String(ticketEdits[key] ?? "")}
                                    onChange={(e) =>
                                      setTicketEdits((prev) => ({ ...prev, [key]: e.target.value }))
                                    }
                                    className="w-full px-2 py-1 rounded bg-muted border border-border/60 text-foreground text-xs focus:outline-none focus:border-primary"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm">No games found.</div>
      )}
    </div>
  );
}
