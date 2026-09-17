import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cookie = req.headers.get("cookie") || "";

  let upstream: Response;
  try {
    upstream = await fetch(`${FASTAPI_URL}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("Proxy: failed to reach FastAPI", err);
    return NextResponse.json({ error: "Chat service unreachable" }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    let errorMessage = `Chat service error: ${upstream.status}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed.detail) errorMessage = parsed.detail;
      else if (parsed.error) errorMessage = parsed.error;
    } catch {
      if (text) errorMessage = text;
    }

    const headers: Record<string, string> = {};
    const retryAfter = upstream.headers.get("Retry-After");
    if (retryAfter) {
      headers["Retry-After"] = retryAfter;
    }

    return NextResponse.json(
      { error: errorMessage, retryAfter: retryAfter ? Number(retryAfter) : undefined },
      { status: upstream.status, headers }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          controller.enqueue(encoder.encode(decoder.decode(value, { stream: true })));
        }
        controller.close();
      } catch (err) {
        console.error("Proxy: stream error", err);
        controller.error(err);
      } finally {
        try { reader.releaseLock(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
