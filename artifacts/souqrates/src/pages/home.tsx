import { useGetWalletBalance, useGetMe, getGetWalletBalanceQueryKey, getGetMeQueryKey, useListTransactions, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ArrowRightLeft, Download, Users, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function AnimatedCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1000;
    const increment = value / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(start);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return <>{displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

export default function Home() {
  const telegramId = localStorage.getItem("telegram_id") || "";
  
  const { data: user } = useGetMe(
    { telegram_id: telegramId },
    { query: { enabled: !!telegramId, queryKey: getGetMeQueryKey({ telegram_id: telegramId }) } }
  );

  const { data: balance } = useGetWalletBalance(
    { telegram_id: telegramId },
    { query: { enabled: !!telegramId, queryKey: getGetWalletBalanceQueryKey({ telegram_id: telegramId }) } }
  );

  const { data: transactionsData } = useListTransactions(
    { telegram_id: telegramId, limit: 3 },
    { query: { enabled: !!telegramId, queryKey: getListTransactionsQueryKey({ telegram_id: telegramId, limit: 3 }) } }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-orbitron font-bold text-foreground">DASHBOARD</h1>
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
            {user?.firstName?.[0] || "U"}
          </div>
          <span className="font-medium hidden sm:inline-block">{user?.firstName}</span>
        </div>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-card to-card/50 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
          <h2 className="text-sm font-orbitron text-muted-foreground tracking-widest uppercase">Total Balance</h2>
          <div className="text-5xl md:text-6xl font-orbitron font-bold text-skz flex items-baseline justify-center">
            {balance ? <AnimatedCounter value={balance.skzBalance} /> : "0.00"}
            <span className="text-2xl ml-2 text-skz/70">SKZ</span>
          </div>
          {balance?.pendingDeposits ? (
            <p className="text-sm text-yellow-500 font-medium">
              +{balance.pendingDeposits.toLocaleString()} SKZ Pending
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Link href="/wallet">
          <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center space-y-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all">
            <Download className="h-6 w-6 text-primary" />
            <span className="font-orbitron text-xs">DEPOSIT</span>
          </Button>
        </Link>
        <Link href="/wallet">
          <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center space-y-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all">
            <ArrowRightLeft className="h-6 w-6 text-blue-500" />
            <span className="font-orbitron text-xs">TRANSFER</span>
          </Button>
        </Link>
        <Link href="/referrals">
          <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center space-y-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all">
            <Users className="h-6 w-6 text-purple-500" />
            <span className="font-orbitron text-xs">REFERRALS</span>
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-orbitron font-semibold">RECENT ACTIVITY</h3>
          <Link href="/wallet">
            <Button variant="ghost" size="sm" className="text-primary text-xs font-orbitron">VIEW ALL</Button>
          </Link>
        </div>
        
        <div className="space-y-3">
          {transactionsData?.transactions.length === 0 ? (
            <Card className="bg-card/50 border-dashed border-muted">
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                No recent transactions
              </CardContent>
            </Card>
          ) : (
            transactionsData?.transactions.map((tx) => (
              <Card key={tx.id} className="bg-card border-border hover:border-primary/20 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${
                      tx.type === 'deposit' ? 'bg-green-500/10 text-green-500' :
                      tx.type === 'withdraw' ? 'bg-red-500/10 text-red-500' :
                      tx.type === 'transfer_in' ? 'bg-blue-500/10 text-blue-500' :
                      tx.type === 'transfer_out' ? 'bg-orange-500/10 text-orange-500' :
                      'bg-purple-500/10 text-purple-500'
                    }`}>
                      {tx.type === 'deposit' || tx.type === 'transfer_in' || tx.type === 'commission' ? <Download className="h-4 w-4" /> : <ArrowRightLeft className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium capitalize text-sm">{tx.type.replace('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className={`font-orbitron font-bold ${
                    tx.type === 'deposit' || tx.type === 'transfer_in' || tx.type === 'commission' ? 'text-green-500' : 'text-foreground'
                  }`}>
                    {tx.type === 'deposit' || tx.type === 'transfer_in' || tx.type === 'commission' ? '+' : '-'}{tx.amount.toLocaleString()} SKZ
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
