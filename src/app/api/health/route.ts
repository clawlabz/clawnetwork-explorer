import { NextResponse } from "next/server";
import { RPC_URL } from "@/lib/config";

export async function GET() {
  try {
    const res = await fetch(`${RPC_URL}/health`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: { message: "RPC node unavailable" } }, { status: 502 });
  }
}
