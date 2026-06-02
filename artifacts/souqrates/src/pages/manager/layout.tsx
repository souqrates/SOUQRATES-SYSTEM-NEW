import { Switch, Route, useLocation } from "wouter";
import { Link } from "wouter";
import { ShieldCheck, LayoutDashboard, Users, Activity, Settings, Gamepad2, ShoppingBag } from "lucide-react";
import Dashboard from "./dashboard";
import UsersPanel from "./users";
import Transactions from "./transactions";
import SystemSettings from "./settings";
import GamesAdmin from "./games";
import SouqAdmin from "./souq";

export default function ManagerLayout() {
  const [location] = useLocation();

  const nav = [
    { href: "/manager", label: "Dashboard", icon: LayoutDashboard },
    { href: "/manager/users", label: "Users", icon: Users },
    { href: "/manager/transactions", label: "Transactions", icon: Activity },
    { href: "/manager/games", label: "Games", icon: Gamepad2 },
    { href: "/manager/souq", label: "Souq", icon: ShoppingBag },
    { href: "/manager/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-8">
        <ShieldCheck className="h-8 w-8 text-destructive" />
        <h1 className="text-3xl font-orbitron font-bold text-foreground">MANAGER PANEL</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {nav.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div className={`whitespace-nowrap px-4 py-2 rounded-md flex items-center space-x-2 text-sm font-medium font-orbitron cursor-pointer transition-colors ${
                isActive ? "bg-destructive text-destructive-foreground" : "bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}>
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="pt-2">
        <Switch>
          <Route path="/manager" component={Dashboard} />
          <Route path="/manager/users" component={UsersPanel} />
          <Route path="/manager/transactions" component={Transactions} />
          <Route path="/manager/games" component={GamesAdmin} />
          <Route path="/manager/souq" component={SouqAdmin} />
          <Route path="/manager/settings" component={SystemSettings} />
        </Switch>
      </div>
    </div>
  );
}
