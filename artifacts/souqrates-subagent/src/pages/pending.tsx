import { useEffect } from "react";
import { useLocation } from "wouter";
import { Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
type ApplicationStatus = {
  application: {
    id: number;
    status: "pending" | "approved" | "rejected";
    fullName: string;
    reviewNote?: string | null;
    createdAt: string;
  };
  skzBalance?: number;
};

export default function PendingPage() {
  const [, navigate] = useLocation();
  const TELEGRAM_ID = localStorage.getItem("telegram_id") ?? "demo_user_001";

  const { data, isLoading, refetch } = useQuery<ApplicationStatus>({
    queryKey: ["subagent-me", TELEGRAM_ID],
    queryFn: async () => {
      const res = await fetch(`/api/subagent/me?telegram_id=${TELEGRAM_ID}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (data?.application?.status === "approved") {
      navigate("/dashboard");
    }
  }, [data, navigate]);

  const status = data?.application?.status;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full animate-slide-up text-center">
        <div className="mb-6">
          {isLoading ? (
            <RefreshCw className="h-16 w-16 text-muted-foreground mx-auto animate-spin" />
          ) : status === "pending" ? (
            <div className="relative mx-auto w-20 h-20">
              <Clock className="h-20 w-20 text-primary animate-pulse" />
            </div>
          ) : status === "approved" ? (
            <CheckCircle className="h-20 w-20 text-green-500 mx-auto" />
          ) : (
            <XCircle className="h-20 w-20 text-destructive mx-auto" />
          )}
        </div>

        {!isLoading && (
          <>
            <h1 className="text-2xl font-orbitron font-bold text-foreground mb-2">
              {status === "pending" && "Under Review"}
              {status === "approved" && "Approved"}
              {status === "rejected" && "Not Approved"}
            </h1>

            <p className="text-sm text-muted-foreground font-orbitron mb-6 leading-relaxed">
              {status === "pending" &&
                "Your partner application is being reviewed. You will be notified once a decision is made."}
              {status === "approved" &&
                "Congratulations! Your subagent access has been activated."}
              {status === "rejected" &&
                "Your application was not approved at this time."}
            </p>

            {data?.application?.reviewNote && (
              <div className="bg-card border border-border rounded-xl p-4 mb-6 text-left">
                <p className="text-xs font-orbitron text-muted-foreground uppercase tracking-widest mb-1">
                  Admin Note
                </p>
                <p className="text-sm text-foreground">{data.application.reviewNote}</p>
              </div>
            )}

            {status === "pending" && (
              <div className="space-y-3">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <p className="text-xs text-primary/80 font-orbitron">
                    Review takes 24–48 hours. This page auto-refreshes every 15 seconds.
                  </p>
                </div>
                <button
                  onClick={() => refetch()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground font-orbitron text-xs tracking-wider transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Check Status Now
                </button>
              </div>
            )}

            {status === "approved" && (
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-orbitron font-bold tracking-wider text-sm hover:opacity-90 transition-all"
              >
                Go to Dashboard
              </button>
            )}

            {status === "rejected" && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                <p className="text-xs text-destructive/80 font-orbitron">
                  Contact support if you believe this decision was made in error.
                </p>
              </div>
            )}

            {data?.application?.createdAt && (
              <p className="text-[10px] text-muted-foreground mt-6 font-orbitron">
                Applied: {new Date(data.application.createdAt).toLocaleDateString()}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
