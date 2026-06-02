import { useListBots, getListBotsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot as BotIcon, ArrowRight, Activity, Users, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Bots() {
  const { data: bots, isLoading } = useListBots({ query: { queryKey: getListBotsQueryKey() } });

  function handleLaunch(botUrl: string | null | undefined) {
    if (!botUrl) return;
    window.open(botUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <BotIcon className="h-8 w-8 text-purple-400" />
        <h1 className="text-3xl font-orbitron font-bold text-foreground tracking-widest">ECOSYSTEM</h1>
      </div>

      <p className="text-sm text-muted-foreground font-orbitron tracking-wider">
        ACCESS ALL SOUQRATES PLATFORMS FROM ONE HUB
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {isLoading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-56 bg-card animate-pulse rounded-xl border border-border" />
          ))
        ) : bots?.map((bot) => (
          <Card
            key={bot.id}
            className={`
              bg-card border-border overflow-hidden transition-all duration-300
              hover:border-purple-500/60 hover:shadow-xl hover:shadow-purple-900/20
              ${!bot.isActive && "opacity-60 grayscale"}
            `}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="w-14 h-14 rounded-2xl bg-purple-950/60 flex items-center justify-center text-3xl border border-purple-500/20 shadow-inner">
                  {bot.iconEmoji || <BotIcon className="h-7 w-7 text-purple-400" />}
                </div>
                <Badge
                  variant={bot.isActive ? "default" : "secondary"}
                  className="font-orbitron text-[10px] tracking-widest"
                >
                  {bot.isActive ? "ACTIVE" : "COMING SOON"}
                </Badge>
              </div>
              <CardTitle className="font-orbitron text-xl mt-4 tracking-wider">{bot.name}</CardTitle>
            </CardHeader>

            <CardContent className="pb-4">
              <p className="text-sm text-muted-foreground min-h-[40px] leading-relaxed">
                {bot.description}
              </p>

              <div className="flex items-center gap-5 mt-4 pt-4 border-t border-border/60">
                <div className="flex items-center text-xs text-muted-foreground gap-1">
                  <Users className="h-3.5 w-3.5 text-purple-400/70" />
                  <span>{bot.userCount.toLocaleString()} Users</span>
                </div>
                <div className="flex items-center text-xs text-muted-foreground gap-1">
                  <Activity className="h-3.5 w-3.5 text-green-400/70" />
                  <span>System Linked</span>
                </div>
                {bot.botUrl && (
                  <div className="flex items-center text-xs text-purple-400/80 gap-1 ml-auto">
                    <ExternalLink className="h-3 w-3" />
                    <span className="font-orbitron tracking-wider">{bot.botUrl}</span>
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="pt-0">
              <Button
                className="w-full font-orbitron tracking-widest group"
                disabled={!bot.isActive || !bot.botUrl}
                variant={bot.isActive && bot.botUrl ? "default" : "outline"}
                onClick={() => handleLaunch(bot.botUrl)}
              >
                {bot.isActive && bot.botUrl ? (
                  <>
                    LAUNCH APP
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                ) : bot.isActive ? (
                  "LINK PENDING"
                ) : (
                  "COMING SOON"
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}

        {(!bots || bots.length === 0) && !isLoading && (
          <Card className="bg-card border-dashed border-border md:col-span-2">
            <CardContent className="p-12 text-center text-muted-foreground">
              <BotIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-orbitron tracking-wider">No ecosystem bots available yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
