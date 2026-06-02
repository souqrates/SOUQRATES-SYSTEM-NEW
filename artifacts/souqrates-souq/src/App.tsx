import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import Home from "@/pages/home";
import ProductDetail from "@/pages/product";
import LibraryPage from "@/pages/library";
import NotFound from "@/pages/not-found";
import { initTelegram, getTelegramId } from "@/lib/telegram";

const queryClient = new QueryClient();

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
      <Route path="/" component={Home} />
      <Route path="/product/:id" component={ProductDetail} />
      <Route path="/library" component={LibraryPage} />
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
