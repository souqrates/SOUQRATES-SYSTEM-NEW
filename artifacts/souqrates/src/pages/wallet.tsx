import { useGetWalletBalance, useListTransactions, getGetWalletBalanceQueryKey, getListTransactionsQueryKey, useDepositWallet } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Wallet as WalletIcon, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function Wallet() {
  const telegramId = localStorage.getItem("telegram_id") || "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: balance, isLoading: balanceLoading } = useGetWalletBalance(
    { telegram_id: telegramId },
    { query: { enabled: !!telegramId, queryKey: getGetWalletBalanceQueryKey({ telegram_id: telegramId }) } }
  );

  const { data: txData, isLoading: txLoading } = useListTransactions(
    { telegram_id: telegramId, limit: 20 },
    { query: { enabled: !!telegramId, queryKey: getListTransactionsQueryKey({ telegram_id: telegramId, limit: 20 }) } }
  );

  const depositMut = useDepositWallet();
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCurrency, setDepositCurrency] = useState<"TON" | "USDT">("TON");

  const handleDeposit = () => {
    if (!depositAmount || isNaN(Number(depositAmount))) return;
    depositMut.mutate({
      data: {
        telegramId,
        amount: Number(depositAmount),
        currency: depositCurrency,
        txHash: "simulated_tx_" + Date.now(),
      }
    }, {
      onSuccess: () => {
        toast({ title: "Deposit Initiated", description: `Simulated deposit of ${depositAmount} ${depositCurrency}` });
        setDepositAmount("");
        queryClient.invalidateQueries({ queryKey: getGetWalletBalanceQueryKey({ telegram_id: telegramId }) });
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey({ telegram_id: telegramId, limit: 20 }) });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <WalletIcon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-orbitron font-bold text-foreground">WALLET</h1>
      </div>

      <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20 shadow-lg">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <h2 className="text-sm font-orbitron text-muted-foreground tracking-widest uppercase mb-2">Available Balance</h2>
              {balanceLoading ? (
                <div className="h-12 w-48 bg-muted animate-pulse rounded"></div>
              ) : (
                <div className="text-5xl font-orbitron font-bold text-skz flex items-baseline justify-center md:justify-start">
                  {balance?.skzBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-2xl ml-2 text-skz/70">SKZ</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 min-w-[200px]">
              <div className="flex justify-between items-center bg-background/50 px-4 py-2 rounded-md">
                <span className="text-xs text-muted-foreground font-orbitron">TOTAL IN</span>
                <span className="font-orbitron font-bold text-green-500">+{balance?.totalDeposited?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center bg-background/50 px-4 py-2 rounded-md">
                <span className="text-xs text-muted-foreground font-orbitron">TOTAL OUT</span>
                <span className="font-orbitron font-bold text-red-500">-{balance?.totalWithdrawn?.toLocaleString() || 0}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="font-orbitron text-lg flex items-center">
            <Download className="h-5 w-5 mr-2 text-green-500" /> Add Funds
          </CardTitle>
          <CardDescription>Deposit TON or USDT to receive SKZ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-orbitron text-muted-foreground">AMOUNT</label>
              <Input
                type="number"
                placeholder="0.00"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                className="font-orbitron text-lg bg-background"
              />
            </div>
            <div className="w-32 space-y-2">
              <label className="text-xs font-orbitron text-muted-foreground">CURRENCY</label>
              <Select value={depositCurrency} onValueChange={(v: "TON" | "USDT") => setDepositCurrency(v)}>
                <SelectTrigger className="font-orbitron bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TON">TON</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="w-full font-orbitron tracking-wider"
            onClick={handleDeposit}
            disabled={depositMut.isPending || !depositAmount}
          >
            {depositMut.isPending ? "PROCESSING..." : "CONFIRM DEPOSIT"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-xl font-orbitron font-semibold">TRANSACTION HISTORY</h3>

        {txLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : txData?.transactions.length === 0 ? (
          <Card className="bg-card/50 border-dashed border-muted">
            <CardContent className="p-8 text-center text-muted-foreground font-orbitron tracking-wider">
              No transactions yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {txData?.transactions.map((tx) => {
              const isPositive = tx.type === "deposit" || tx.type === "transfer_in" || tx.type === "commission";
              return (
                <Card key={tx.id} className="bg-card border-border">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-full ${
                        tx.type === "deposit" ? "bg-green-500/10 text-green-500" :
                        tx.type === "withdraw" ? "bg-red-500/10 text-red-500" :
                        tx.type === "transfer_in" ? "bg-blue-500/10 text-blue-500" :
                        tx.type === "transfer_out" ? "bg-orange-500/10 text-orange-500" :
                        "bg-purple-500/10 text-purple-500"
                      }`}>
                        {isPositive ? <Download className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-orbitron font-bold text-sm uppercase">{tx.type.replace("_", " ")}</p>
                          {tx.status === "confirmed" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                          {tx.status === "pending" && <Clock className="h-3 w-3 text-yellow-500" />}
                          {tx.status === "failed" && <XCircle className="h-3 w-3 text-red-500" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
                        {tx.note && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{tx.note}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-orbitron font-bold text-lg ${isPositive ? "text-green-500" : "text-foreground"}`}>
                        {isPositive ? "+" : "-"}{tx.amount.toLocaleString()} SKZ
                      </div>
                      {tx.currency && <div className="text-xs text-muted-foreground font-orbitron">{tx.currency}</div>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
