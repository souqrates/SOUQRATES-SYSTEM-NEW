import { useGetAdminDashboard, getGetAdminDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Coins, Activity, TrendingUp, Download, ArrowRightLeft } from "lucide-react";

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetAdminDashboard({ query: { queryKey: getGetAdminDashboardQueryKey() } });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-lg"></div>)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground font-orbitron">TOTAL USERS</p>
                <div className="text-2xl font-bold font-orbitron mt-1">{dashboard?.totalUsers?.toLocaleString() || 0}</div>
              </div>
              <div className="p-2 bg-primary/10 text-primary rounded-md">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="text-green-500">+{dashboard?.newUsersToday || 0}</span> today
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground font-orbitron">SKZ IN CIRCULATION</p>
                <div className="text-2xl font-bold font-orbitron text-skz mt-1">{dashboard?.totalSkz?.toLocaleString() || 0}</div>
              </div>
              <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-md">
                <Coins className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground font-orbitron">TRANSACTIONS</p>
                <div className="text-2xl font-bold font-orbitron mt-1">{dashboard?.totalTransactions?.toLocaleString() || 0}</div>
              </div>
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-md">
                <Activity className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground font-orbitron">REVENUE TODAY</p>
                <div className="text-2xl font-bold font-orbitron text-green-500 mt-1">{dashboard?.revenueToday?.toLocaleString() || 0}</div>
              </div>
              <div className="p-2 bg-green-500/10 text-green-500 rounded-md">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {dashboard?.revenueThisMonth?.toLocaleString() || 0} this month
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-orbitron text-sm">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboard?.recentTransactions?.map(tx => (
                <div key={tx.id} className="flex justify-between items-center p-2 hover:bg-accent rounded-md">
                  <div className="flex items-center space-x-3">
                    <div className="p-1.5 rounded bg-muted text-muted-foreground">
                      {tx.type === 'deposit' ? <Download className="h-3 w-3 text-green-500" /> : <ArrowRightLeft className="h-3 w-3 text-blue-500" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium">User #{tx.userId}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{tx.type}</div>
                    </div>
                  </div>
                  <div className={`font-orbitron text-sm font-bold ${tx.type === 'deposit' || tx.type === 'transfer_in' || tx.type === 'commission' ? 'text-green-500' : 'text-foreground'}`}>
                    {tx.type === 'deposit' || tx.type === 'transfer_in' || tx.type === 'commission' ? '+' : '-'}{tx.amount}
                  </div>
                </div>
              ))}
              {(!dashboard?.recentTransactions || dashboard.recentTransactions.length === 0) && (
                <div className="text-center text-sm text-muted-foreground py-4">No recent transactions</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-orbitron text-sm">Top Referrers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboard?.topReferrers?.map((entry, i) => (
                <div key={entry.userId} className="flex justify-between items-center p-2 hover:bg-accent rounded-md">
                  <div className="flex items-center space-x-3">
                    <div className="font-orbitron text-xs text-muted-foreground w-4">{i + 1}.</div>
                    <div>
                      <div className="text-sm font-medium">{entry.username || `User ${entry.userId}`}</div>
                      <div className="text-[10px] text-muted-foreground">{entry.referralCount} referrals</div>
                    </div>
                  </div>
                  <div className="font-orbitron text-sm font-bold text-skz">
                    {entry.totalEarned} SKZ
                  </div>
                </div>
              ))}
              {(!dashboard?.topReferrers || dashboard.topReferrers.length === 0) && (
                <div className="text-center text-sm text-muted-foreground py-4">No referrers data</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
