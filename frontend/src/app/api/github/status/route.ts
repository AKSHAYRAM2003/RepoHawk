import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const response = await fetch(`${FASTAPI_URL}/github/status`, {
      headers: { Cookie: cookie },
      cache: "no-store"
    });
    if (!response.ok) return NextResponse.json({ connected: false });
    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ connected: false });
  }
}
