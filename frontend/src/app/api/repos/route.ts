import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const response = await fetch(`${FASTAPI_URL}/repos/`, {
      method: "GET",
      cache: "no-store",
      headers: { Cookie: cookie },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch repositories" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Error GET:", error);
    return NextResponse.json({ error: "Internal Server Proxy Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const body = await req.json();
    
    const response = await fetch(`${FASTAPI_URL}/repos/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to communicate with agent layer" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Error POST:", error);
    return NextResponse.json({ error: "Internal Server Proxy Error" }, { status: 500 });
  }
}
