"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Briefcase, FileText, MessageSquare, Trello, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/jobs", label: "Job Hunter", icon: Briefcase },
  { href: "/cv", label: "CV Intelligence", icon: FileText },
  { href: "/chat", label: "AI Assistant", icon: MessageSquare },
  { href: "/tracker", label: "Productivity Tracker", icon: Trello },
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

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="w-full md:w-64 border-r bg-muted/40 md:min-h-screen p-4 flex flex-col">
        <div className="flex items-center gap-2 px-2 py-4 mb-6">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight">CareerPilot</span>
        </div>
        
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                  isActive 
                    ? "bg-primary text-primary-foreground font-medium" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
      
      <main className="flex-1 bg-background">
        <div className="h-full p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
