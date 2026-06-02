import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import WelcomePage from "@/pages/welcome";
import ApplyPage from "@/pages/apply";
import PendingPage from "@/pages/pending";
import DashboardPage from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const TELEGRAM_ID = (() => {
  const stored = localStorage.getItem("souqrates_telegram_id");
  if (stored) return stored;
  const id = "demo_user_001";
  localStorage.setItem("souqrates_telegram_id", id);
  return id;
})();

export { TELEGRAM_ID };

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
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
