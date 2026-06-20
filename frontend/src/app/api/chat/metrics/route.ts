import { NextResponse } from 'next/server';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8003/api/v1";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }
  try {
    const cookie = req.headers.get("cookie") || "";
    const r = await fetch(`${FASTAPI_URL}/chat/metrics/${sessionId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", Cookie: cookie },
    });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (err) {
    console.error("Proxy: failed to get metrics", err);
    return NextResponse.json({ error: "Chat service unreachable" }, { status: 502 });
  }
}
