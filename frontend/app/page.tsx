import { redirect } from "next/navigation";

// Root landing page — redirect unauthenticated users to login.
// Authenticated users are redirected to /jobs by the middleware.
// This file exists only to satisfy Next.js routing; actual home
// dashboard lives at app/(dashboard)/page.tsx.
export default function RootPage() {
  redirect("/login");
}
