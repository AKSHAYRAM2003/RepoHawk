import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const response = await fetch(`${FASTAPI_URL}/credits/analysis`, {
      method: "GET",
      cache: "no-store",
      headers: { Cookie: cookie },
    });

    if (!response.ok) {
      // If unauthenticated, return a default "full" credits state instead of erroring
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({
          total: 5,
          used: 0,
          remaining: 5,
          window_hours: 4,
          reset_at: null,
          retry_after_seconds: null,
          chat_is_free: true,
        });
      }
      return NextResponse.json({ error: "Failed to fetch credits" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Error GET /api/credits:", error);
    // Graceful degradation: return default credits if backend unreachable
    return NextResponse.json({
      total: 5,
      used: 0,
      remaining: 5,
      window_hours: 4,
      reset_at: null,
      retry_after_seconds: null,
      chat_is_free: true,
    });
  }
}
