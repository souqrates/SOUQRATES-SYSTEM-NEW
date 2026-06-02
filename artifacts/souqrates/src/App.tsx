import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { useRegisterUser } from "@workspace/api-client-react";
import { Layout } from "./components/layout";
import Home from "./pages/home";
import Wallet from "./pages/wallet";
import Referrals from "./pages/referrals";
import Bots from "./pages/bots";
import ManagerLayout from "./pages/manager/layout";

const queryClient = new QueryClient();

function MockAuthLayer({ children }: { children: React.ReactNode }) {
  const registerMutation = useRegisterUser();

  useEffect(() => {
    const telegramId = "demo_user_001";
    localStorage.setItem("telegram_id", telegramId);

    registerMutation.mutate({
      data: {
        telegramId,
        firstName: "Demo",
        username: "souqrates_demo",
      }
    }, {
      onSuccess: () => {
        console.log("Mock Telegram user registered");
      }
    });
  }, []);

  return <>{children}</>;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/wallet" component={Wallet} />
        <Route path="/referrals" component={Referrals} />
        <Route path="/bots" component={Bots} />
        <Route path="/manager" component={ManagerLayout} />
        <Route path="/manager/users" component={ManagerLayout} />
        <Route path="/manager/transactions" component={ManagerLayout} />
        <Route path="/manager/games" component={ManagerLayout} />
        <Route path="/manager/settings" component={ManagerLayout} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MockAuthLayer>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </MockAuthLayer>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
