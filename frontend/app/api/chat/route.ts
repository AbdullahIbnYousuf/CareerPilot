import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const body = await request.text();

  const upstream = await fetch(`${baseUrl}/chat/`, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body,
    cache: "no-store",
  });

  const headers = new Headers();
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache, no-transform");
  headers.set("Connection", "keep-alive");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
