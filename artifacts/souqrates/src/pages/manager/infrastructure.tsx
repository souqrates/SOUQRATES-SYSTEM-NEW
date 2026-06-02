import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, AlertCircle, Server, Database, Zap, Webhook, Eye, EyeOff } from "lucide-react";

type ServiceKey = "sentry" | "upstash_redis" | "upstash_qstash" | "contabo_webhook";
type TestStatus = "idle" | "testing" | "ok" | "error";

interface ServiceState {
  url: string;
  token: string;
  status: TestStatus;
  message: string;
  showToken: boolean;
}

const INITIAL: Record<ServiceKey, ServiceState> = {
  sentry:           { url: "", token: "", status: "idle", message: "", showToken: false },
  upstash_redis:    { url: "", token: "", status: "idle", message: "", showToken: false },
  upstash_qstash:   { url: "", token: "", status: "idle", message: "", showToken: false },
  contabo_webhook:  { url: "", token: "", status: "idle", message: "", showToken: false },
};

const SERVICE_META: Record<ServiceKey, { label: string; icon: React.ElementType; urlLabel: string; urlPlaceholder: string; hasToken: boolean; tokenLabel: string; description: string; docs: string }> = {
  sentry: {
    label: "Sentry",
    icon: AlertCircle,
    urlLabel: "DSN URL",
    urlPlaceholder: "https://abc123@o0.ingest.sentry.io/0000000",
    hasToken: false,
    tokenLabel: "",
    description: "Error tracking & performance monitoring — catches crashes and slow requests in production",
    docs: "https://docs.sentry.io/platforms/node/",
  },
  upstash_redis: {
    label: "Upstash Redis",
    icon: Database,
    urlLabel: "Redis REST URL",
    urlPlaceholder: "https://xxxx.upstash.io",
    hasToken: true,
    tokenLabel: "Redis Token",
    description: "In-memory cache & rate limiting — reduces DB load and handles millions of requests",
    docs: "https://docs.upstash.com/redis",
  },
  upstash_qstash: {
    label: "Upstash QStash",
    icon: Zap,
    urlLabel: "QStash URL",
    urlPlaceholder: "https://qstash.upstash.io",
    hasToken: true,
    tokenLabel: "QStash Token",
    description: "Durable message queue — offload heavy tasks (commission processing, notifications) to background workers",
    docs: "https://docs.upstash.com/qstash",
  },
  contabo_webhook: {
    label: "Contabo Server",
    icon: Webhook,
    urlLabel: "Server Base URL",
    urlPlaceholder: "https://api.souqrates.com",
    hasToken: false,
    tokenLabel: "",
    description: "Production server URL — enables Telegram Webhook mode (replaces long polling, required for high traffic)",
    docs: "https://core.telegram.org/bots/webhooks",
  },
};

function StatusBadge({ status, message }: { status: TestStatus; message: string }) {
  if (status === "idle") return <Badge variant="secondary" className="font-orbitron text-xs">Not Configured</Badge>;
  if (status === "testing") return <Badge variant="outline" className="font-orbitron text-xs text-yellow-400 border-yellow-400/40"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Testing...</Badge>;
  if (status === "ok") return <Badge className="font-orbitron text-xs bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</Badge>;
  return <Badge variant="destructive" className="font-orbitron text-xs"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
}

