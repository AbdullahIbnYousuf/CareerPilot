import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Briefcase } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mx-auto flex max-w-[600px] flex-col items-center justify-center text-center space-y-6">
        <div className="rounded-full bg-primary/10 p-4">
          <Briefcase className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
          CareerPilot
        </h1>
        <p className="text-xl text-muted-foreground">
          Your agentic career co-pilot. Hunts jobs, scores CV fit, drafts cover letters, and tracks applications.
        </p>
        <div className="flex gap-4 pt-4">
          <Button asChild size="lg">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/signup">Create Account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
