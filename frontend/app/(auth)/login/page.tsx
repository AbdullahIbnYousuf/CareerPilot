"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Briefcase, ArrowRight, Loader2 } from "lucide-react";

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
    <div className="relative flex min-h-screen items-center justify-center bg-[#08080C] overflow-hidden p-4">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-[#AFA9EC]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#534AB7] to-[#7C74DB] shadow-lg shadow-primary/30 mb-4">
            <Briefcase className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">CareerPilot</h1>
          <p className="text-sm text-white/40 mt-1">Your agentic career co-pilot</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0E0E12]/80 backdrop-blur-md p-8 shadow-2xl shadow-black/60">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Welcome back</h2>
            <p className="text-sm text-white/40 mt-1">Sign in to your account to continue</p>
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
                className="h-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 focus-visible:border-primary/60 focus-visible:ring-primary/20 rounded-xl"
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
                className="h-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 focus-visible:border-primary/60 focus-visible:ring-primary/20 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 mt-2 bg-gradient-to-r from-[#534AB7] to-[#6B63CC] hover:from-[#5E55CC] hover:to-[#7A73DD] text-white font-medium rounded-xl shadow-lg shadow-primary/20 transition-all duration-200 group"
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

          <p className="mt-6 text-center text-sm text-white/30">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#AFA9EC] hover:text-white transition-colors font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
