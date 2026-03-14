import { NextResponse } from "next/server";

const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "http://39.102.144.231:9710";

export async function GET() {
  try {
    const res = await fetch(`${RPC_URL}/health`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: { message: "RPC node unavailable" } }, { status: 502 });
  }
}
