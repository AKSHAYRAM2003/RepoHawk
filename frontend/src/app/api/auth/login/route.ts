import { NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(`${FASTAPI_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const headers = new Headers();
  res.headers.forEach((v, k) => { if (k.toLowerCase() === "set-cookie") headers.append(k, v); });
  return NextResponse.json(data, { status: res.status, headers });
}
