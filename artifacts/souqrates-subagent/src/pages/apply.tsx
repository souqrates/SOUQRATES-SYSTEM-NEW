import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Send } from "lucide-react";
export default function ApplyPage() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const TELEGRAM_ID = localStorage.getItem("telegram_id") ?? "demo_user_001";

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    company: "",
    experience: "",
    motivation: "",
  });

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.fullName || !form.phone || !form.email || !form.experience || !form.motivation) {
      setError("Please fill all required fields.");
      return;
    }

    setLoading(true);
    try {
      // First ensure user exists
      const regRes = await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId: TELEGRAM_ID }),
      });
      const user = await regRes.json();
      if (!user.id) throw new Error("Could not get user");

      const res = await fetch("/api/subagent/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: TELEGRAM_ID,
          userId: user.id,
          ...form,
        }),
      });

      if (res.status === 409) {
        navigate("/pending");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Submission failed");
      }

      navigate("/pending");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground font-orbitron focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
        <div className="animate-slide-up">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-xs font-orbitron transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <h1 className="text-xl font-orbitron font-bold text-foreground mb-1">Partner Application</h1>
          <p className="text-xs text-muted-foreground font-orbitron mb-6 tracking-wide">
            Fill out all fields accurately — your info is reviewed by admin
          </p>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-xs text-destructive font-orbitron mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-widest mb-1.5 block">
                Full Name <span className="text-primary">*</span>
              </label>
              <input
                className={inputClass}
                placeholder="Your legal full name"
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-widest mb-1.5 block">
                  Phone <span className="text-primary">*</span>
                </label>
                <input
                  className={inputClass}
                  placeholder="+1 234 567 8900"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-widest mb-1.5 block">
                  Email <span className="text-primary">*</span>
                </label>
                <input
                  className={inputClass}
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-widest mb-1.5 block">
                Company / Agency
              </label>
              <input
                className={inputClass}
                placeholder="Optional — your business or agency name"
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-widest mb-1.5 block">
                Experience <span className="text-primary">*</span>
              </label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Describe your experience with crypto, trading, or digital finance..."
                value={form.experience}
                onChange={(e) => update("experience", e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-orbitron text-muted-foreground uppercase tracking-widest mb-1.5 block">
                Why SKZ Subagent? <span className="text-primary">*</span>
              </label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Explain your motivation and how you plan to use subagent access..."
                value={form.motivation}
                onChange={(e) => update("motivation", e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary text-primary-foreground font-orbitron font-bold tracking-wider text-sm hover:opacity-90 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
              ) : (
                <><Send className="h-4 w-4" /> Submit Application</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
