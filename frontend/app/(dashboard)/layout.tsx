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
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:min-h-screen bg-[#111110] border-r border-white/[0.06]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-6 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#534AB7]">
            <Briefcase className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            CareerPilot
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-[#1e1b38] text-[#AFA9EC]"
                    : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer — logout */}
        <div className="px-3 pb-5 pt-4 border-t border-white/[0.06]">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-white/40 hover:text-white/70 hover:bg-white/[0.06]"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 bg-background">
        <div className="h-full p-6 md:p-8 pb-20 md:pb-8">{children}</div>
      </main>

      {/* ── Mobile bottom tab bar (stub — styled Day 11) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-white/[0.06] bg-[#111110] px-2 py-2">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active ? "text-[#AFA9EC]" : "text-white/40"
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
