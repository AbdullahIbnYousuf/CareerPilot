"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Compass, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="cp-app-bg relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[rgba(201,130,74,0.08)] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-[rgba(242,214,162,0.04)] rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--cp-border-medium)] bg-[var(--cp-surface)] shadow-lg shadow-[var(--cp-glow-copper)] mb-4">
            <Compass className="h-6 w-6 text-[var(--cp-champagne)]" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-[var(--cp-text-main)] tracking-normal">CareerPilot</h1>
          <p className="text-sm text-[var(--cp-text-muted)] mt-1">Your agentic career co-pilot</p>
        </div>

        {/* Card */}
        <div className="cp-surface-elevated rounded-2xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[var(--cp-text-main)]">Welcome back</h2>
            <p className="text-sm text-[var(--cp-text-muted)] mt-1">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-medium text-white/50 uppercase tracking-wider">
                Email
              </label>
              <Input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-xs font-medium text-white/50 uppercase tracking-wider">
                Password
              </label>
              <Input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 mt-2 rounded-xl group"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--cp-text-muted)]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[var(--cp-champagne)] hover:text-[var(--cp-text-main)] transition-colors font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
