import { useLocation } from "wouter";
import { Shield, Users, Zap, ArrowRight, CheckCircle } from "lucide-react";

const rules = [
  "You must be an active SKZ holder with a verified account to apply.",
  "Subagents are authorized to send SKZ directly to any user by Telegram ID.",
  "All transfers are final and irreversible — act with full accountability.",
  "Subagent status can be revoked at any time for policy violations.",
  "You agree to act as a representative of the Souqrates ecosystem.",
  "Minimum transfer: 1 SKZ. Daily limits apply per account tier.",
  "Fraudulent activity results in permanent ban and balance freeze.",
];

export default function WelcomePage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
        <div className="animate-slide-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-orbitron tracking-widest uppercase">Souqrates</p>
              <h1 className="text-2xl font-orbitron font-bold text-foreground leading-tight">SUBAGENT</h1>
            </div>
          </div>

          <p className="text-muted-foreground text-sm mt-1 mb-8 font-orbitron tracking-wide">
            Partner platform — exclusive SKZ transfer privileges
          </p>

          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { icon: Shield, label: "Verified", desc: "Approved partners only" },
              { icon: Users, label: "Send SKZ", desc: "Transfer by user ID" },
              { icon: Zap, label: "Instant", desc: "Real-time settlement" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
                <Icon className="h-5 w-5 text-primary mx-auto mb-1.5" />
                <p className="text-xs font-orbitron font-bold text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <h2 className="text-sm font-orbitron font-bold text-foreground mb-4 tracking-wider uppercase">
              Partner Rules
            </h2>
            <div className="space-y-3">
              {rules.map((rule, i) => (
                <div key={i} className="flex gap-3">
                  <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">{rule}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
            <p className="text-xs text-primary/80 font-orbitron text-center leading-relaxed">
              By proceeding, you acknowledge all partner rules and accept full responsibility for your transfers.
            </p>
          </div>

          <button
            onClick={() => navigate("/apply")}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary text-primary-foreground font-orbitron font-bold tracking-wider text-sm hover:opacity-90 active:scale-95 transition-all duration-150 animate-pulse-glow"
          >
            Apply to Become a Subagent
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="text-center text-xs text-muted-foreground mt-4 font-orbitron">
            Applications are reviewed within 24–48 hours
          </p>
        </div>
      </div>
    </div>
  );
}