export default function InfrastructurePage() {
  const [services, setServices] = useState<Record<ServiceKey, ServiceState>>(INITIAL);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/admin/infrastructure")
      .then((r) => r.json())
      .then((data) => {
        setServices((prev) => ({
          sentry:          { ...prev.sentry,          url: data.sentryDsn         || "", status: data.sentryDsn         ? "ok" : "idle" },
          upstash_redis:   { ...prev.upstash_redis,   url: data.upstashRedisUrl   || "", token: data.upstashRedisToken  || "", status: data.upstashRedisUrl   ? "ok" : "idle" },
          upstash_qstash:  { ...prev.upstash_qstash,  url: data.upstashQstashUrl  || "", token: data.upstashQstashToken || "", status: data.upstashQstashUrl  ? "ok" : "idle" },
          contabo_webhook: { ...prev.contabo_webhook, url: data.contaboWebhookUrl || "", status: data.contaboWebhookUrl ? "ok" : "idle" },
        }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function update(key: ServiceKey, field: keyof ServiceState, value: string | boolean) {
    setServices((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value, status: "idle", message: "" } }));
  }

  async function testAndSave(key: ServiceKey) {
    const svc = services[key];
    if (!svc.url) {
      toast({ title: "URL required", description: "Paste the URL first", variant: "destructive" });
      return;
    }

    setServices((prev) => ({ ...prev, [key]: { ...prev[key], status: "testing", message: "" } }));

    try {
      const res = await fetch("/api/admin/infrastructure/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: key, url: svc.url, token: svc.token }),
      });
      const result = await res.json() as { ok: boolean; message: string };

      setServices((prev) => ({
        ...prev,
        [key]: { ...prev[key], status: result.ok ? "ok" : "error", message: result.message },
      }));

      if (result.ok) {
        // Save to DB
        await fetch("/api/admin/infrastructure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service: key, url: svc.url, token: svc.token }),
        });
        toast({ title: "Saved", description: `${SERVICE_META[key].label} connected and saved` });
      } else {
        toast({ title: "Connection failed", description: result.message, variant: "destructive" });
      }
    } catch {
      setServices((prev) => ({ ...prev, [key]: { ...prev[key], status: "error", message: "Network error" } }));
    }
  }

  async function remove(key: ServiceKey) {
    await fetch("/api/admin/infrastructure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: key, url: "", token: "" }),
    });
    setServices((prev) => ({ ...prev, [key]: { ...INITIAL[key] } }));
    toast({ title: "Removed", description: `${SERVICE_META[key].label} configuration cleared` });
  }

  const connectedCount = Object.values(services).filter((s) => s.status === "ok").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-orbitron font-bold text-foreground tracking-wider">INFRASTRUCTURE</h2>
          <p className="text-xs text-muted-foreground font-orbitron mt-1 tracking-wide">External services for scale — millions of users</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2">
          <Server className="h-4 w-4 text-primary" />
          <span className="font-orbitron text-sm font-bold text-foreground">{connectedCount}</span>
          <span className="font-orbitron text-xs text-muted-foreground">/ 4 Connected</span>
        </div>
      </div>

      {/* Status overview bar */}
      <div className="grid grid-cols-4 gap-3">
        {(Object.keys(SERVICE_META) as ServiceKey[]).map((key) => {
          const meta = SERVICE_META[key];
          const Icon = meta.icon;
          const st = services[key].status;
          return (
            <div key={key} className={`rounded-xl border p-3 flex items-center gap-2 ${
              st === "ok" ? "border-green-500/30 bg-green-500/5" :
              st === "error" ? "border-red-500/30 bg-red-500/5" :
              "border-border bg-card"
            }`}>
              <Icon className={`h-4 w-4 shrink-0 ${st === "ok" ? "text-green-400" : st === "error" ? "text-red-400" : "text-muted-foreground"}`} />
              <div className="min-w-0">
                <p className="text-xs font-orbitron font-bold text-foreground truncate">{meta.label}</p>
                <p className="text-[10px] font-orbitron text-muted-foreground capitalize">{st === "idle" ? "not set" : st}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Service cards */}
      <div className="space-y-4">
        {(Object.keys(SERVICE_META) as ServiceKey[]).map((key) => {
          const meta = SERVICE_META[key];
          const Icon = meta.icon;
          const svc = services[key];

          return (
            <Card key={key} className={`border transition-colors ${
              svc.status === "ok" ? "border-green-500/30" :
              svc.status === "error" ? "border-red-500/40" :
              "border-border"
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      svc.status === "ok" ? "bg-green-500/15" : "bg-primary/10"
                    }`}>
                      <Icon className={`h-4 w-4 ${svc.status === "ok" ? "text-green-400" : "text-primary"}`} />
                    </div>
                    <div>
                      <CardTitle className="font-orbitron text-sm text-foreground tracking-wider">{meta.label}</CardTitle>
                      <CardDescription className="font-orbitron text-xs mt-0.5">{meta.description}</CardDescription>
                    </div>
                  </div>
                  <StatusBadge status={svc.status} message={svc.message} />
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* URL input */}
                <div>
                  <label className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest mb-1 block">
                    {meta.urlLabel}
                  </label>
                  <Input
                    className="font-mono text-xs h-9"
                    placeholder={meta.urlPlaceholder}
                    value={svc.url}
                    onChange={(e) => update(key, "url", e.target.value)}
                  />
                </div>

                {/* Token input */}
                {meta.hasToken && (
                  <div>
                    <label className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest mb-1 block">
                      {meta.tokenLabel}
                    </label>
                    <div className="relative">
                      <Input
                        className="font-mono text-xs h-9 pr-10"
                        type={svc.showToken ? "text" : "password"}
                        placeholder="Token..."
                        value={svc.token}
                        onChange={(e) => update(key, "token", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => update(key, "showToken", !svc.showToken)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {svc.showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Status message */}
                {svc.message && (
                  <div className={`rounded-lg px-3 py-2 text-xs font-mono ${
                    svc.status === "ok" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                  }`}>
                    {svc.message}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => testAndSave(key)}
                    disabled={svc.status === "testing" || !svc.url}
                    className="font-orbitron text-xs h-8"
                  >
                    {svc.status === "testing" ? (
                      <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Testing...</>
                    ) : (
                      <><CheckCircle2 className="h-3 w-3 mr-1.5" />Test & Save</>
                    )}
                  </Button>

                  {svc.status === "ok" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(key)}
                      className="font-orbitron text-xs h-8 text-muted-foreground hover:text-destructive"
                    >
                      <XCircle className="h-3 w-3 mr-1.5" />Remove
                    </Button>
                  )}

                  <a
                    href={meta.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[10px] font-orbitron text-muted-foreground hover:text-primary transition-colors"
                  >
                    Docs →
                  </a>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Contabo deployment guide */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="font-orbitron text-sm text-primary tracking-wider flex items-center gap-2">
            <Server className="h-4 w-4" /> Contabo Deployment Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-6">{`# 1. Build on Replit → Download dist/
pnpm --filter @workspace/api-server run build

# 2. Transfer to Contabo (SCP or Git)
scp -r artifacts/api-server/dist user@<contabo-ip>:/srv/souqrates/

# 3. Install dependencies on server
cd /srv/souqrates && npm install --omit=dev

# 4. Configure .env on Contabo
DATABASE_URL=postgresql://...
PORT=8080
SKILLZ_BOT_TOKEN=...
SOUQ_BOT_TOKEN=...
SESSION_SECRET=...

# 5. Run with PM2 (process manager)
pm2 start dist/index.mjs --name souqrates-api
pm2 save && pm2 startup

# 6. Nginx reverse proxy (paste your domain)
#    location /api { proxy_pass http://localhost:8080; }

# 7. After Nginx is live → set Contabo Server URL above
#    The bot switches from Polling → Webhook automatically`}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
