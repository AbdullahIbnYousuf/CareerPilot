import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CareerPilot — Your Agentic AI Career Co-Pilot",
  description:
    "An agentic co-pilot that hunts jobs, programmatically scores CV fit, drafts context-aware cover letters, and tracks your journey with visual productivity dashboards.",
  keywords: [
    "AI career assistant",
    "Job hunter agent",
    "CV parsing",
    "Vector search",
    "RAG",
    "Productivity tracker",
    "Codesprint 2026",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
