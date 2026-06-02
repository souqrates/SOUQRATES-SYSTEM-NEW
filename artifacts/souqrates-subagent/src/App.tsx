import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import WelcomePage from "@/pages/welcome";
import ApplyPage from "@/pages/apply";
import PendingPage from "@/pages/pending";
import DashboardPage from "@/pages/dashboard";
import NotFound from "@/pages/not-found";
import { initTelegram, getTelegramId } from "@/lib/telegram";

const queryClient = new QueryClient();

export function getTelegramIdLive(): string {
  return localStorage.getItem("telegram_id") ?? "demo_user_001";
}

function TelegramInit({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initTelegram();
    const id = getTelegramId();
    localStorage.setItem("telegram_id", id);
    localStorage.setItem("souqrates_telegram_id", id);
  }, []);
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={WelcomePage} />
      <Route path="/apply" component={ApplyPage} />
      <Route path="/pending" component={PendingPage} />
      <Route path="/dashboard" component={DashboardPage} />
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
