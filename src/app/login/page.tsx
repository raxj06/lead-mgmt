"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STATUSES, STATUS_DOT, STATUS_LABEL, type Status } from "@/lib/types";

function FlowLine() {
  return (
    <div className="flex items-center gap-1.5 mt-6" aria-hidden="true">
      {STATUSES.map((s: Status, i) => (
        <div key={s} className="flex items-center gap-1.5">
          <div className="flex flex-col items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]} ring-2 ring-white/20`} />
            <span className="text-[10px] text-white/60">{STATUS_LABEL[s]}</span>
          </div>
          {i < STATUSES.length - 1 && <span className="h-px w-4 bg-[#298DFF]/60 mb-4" />}
        </div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name || email.split("@")[0] } },
        });
        if (error) throw error;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Sign-in failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6FA] p-4">
      <div className="w-full max-w-3xl grid md:grid-cols-2 overflow-hidden rounded-2xl border border-[#E4E9F2] bg-white shadow-xl">
        <div className="hidden md:flex flex-col justify-between bg-[#0B0E13] p-8 text-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#298DFF] font-display text-lg font-bold">B</span>
              <span className="font-display text-lg font-bold">Boostify CRM</span>
            </div>
            <h2 className="font-display mt-8 text-3xl font-bold leading-tight">
              We automate,
              <br />
              you elevate.
            </h2>
            <p className="mt-3 text-sm text-white/70">
              Internal lead pipeline for the Boostify team — import, assign, call, convert.
            </p>
          </div>
          <FlowLine />
        </div>

        <form onSubmit={submit} className="space-y-3 p-6 sm:p-8">
          <div className="md:hidden flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#298DFF] font-display text-lg font-bold text-white">B</span>
            <span className="font-display text-lg font-bold text-[#0B0E13]">Boostify CRM</span>
          </div>
          <h1 className="font-display text-xl font-bold text-[#0B0E13]">
            {mode === "in" ? "Welcome back" : "Create team account"}
          </h1>
          <p className="text-sm text-[#5B6472]">
            {mode === "in" ? "Sign in to manage your leads." : "One account per teammate."}
          </p>
          {mode === "up" && (
            <label className="block text-sm font-medium text-[#0B0E13]">
              Your name
              <input
                className="field mt-1"
                placeholder="e.g. Raj Vasoya"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label className="block text-sm font-medium text-[#0B0E13]">
            Email
            <input
              className="field mt-1"
              placeholder="you@boostifycorp.in"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-[#0B0E13]">
            Password
            <input
              className="field mt-1"
              placeholder="••••••••"
              type="password"
              required
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {err && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </p>
          )}
          <button disabled={loading} className="btn-primary w-full py-2.5 disabled:opacity-50">
            {loading ? (mode === "in" ? "Signing in…" : "Creating account…") : mode === "in" ? "Sign in" : "Sign up"}
          </button>
          <button
            type="button"
            className="text-sm text-[#298DFF] hover:underline"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setErr("");
            }}
          >
            {mode === "in" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
