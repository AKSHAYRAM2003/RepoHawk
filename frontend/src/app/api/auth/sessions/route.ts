import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const res = await fetch(`${FASTAPI_URL}/auth/sessions`, {
    headers: { Cookie: cookie },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
