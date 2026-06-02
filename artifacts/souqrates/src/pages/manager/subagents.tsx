import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListSubagentApplications, useReviewSubagentApplication } from "@workspace/api-client-react";
import { Shield, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";

type Application = {
  id: number;
  telegramId: string;
  fullName: string;
  phone: string;
  email: string;
  company?: string | null;
  experience: string;
  motivation: string;
  status: "pending" | "approved" | "rejected";
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

function statusBadge(status: string) {
  if (status === "approved") return (
    <span className="flex items-center gap-1 text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 rounded-full px-2 py-0.5 font-orbitron uppercase">
      <CheckCircle className="h-3 w-3" /> Approved
    </span>
  );
  if (status === "rejected") return (
    <span className="flex items-center gap-1 text-[10px] bg-destructive/10 text-destructive border border-destructive/20 rounded-full px-2 py-0.5 font-orbitron uppercase">
      <XCircle className="h-3 w-3" /> Rejected
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full px-2 py-0.5 font-orbitron uppercase">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

function ApplicationCard({ app }: { app: Application }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewNote, setReviewNote] = useState(app.reviewNote ?? "");
  const qc = useQueryClient();

  const reviewMutation = useReviewSubagentApplication({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["subagent-applications"] });
      },
    },
  });

  function review(status: "approved" | "rejected") {
    reviewMutation.mutate({ applicationId: app.id, data: { status, reviewNote } } as Parameters<typeof reviewMutation.mutate>[0]);
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-orbitron font-bold text-foreground truncate">{app.fullName}</p>
            <p className="text-xs text-muted-foreground font-orbitron">{app.telegramId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-3 flex-shrink-0">
          {statusBadge(app.status)}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest mb-0.5">Phone</p>
              <p className="text-xs text-foreground font-orbitron">{app.phone}</p>
            </div>
            <div>
              <p className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest mb-0.5">Email</p>
              <p className="text-xs text-foreground font-orbitron">{app.email}</p>
            </div>
            {app.company && (
              <div className="col-span-2">
                <p className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest mb-0.5">Company</p>
                <p className="text-xs text-foreground font-orbitron">{app.company}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest mb-1">Experience</p>
            <p className="text-xs text-foreground leading-relaxed bg-background rounded-lg p-3">{app.experience}</p>
          </div>

          <div>
            <p className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest mb-1">Motivation</p>
            <p className="text-xs text-foreground leading-relaxed bg-background rounded-lg p-3">{app.motivation}</p>
          </div>

          <div>
            <p className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest mb-1">Applied</p>
            <p className="text-xs text-muted-foreground">{new Date(app.createdAt).toLocaleString()}</p>
          </div>

          {app.status === "pending" && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div>
                <label className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest mb-1.5 block">
                  Review Note (optional)
                </label>
                <textarea
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground font-orbitron focus:outline-none focus:border-primary/60 resize-none"
                  rows={2}
                  placeholder="Reason for approval or rejection..."
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => review("approved")}
                  disabled={reviewMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 font-orbitron text-xs font-bold tracking-wider transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Approve
                </button>
                <button
                  onClick={() => review("rejected")}
                  disabled={reviewMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 font-orbitron text-xs font-bold tracking-wider transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
              </div>
            </div>
          )}

          {app.status !== "pending" && app.reviewNote && (
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-widest mb-1">Admin Note</p>
              <p className="text-xs text-foreground">{app.reviewNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SubagentsAdmin() {
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const { data: applications = [], isLoading } = useListSubagentApplications();

  const all = applications as Application[];
  const filtered = filter === "all" ? all : all.filter((a) => a.status === filter);

  const counts = {
    all: all.length,
    pending: all.filter((a) => a.status === "pending").length,
    approved: all.filter((a) => a.status === "approved").length,
    rejected: all.filter((a) => a.status === "rejected").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-orbitron font-bold text-foreground">Subagent Applications</h2>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(["all", "pending", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`bg-card border rounded-xl p-3 text-center transition-colors ${
              filter === s ? "border-primary/50 bg-primary/5" : "border-border hover:border-border/80"
            }`}
          >
            <p className={`text-xl font-orbitron font-black ${
              s === "pending" ? "text-yellow-400" :
              s === "approved" ? "text-green-400" :
              s === "rejected" ? "text-destructive" : "text-foreground"
            }`}>{counts[s]}</p>
            <p className="text-[10px] text-muted-foreground font-orbitron uppercase tracking-widest mt-0.5 capitalize">{s}</p>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground font-orbitron text-sm">Loading applications...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-orbitron text-sm">No {filter !== "all" ? filter : ""} applications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <ApplicationCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
