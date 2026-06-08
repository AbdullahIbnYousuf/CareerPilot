"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Briefcase,
  Compass,
  Map,
  MessageCircle,
  UserCircle,
  LogOut,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopilotWidget } from "@/components/copilot-widget";

const navItems = [
  { href: "/tracker", label: "My Journey", icon: Map, exact: false },
  { href: "/jobs", label: "Jobs", icon: Briefcase, exact: false },
  { href: "/chat", label: "AI Assistant", icon: MessageCircle, exact: false },
  { href: "/cv", label: "Profile", icon: UserCircle, exact: false },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActive = (item: (typeof navItems)[0]) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <div className="cp-app-bg flex min-h-screen flex-col md:flex-row relative overflow-hidden">
      {/* ── Background Glowing Mesh Accents ── */}
      <div className="no-print absolute top-0 right-0 w-[620px] h-[620px] rounded-full bg-[rgba(201,130,74,0.06)] blur-[140px] pointer-events-none z-0" />
      <div className="no-print absolute bottom-0 left-0 w-[420px] h-[420px] rounded-full bg-[rgba(242,214,162,0.035)] blur-[110px] pointer-events-none z-0" />

      {/* ── Sidebar (desktop) ── */}
      <aside className="no-print hidden md:flex md:w-64 md:flex-col md:min-h-screen bg-[var(--cp-bg-deep)]/95 border-r border-[var(--cp-border-soft)] relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 mb-4">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--cp-border-medium)] bg-[var(--cp-surface)] shadow-lg shadow-[var(--cp-glow-copper)]">
            <Compass className="h-5 w-5 text-[var(--cp-champagne)]" />
            <Sparkles className="absolute -right-1 -top-1 h-3 w-3 text-[var(--cp-copper-strong)]" />
          </div>
          <span className="font-display text-2xl font-semibold tracking-normal text-[var(--cp-text-main)]">
            CareerPilot
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1.5">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "cp-active-glow bg-[rgba(201,130,74,0.12)] text-[var(--cp-champagne)]"
                    : "text-[var(--cp-text-muted)] hover:bg-[rgba(255,255,255,0.035)] hover:text-[var(--cp-text-soft)]"
                }`}
              >
                <item.icon className={`h-4.5 w-4.5 shrink-0 ${active ? "text-[var(--cp-copper-strong)]" : "text-[var(--cp-text-subtle)]"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer — logout */}
        <div className="px-3 pb-6 pt-4 border-t border-[var(--cp-border-soft)]">
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-[var(--cp-border-soft)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(201,130,74,0.14)] text-xs font-bold text-[var(--cp-champagne)]">
              CP
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[var(--cp-text-soft)]">
                Workspace
              </p>
              <p className="truncate text-[10px] text-[var(--cp-text-subtle)]">
                Premium pathfinder
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-xl px-4 py-3"
            onClick={handleLogout}
          >
            <LogOut className="h-4.5 w-4.5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="min-w-0 flex-1 relative z-10 overflow-y-auto">
        <div className="h-full w-full min-w-0 p-6 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto">{children}</div>
      </main>

      <div className="no-print">
        <CopilotWidget />
      </div>

      {/* ── Mobile bottom tab bar (stub — styled Day 11) ── */}
      <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-[var(--cp-border-soft)] bg-[var(--cp-bg-deep)]/90 backdrop-blur-md px-2 py-3.5">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1.5 px-3 py-1 rounded-lg text-xxs font-medium transition-colors ${
                active ? "text-[var(--cp-champagne)]" : "text-[var(--cp-text-subtle)]"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
