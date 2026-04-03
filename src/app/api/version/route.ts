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
    const res = await fetch(`${rpcUrl}/version`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: { message: "Version endpoint not available" } }, { status: 404 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: { message: "RPC node unavailable" } }, { status: 502 });
  }
}
