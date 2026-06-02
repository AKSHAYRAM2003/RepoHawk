import { NextResponse } from 'next/server';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8003/api/v1";

/**
 * GET /api/chat/sessions?repo_id=...
 * List all chat sessions for a repo.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const repoId = url.searchParams.get("repo_id");
  if (!repoId) {
    return NextResponse.json({ error: "Missing repo_id" }, { status: 400 });
  }
  try {
    const r = await fetch(`${FASTAPI_URL}/chat/sessions/${repoId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (err) {
    console.error("Proxy: failed to list sessions", err);
    return NextResponse.json({ error: "Chat service unreachable" }, { status: 502 });
  }
}
