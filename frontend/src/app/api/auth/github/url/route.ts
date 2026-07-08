import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const { searchParams } = new URL(req.url);
  const returnUrl = searchParams.get("return_url") || "/settings";
  const res = await fetch(`${FASTAPI_URL}/auth/github/url?return_url=${encodeURIComponent(returnUrl)}`, {
    headers: { Cookie: cookie },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
