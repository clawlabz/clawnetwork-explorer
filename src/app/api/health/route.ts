import { NextRequest, NextResponse } from "next/server";
import { getRpcUrl, type NetworkId } from "@/lib/config";

function parseNetwork(req: NextRequest): NetworkId {
  const param = req.nextUrl.searchParams.get("network");
  if (param === "mainnet" || param === "testnet") return param;
  return "testnet";
}

export async function GET(req: NextRequest) {
  try {
    const network = parseNetwork(req);
    const rpcUrl = getRpcUrl(network);
    const res = await fetch(`${rpcUrl}/health`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: { message: "RPC node unavailable" } }, { status: 502 });
  }
}
