import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") || "50";
    const cookie = req.headers.get("cookie") || "";

    const response = await fetch(`${FASTAPI_URL}/observability/ai?limit=${limit}`, {
      method: "GET",
      cache: "no-store",
      headers: { Cookie: cookie },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch AI telemetry" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Error AI Telemetry:", error);
    return NextResponse.json({ error: "Internal Server Proxy Error" }, { status: 500 });
  }
}
