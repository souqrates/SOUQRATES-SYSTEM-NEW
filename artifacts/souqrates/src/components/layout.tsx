import { Link, useLocation } from "wouter";
import { Home, Wallet, Users, Bot, ShieldCheck } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const telegramId = localStorage.getItem("telegram_id");
  const { data: user } = useGetMe(
    { telegram_id: telegramId || "" },
    { query: { enabled: !!telegramId, queryKey: ["getMe", telegramId] } }
  );

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/wallet", label: "Wallet", icon: Wallet },
    { href: "/referrals", label: "Referrals", icon: Users },
    { href: "/bots", label: "Bots", icon: Bot },
  ];

  if (user?.isAdmin) {
    navItems.push({ href: "/manager", label: "Manager", icon: ShieldCheck });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row pb-16 md:pb-0">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-orbitron font-bold text-primary tracking-widest">SOUQRATES</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center space-x-3 px-4 py-3 rounded-md cursor-pointer transition-colors ${
                    isActive
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-8">{children}</div>
      </main>

      {/* Bottom Nav for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card/90 backdrop-blur-md z-50 flex justify-around p-2 pb-safe">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-6 w-6 mb-1" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
