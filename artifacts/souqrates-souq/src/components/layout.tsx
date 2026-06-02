import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Store, Library, Wallet, Search } from "lucide-react";
import { getTelegramId } from "@/hooks/use-auth";
import { useGetWalletBalance } from "@workspace/api-client-react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const telegramId = getTelegramId();
  
  const { data: balance } = useGetWalletBalance(
    { telegram_id: telegramId },
    { query: { enabled: !!telegramId, queryKey: ['walletBalance', telegramId] } }
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <span className="font-orbitron font-bold text-xl tracking-wider text-primary">SOUQ</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-4 text-sm">
              <Link 
                href="/" 
                className={`transition-colors hover:text-foreground/80 ${location === "/" ? "text-foreground" : "text-foreground/60"}`}
              >
                Marketplace
              </Link>
              <Link 
                href="/library" 
                className={`transition-colors hover:text-foreground/80 ${location === "/library" ? "text-foreground" : "text-foreground/60"}`}
              >
                My Library
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-secondary-border">
              <Wallet className="h-4 w-4 text-accent" />
              <span className="font-mono font-medium text-accent">
                {balance?.skzBalance?.toLocaleString() || "0"} SKZ
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
      
      <footer className="border-t border-border py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="font-orbitron tracking-wider">SOUQRATES ECOSYSTEM &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
