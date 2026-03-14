import { NextRequest, NextResponse } from "next/server";

const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "http://39.102.144.231:9710";

const ALLOWED_METHODS = new Set([
  "clw_blockNumber", "clw_getBlockByNumber", "clw_getBalance",
  "clw_getNonce", "clw_getAgent", "clw_getReputation",
  "clw_getServices", "clw_getTransactionByHash", "clw_getTransactionsByAddress",
  "clw_listTokens", "clw_getValidators",
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!ALLOWED_METHODS.has(body?.method)) {
      return NextResponse.json({ error: "Method not allowed" }, { status: 403 });
    }

    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: { message: "RPC node unavailable" } }, { status: 502 });
  }
}
