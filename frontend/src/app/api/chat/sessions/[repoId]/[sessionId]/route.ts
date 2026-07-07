import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ repoId: string; sessionId: string }> }
) {
  const { repoId, sessionId } = await params;

  if (!repoId || !sessionId) {
    return NextResponse.json({ error: "Missing repoId or sessionId" }, { status: 400 });
  }
  console.log(`[Proxy] DELETE session: ${repoId} / ${sessionId}`);

  try {
    const cookie = req.headers.get("cookie") || "";
    const r = await fetch(`${FASTAPI_URL}/chat/sessions/${repoId}/${sessionId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookie },
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (err) {
    console.error("Proxy: failed to delete session", err);
    return NextResponse.json({ error: "Chat service unreachable" }, { status: 502 });
  }
}
