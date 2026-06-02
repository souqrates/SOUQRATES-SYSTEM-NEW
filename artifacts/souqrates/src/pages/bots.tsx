import { useListBots, getListBotsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot as BotIcon, ArrowRight, Activity, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Bots() {
  const { data: bots, isLoading } = useListBots({ query: { queryKey: getListBotsQueryKey() } });

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <BotIcon className="h-8 w-8 text-blue-500" />
        <h1 className="text-3xl font-orbitron font-bold text-foreground">ECOSYSTEM</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="h-48 bg-card animate-pulse rounded-xl border border-border"></div>)
        ) : bots?.map((bot) => (
          <Card key={bot.id} className={`bg-card border-border overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 ${!bot.isActive && 'opacity-70 grayscale'}`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl border border-primary/20">
                  {bot.iconEmoji || <BotIcon className="h-6 w-6 text-primary" />}
                </div>
                <Badge variant={bot.isActive ? "default" : "secondary"} className="font-orbitron text-[10px]">
                  {bot.isActive ? "ACTIVE" : "IN DEVELOPMENT"}
                </Badge>
              </div>
              <CardTitle className="font-orbitron text-xl mt-4">{bot.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground min-h-[40px]">{bot.description}</p>
              
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
                <div className="flex items-center text-xs text-muted-foreground">
                  <Users className="h-3 w-3 mr-1" />
                  {bot.userCount.toLocaleString()} Users
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Activity className="h-3 w-3 mr-1" />
                  System Linked
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-0">
              <Button className="w-full font-orbitron tracking-wider group" disabled={!bot.isActive} variant={bot.isActive ? "default" : "outline"}>
                {bot.isActive ? (
                  <>LAUNCH APP <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" /></>
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
              <p>No ecosystem bots available yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
