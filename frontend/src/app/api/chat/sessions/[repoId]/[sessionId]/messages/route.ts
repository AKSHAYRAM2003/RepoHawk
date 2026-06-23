import { NextResponse } from 'next/server';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8003/api/v1";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ repoId: string; sessionId: string }> }
) {
  const { repoId, sessionId } = await params;

  if (!repoId || !sessionId) {
    return NextResponse.json({ error: "Missing repoId or sessionId" }, { status: 400 });
  }

  try {
    const cookie = req.headers.get("cookie") || "";
    const r = await fetch(`${FASTAPI_URL}/chat/sessions/${repoId}/${sessionId}/messages`, {
      method: "GET",
      headers: { "Content-Type": "application/json", Cookie: cookie },
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (err) {
    console.error("Proxy: failed to get session messages", err);
    return NextResponse.json({ error: "Chat service unreachable" }, { status: 502 });
  }
}
