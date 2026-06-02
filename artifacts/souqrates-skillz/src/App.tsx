import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Lobby from "@/pages/lobby";
import GameDetail from "@/pages/game";
import Play from "@/pages/play";
import History from "@/pages/history";
import LeaderboardPage from "@/pages/leaderboard";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { initTelegram, getTelegramId } from "@/lib/telegram";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function TelegramInit({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initTelegram();
    const id = getTelegramId();
    localStorage.setItem("telegram_id", id);
  }, []);
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Lobby} />
      <Route path="/game/:id" component={GameDetail} />
      <Route path="/play/:sessionId" component={Play} />
      <Route path="/history" component={History} />
      <Route path="/leaderboard/:gameId" component={LeaderboardPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TelegramInit>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </TelegramInit>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
