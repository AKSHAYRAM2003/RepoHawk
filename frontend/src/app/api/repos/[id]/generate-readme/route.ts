import { NextResponse } from 'next/server';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8003/api/v1";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookie = req.headers.get("cookie") || "";
    
    // We proxy the GET request to FastAPI and forward the stream
    const upstream = await fetch(`${FASTAPI_URL}/repos/${id}/generate-readme`, {
      method: "GET",
      headers: { 
        Cookie: cookie,
        Accept: "text/event-stream"
      },
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: `Generate README error: ${upstream.status} ${text}` },
        { status: upstream.status }
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
          reader.releaseLock();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Proxy Error GET generate-readme:", error);
    return NextResponse.json({ error: "Internal Server Proxy Error" }, { status: 500 });
  }
}
