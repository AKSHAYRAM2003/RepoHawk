import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function POST(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const body = await req.json().catch(() => ({ max_age_hours: 24 }));

    const response = await fetch(`${FASTAPI_URL}/observability/gc/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to run garbage collection" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Error Run GC:", error);
    return NextResponse.json({ error: "Internal Server Proxy Error" }, { status: 500 });
  }
}
