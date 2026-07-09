import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const res = await fetch(`${FASTAPI_URL}/notifications/preferences`, {
    headers: { Cookie: cookie },
  });
  if (!res.ok) return NextResponse.json({
    push_events: false, pull_requests: false,
    analysis_complete: true, analysis_failed: true,
    in_app: true, email: false,
  });
  const data = await res.json();
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const body = await req.json();
  const res = await fetch(`${FASTAPI_URL}/notifications/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
