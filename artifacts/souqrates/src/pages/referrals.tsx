import { useGetMyReferrals, useGetReferralEarnings, useGetReferralLeaderboard, getGetMyReferralsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Users, Copy, Trophy, Network, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function Referrals() {
  const telegramId = localStorage.getItem("telegram_id") || "";
  const { toast } = useToast();

  const { data: refInfo, isLoading: refLoading } = useGetMyReferrals(
    { telegram_id: telegramId },
    { query: { enabled: !!telegramId, queryKey: getGetMyReferralsQueryKey({ telegram_id: telegramId }) } }
  );

  const { data: earnings } = useGetReferralEarnings(
    { telegram_id: telegramId },
    { query: { enabled: !!telegramId, queryKey: ["getReferralEarnings", telegramId] } }
  );

  const { data: leaderboard } = useGetReferralLeaderboard(
    { limit: 10 },
    { query: { queryKey: ["getReferralLeaderboard"] } }
  );

  const copyLink = () => {
    if (refInfo?.referralLink) {
      navigator.clipboard.writeText(refInfo.referralLink);
      toast({ title: "Link Copied", description: "Referral link copied to clipboard!" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Users className="h-8 w-8 text-purple-500" />
        <h1 className="text-3xl font-orbitron font-bold text-foreground">REFERRALS</h1>
      </div>

      <Card className="bg-card border-purple-500/20 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>
        <CardContent className="p-6">
          <h2 className="text-sm font-orbitron text-muted-foreground tracking-widest uppercase mb-4">Your Invite Link</h2>
          <div className="flex gap-2">
            <div className="flex-1 bg-background border border-border rounded-md px-4 py-3 font-mono text-sm overflow-x-auto whitespace-nowrap text-primary">
              {refInfo?.referralLink || "Loading..."}
            </div>
            <Button onClick={copyLink} className="shrink-0 bg-purple-600 hover:bg-purple-700">
              <Copy className="h-4 w-4 mr-2" />
              COPY
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-background/50 p-4 rounded-lg border border-border text-center">
              <div className="text-xs text-muted-foreground font-orbitron mb-1">TOTAL EARNED</div>
              <div className="text-xl font-bold font-orbitron text-skz">{earnings?.totalEarned?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-background/50 p-4 rounded-lg border border-border text-center">
              <div className="text-xs text-muted-foreground font-orbitron mb-1">THIS MONTH</div>
              <div className="text-xl font-bold font-orbitron text-green-500">{earnings?.thisMonth?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-background/50 p-4 rounded-lg border border-border text-center">
              <div className="text-xs text-muted-foreground font-orbitron mb-1">YOUR CODE</div>
              <div className="text-xl font-bold font-orbitron text-primary">{refInfo?.referralCode || "-"}</div>
            </div>
            <div className="bg-background/50 p-4 rounded-lg border border-border text-center">
              <div className="text-xs text-muted-foreground font-orbitron mb-1">TOTAL NETWORK</div>
              <div className="text-xl font-bold font-orbitron text-foreground">
                {(refInfo?.level1Count || 0) + (refInfo?.level2Count || 0) + (refInfo?.level3Count || 0)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="font-orbitron flex items-center text-lg"><Network className="h-5 w-5 mr-2 text-primary" /> Network Tree</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative pl-6 space-y-6 before:absolute before:inset-y-0 before:left-2.5 before:w-px before:bg-border">
              <div className="relative">
                <div className="absolute -left-6 w-3 h-3 bg-primary rounded-full ring-4 ring-background"></div>
                <div className="bg-background border border-border p-3 rounded-lg flex justify-between items-center">
                  <div>
                    <div className="font-orbitron font-bold text-sm">LEVEL 1</div>
                    <div className="text-xs text-muted-foreground">{refInfo?.level1Rate}% Commission</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{refInfo?.level1Count || 0}</div>
                    <div className="text-[10px] text-green-500 font-orbitron">+{earnings?.level1Earned || 0} SKZ</div>
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <div className="absolute -left-6 w-3 h-3 bg-purple-500 rounded-full ring-4 ring-background"></div>
                <div className="bg-background border border-border p-3 rounded-lg flex justify-between items-center">
                  <div>
                    <div className="font-orbitron font-bold text-sm text-purple-500">LEVEL 2</div>
                    <div className="text-xs text-muted-foreground">{refInfo?.level2Rate}% Commission</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{refInfo?.level2Count || 0}</div>
                    <div className="text-[10px] text-green-500 font-orbitron">+{earnings?.level2Earned || 0} SKZ</div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-6 w-3 h-3 bg-blue-500 rounded-full ring-4 ring-background"></div>
                <div className="bg-background border border-border p-3 rounded-lg flex justify-between items-center">
                  <div>
                    <div className="font-orbitron font-bold text-sm text-blue-500">LEVEL 3</div>
                    <div className="text-xs text-muted-foreground">{refInfo?.level3Rate}% Commission</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{refInfo?.level3Count || 0}</div>
                    <div className="text-[10px] text-green-500 font-orbitron">+{earnings?.level3Earned || 0} SKZ</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="font-orbitron flex items-center text-lg"><Trophy className="h-5 w-5 mr-2 text-skz" /> Top Earners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {leaderboard?.map((entry, i) => (
                <div key={entry.userId} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-orbitron font-bold text-sm ${
                      i === 0 ? 'bg-yellow-500/20 text-yellow-500' : 
                      i === 1 ? 'bg-gray-300/20 text-gray-300' :
                      i === 2 ? 'bg-amber-700/20 text-amber-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      #{entry.rank}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{entry.firstName || entry.username || `User ${entry.userId}`}</div>
                      <div className="text-xs text-muted-foreground">{entry.referralCount} referrals</div>
                    </div>
                  </div>
                  <div className="font-orbitron font-bold text-sm text-skz">
                    {entry.totalEarned.toLocaleString()} SKZ
                  </div>
                </div>
              ))}
              {!leaderboard?.length && <div className="text-center text-sm text-muted-foreground p-4">No data available</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
