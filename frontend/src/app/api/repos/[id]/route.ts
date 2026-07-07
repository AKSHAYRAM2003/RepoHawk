import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookie = req.headers.get("cookie") || "";
    const response = await fetch(`${FASTAPI_URL}/repos/${id}`, {
      method: "GET",
      cache: "no-store",
      headers: { Cookie: cookie },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch repository details" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Error GET repo:", error);
    return NextResponse.json({ error: "Internal Server Proxy Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookie = req.headers.get("cookie") || "";
    const response = await fetch(`${FASTAPI_URL}/repos/${id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to delete repository" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Error DELETE repo:", error);
    return NextResponse.json({ error: "Internal Server Proxy Error" }, { status: 500 });
  }
}
