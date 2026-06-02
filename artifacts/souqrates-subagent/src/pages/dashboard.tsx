import { useState } from "react";
import { Shield, Send, History, Loader2, CheckCircle, AlertCircle, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TELEGRAM_ID } from "@/App";

type SubagentStatus = {
  application: { fullName: string; status: string };
  skzBalance: number;
};

type Transfer = {
  id: number;
  type: string;
  amount: number;
  status: string;
  note?: string;
  createdAt: string;
};

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: statusData } = useQuery<SubagentStatus>({
    queryKey: ["subagent-me", TELEGRAM_ID],
    queryFn: async () => {
      const res = await fetch(`/api/subagent/me?telegram_id=${TELEGRAM_ID}`);
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: transfers } = useQuery<Transfer[]>({
    queryKey: ["subagent-transfers", TELEGRAM_ID],
    queryFn: async () => {
      const res = await fetch(`/api/subagent/transfers?telegram_id=${TELEGRAM_ID}`);
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const transferMutation = useMutation({
    mutationFn: async (data: { toTelegramId: string; amount: number; note: string }) => {
      const res = await fetch("/api/subagent/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromTelegramId: TELEGRAM_ID,
          toTelegramId: data.toTelegramId,
          amount: data.amount,
          note: data.note,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Transfer failed");
      }
      return res.json();
    },
    onSuccess: (tx) => {
      setSuccessMsg(`Sent ${tx.amount} SKZ successfully`);
      setToId("");
      setAmount("");
      setNote("");
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ["subagent-me"] });
      queryClient.invalidateQueries({ queryKey: ["subagent-transfers"] });
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
    },
  });

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    const amt = parseFloat(amount);
    if (!toId.trim()) { setErrorMsg("Enter recipient Telegram ID"); return; }
    if (isNaN(amt) || amt <= 0) { setErrorMsg("Enter a valid amount"); return; }
    transferMutation.mutate({ toTelegramId: toId.trim(), amount: amt, note });
  }

  const balance = statusData?.skzBalance ?? 0;
  const inputClass = "w-full bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground font-orbitron focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-5 animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-orbitron font-bold text-foreground">SUBAGENT PANEL</h1>
            <p className="text-[10px] text-primary font-orbitron tracking-widest uppercase">Approved Partner</p>
          </div>
        </div>

        {/* Balance */}
        <div className="bg-card border border-border rounded-xl p-5 text-center animate-pulse-glow">
          <p className="text-xs font-orbitron text-muted-foreground uppercase tracking-widest mb-1">Available Balance</p>
          <p className="text-4xl font-orbitron font-black text-yellow-400 tracking-wider">
            {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground font-orbitron mt-1">SKZ</p>
        </div>

        {/* Partner Info */}
        {statusData?.application && (
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
            <User className="h-4 w-4 text-primary flex-shrink-0" />
            <div>
              <p className="text-xs font-orbitron text-muted-foreground">Logged in as</p>
              <p className="text-sm font-orbitron font-bold text-foreground">{statusData.application.fullName}</p>
            </div>
            <div className="ml-auto">
              <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 rounded-full px-2 py-0.5 font-orbitron uppercase tracking-wider">
                Active
              </span>
            </div>
          </div>
        )}

        {/* Send SKZ */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Send className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-orbitron font-bold text-foreground tracking-wider uppercase">Send SKZ</h2>
          </div>

          {successMsg && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 mb-4">
              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
              <p className="text-xs text-green-400 font-orbitron">{successMsg}</p>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-4">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-xs text-destructive font-orbitron">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleSend} className="space-y-3">
            <div>
              <label className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest mb-1.5 block">
                Recipient Telegram ID
              </label>
              <input
                className={inputClass}
                placeholder="e.g. demo_user_001"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest mb-1.5 block">
                Amount (SKZ)
              </label>
              <input
                className={inputClass}
                type="number"
                min="1"
                step="0.000001"
                placeholder="0.000000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest mb-1.5 block">
                Note (optional)
              </label>
              <input
                className={inputClass}
                placeholder="Transfer note or reference"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={transferMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary text-primary-foreground font-orbitron font-bold tracking-wider text-sm hover:opacity-90 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {transferMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4" /> Send SKZ</>
              )}
            </button>
          </form>
        </div>

        {/* Transfer History */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-orbitron font-bold text-foreground tracking-wider uppercase">Transfer History</h2>
          </div>

          {!transfers || transfers.length === 0 ? (
            <p className="text-xs text-muted-foreground font-orbitron text-center py-6">No transfers yet</p>
          ) : (
            <div className="space-y-2">
              {transfers.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div>
                    <p className="text-xs font-orbitron text-foreground">
                      {tx.note || "SKZ Transfer"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-orbitron font-bold text-red-400">
                      -{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} SKZ
                    </p>
                    <span className="text-[10px] bg-green-500/10 text-green-400 rounded px-1.5 font-orbitron">
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
