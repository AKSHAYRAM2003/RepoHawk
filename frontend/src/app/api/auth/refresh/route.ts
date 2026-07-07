import { NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function POST(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const res = await fetch(`${FASTAPI_URL}/auth/refresh`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  const data = await res.json();
  const headers = new Headers();
  res.headers.forEach((v, k) => { if (k.toLowerCase() === "set-cookie") headers.append(k, v); });
  return NextResponse.json(data, { status: res.status, headers });
}
