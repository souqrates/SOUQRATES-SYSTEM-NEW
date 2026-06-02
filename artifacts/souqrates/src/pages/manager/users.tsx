import { useListUsers, useBanUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Search, Ban, CheckCircle, Send, Minus, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";

type User = {
  id: number;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  skzBalance: number;
  totalEarned: number;
  isBanned: boolean;
  referralCode: string;
};

function UserRow({ user, search }: { user: User; search: string }) {
  const [expanded, setExpanded] = useState(false);
  const [sendAmt, setSendAmt] = useState("");
  const [sendNote, setSendNote] = useState("");
  const [deductAmt, setDeductAmt] = useState("");
  const [deductNote, setDeductNote] = useState("");
  const [localBalance, setLocalBalance] = useState<number | null>(null);

  const { toast } = useToast();
  const qc = useQueryClient();
  const banUser = useBanUser();

  const balance = localBalance !== null ? localBalance : user.skzBalance;

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListUsersQueryKey({ search, limit: 50 }) });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${user.id}/send-skz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(sendAmt), note: sendNote }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: (data) => {
      setLocalBalance(data.newBalance);
      setSendAmt(""); setSendNote("");
      toast({ title: "SKZ Sent", description: `Balance updated to ${data.newBalance.toFixed(2)} SKZ` });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deductMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${user.id}/deduct-skz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(deductAmt), note: deductNote }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: (data) => {
      setLocalBalance(data.newBalance);
      setDeductAmt(""); setDeductNote("");
      toast({ title: "SKZ Deducted", description: `Balance updated to ${data.newBalance.toFixed(2)} SKZ` });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleBan = () => {
    banUser.mutate(
      { userId: user.id, data: { banned: !user.isBanned, reason: "Admin action" } },
      {
        onSuccess: () => {
          toast({ title: user.isBanned ? "User Unbanned" : "User Banned" });
          invalidate();
        },
        onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const inputClass = "flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground font-orbitron focus:outline-none focus:border-primary/60 transition-colors";

  return (
    <>
      <tr
        className={`border-b border-border transition-colors hover:bg-accent/20 cursor-pointer ${user.isBanned ? "opacity-60" : ""}`}
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{user.telegramId}</td>
        <td className="px-4 py-3">
          <div className="font-orbitron font-bold text-sm text-foreground">
            {user.username || user.firstName || "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">ref: {user.referralCode}</div>
        </td>
        <td className="px-4 py-3 text-right font-orbitron font-black text-yellow-400">
          {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td className="px-4 py-3 text-right font-orbitron text-xs text-muted-foreground">
          {user.totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td className="px-4 py-3 text-center">
          {user.isBanned ? (
            <span className="text-[10px] font-bold font-orbitron text-destructive bg-destructive/10 px-2 py-1 rounded-full">BANNED</span>
          ) : (
            <span className="text-[10px] font-bold font-orbitron text-green-400 bg-green-500/10 px-2 py-1 rounded-full">ACTIVE</span>
          )}
        </td>
        <td className="px-4 py-3 text-right text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-border bg-card/60">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid grid-cols-3 gap-4">

              {/* Send SKZ */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <Send className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[10px] font-orbitron font-bold text-foreground uppercase tracking-widest">Send SKZ</p>
                </div>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    placeholder="Amount"
                    value={sendAmt}
                    onChange={(e) => setSendAmt(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <input
                  className={inputClass}
                  placeholder="Note (optional)"
                  value={sendNote}
                  onChange={(e) => setSendNote(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); if (sendAmt) sendMutation.mutate(); }}
                  disabled={sendMutation.isPending || !sendAmt}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 font-orbitron text-xs font-bold tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sendMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Send
                </button>
              </div>

              {/* Deduct SKZ */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <Minus className="h-3.5 w-3.5 text-orange-400" />
                  <p className="text-[10px] font-orbitron font-bold text-foreground uppercase tracking-widest">Deduct SKZ</p>
                </div>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    placeholder="Amount"
                    value={deductAmt}
                    onChange={(e) => setDeductAmt(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <input
                  className={inputClass}
                  placeholder="Note (optional)"
                  value={deductNote}
                  onChange={(e) => setDeductNote(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); if (deductAmt) deductMutation.mutate(); }}
                  disabled={deductMutation.isPending || !deductAmt}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 font-orbitron text-xs font-bold tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deductMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Minus className="h-3.5 w-3.5" />}
                  Deduct
                </button>
              </div>

              {/* Ban / Unban */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <Ban className="h-3.5 w-3.5 text-destructive" />
                  <p className="text-[10px] font-orbitron font-bold text-foreground uppercase tracking-widest">Account Status</p>
                </div>
                <div className="bg-background border border-border rounded-lg p-3 text-center mb-2">
                  <p className="text-[10px] text-muted-foreground font-orbitron mb-1">Current Status</p>
                  {user.isBanned ? (
                    <span className="text-xs font-bold font-orbitron text-destructive">BANNED</span>
                  ) : (
                    <span className="text-xs font-bold font-orbitron text-green-400">ACTIVE</span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleBan(); }}
                  disabled={banUser.isPending}
                  className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg font-orbitron text-xs font-bold tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    user.isBanned
                      ? "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20"
                      : "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
                  }`}
                >
                  {banUser.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : user.isBanned ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Ban className="h-3.5 w-3.5" />
                  )}
                  {user.isBanned ? "Unban User" : "Ban User"}
                </button>
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function UsersPanel() {
  const [search, setSearch] = useState("");
  const { data: usersData, isLoading } = useListUsers(
    { search, limit: 50 },
    { query: { queryKey: getListUsersQueryKey({ search, limit: 50 }) } }
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground font-orbitron focus:outline-none focus:border-primary/60 transition-colors"
          placeholder="Search by username or Telegram ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-[10px] font-orbitron font-bold text-muted-foreground uppercase tracking-widest">Telegram ID</th>
              <th className="px-4 py-3 text-left text-[10px] font-orbitron font-bold text-muted-foreground uppercase tracking-widest">User</th>
              <th className="px-4 py-3 text-right text-[10px] font-orbitron font-bold text-muted-foreground uppercase tracking-widest">Balance (SKZ)</th>
              <th className="px-4 py-3 text-right text-[10px] font-orbitron font-bold text-muted-foreground uppercase tracking-widest">Earned</th>
              <th className="px-4 py-3 text-center text-[10px] font-orbitron font-bold text-muted-foreground uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-right text-[10px] font-orbitron font-bold text-muted-foreground uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground font-orbitron text-sm">
                  Loading users...
                </td>
              </tr>
            ) : !usersData?.users?.length ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground font-orbitron text-sm">
                  No users found
                </td>
              </tr>
            ) : (
              usersData.users.map((user) => (
                <UserRow key={user.id} user={user as User} search={search} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {usersData?.total !== undefined && (
        <p className="text-[10px] text-muted-foreground font-orbitron text-right">
          Showing {usersData.users?.length ?? 0} of {usersData.total} users
        </p>
      )}
    </div>
  );
}
