import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");
    if (!path) {
      return NextResponse.json({ error: "path query parameter is required" }, { status: 400 });
    }
    const cookie = req.headers.get("cookie") || "";
    const response = await fetch(
      `${FASTAPI_URL}/repos/${id}/file?path=${encodeURIComponent(path)}`,
      { headers: { Cookie: cookie } }
    );
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Error GET repo file:", error);
    return NextResponse.json({ error: "Internal Server Proxy Error" }, { status: 500 });
  }
}
