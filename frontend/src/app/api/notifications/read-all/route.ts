import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function PUT(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const response = await fetch(`${FASTAPI_URL}/notifications/read-all`, {
      method: "PUT",
      headers: { Cookie: cookie },
    });
    if (!response.ok) return NextResponse.json({ error: "Failed" }, { status: response.status });
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ error: "Internal Server Proxy Error" }, { status: 500 });
  }
}
