"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  Briefcase,
  Map,
  MessageCircle,
  UserCircle,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/jobs", label: "Jobs", icon: Briefcase, exact: false },
  { href: "/journey", label: "My Journey", icon: Map, exact: false },
  { href: "/ai", label: "AI Assistant", icon: MessageCircle, exact: false },
  { href: "/profile", label: "Profile", icon: UserCircle, exact: false },
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
    <div className="flex min-h-screen flex-col md:flex-row bg-[#08080C] relative overflow-hidden">
      {/* ── Background Glowing Mesh Accents ── */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[130px] pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#AFA9EC]/4 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:min-h-screen bg-[#0E0E12] border-r border-white/[0.04] relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-6 py-6 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-[#534AB7] to-[#7C74DB] shadow-lg shadow-primary/20">
            <Briefcase className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white bg-clip-text">
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
                    ? "bg-[#1E1B3A] text-[#AFA9EC] shadow-inner shadow-white/[0.02]"
                    : "text-white/40 hover:bg-white/[0.03] hover:text-white/70"
                }`}
              >
                <item.icon className={`h-4.5 w-4.5 shrink-0 ${active ? "text-[#AFA9EC]" : "text-white/40"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer — logout */}
        <div className="px-3 pb-6 pt-4 border-t border-white/[0.04]">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/[0.03] px-4 py-3"
            onClick={handleLogout}
          >
            <LogOut className="h-4.5 w-4.5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 relative z-10 overflow-y-auto">
        <div className="h-full p-6 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto">{children}</div>
      </main>

      {/* ── Mobile bottom tab bar (stub — styled Day 11) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-white/[0.04] bg-[#0E0E12]/90 backdrop-blur-md px-2 py-3.5">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1.5 px-3 py-1 rounded-lg text-xxs font-medium transition-colors ${
                active ? "text-[#AFA9EC]" : "text-white/30"
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
