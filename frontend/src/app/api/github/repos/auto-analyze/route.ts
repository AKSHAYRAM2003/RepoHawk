import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function PUT(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const body = await req.json();
    const response = await fetch(`${FASTAPI_URL}/github/repos/auto-analyze`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    });
    if (!response.ok) return NextResponse.json({ error: "Failed" }, { status: response.status });
    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal Server Proxy Error" }, { status: 500 });
  }
}
