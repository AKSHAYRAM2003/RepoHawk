import { NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000/api/v1";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${FASTAPI_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    const headers = new Headers();
    res.headers.forEach((v, k) => { if (k.toLowerCase() === "set-cookie") headers.append(k, v); });
    return NextResponse.json(data, { status: res.status, headers });
  } catch (err) {
    return NextResponse.json({ detail: "Backend service unavailable" }, { status: 502 });
  }
}
