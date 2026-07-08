import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const url = new URL(req.url);
    const limit = url.searchParams.get("limit") || "20";
    const offset = url.searchParams.get("offset") || "0";
    const unreadOnly = url.searchParams.get("unread_only") || "false";
    const response = await fetch(
      `${FASTAPI_URL}/notifications/?limit=${limit}&offset=${offset}&unread_only=${unreadOnly}`,
      { headers: { Cookie: cookie }, cache: "no-store" }
    );
    if (!response.ok) return NextResponse.json({ error: "Failed to fetch notifications" }, { status: response.status });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Error GET /notifications:", error);
    return NextResponse.json({ error: "Internal Server Proxy Error" }, { status: 500 });
  }
}
