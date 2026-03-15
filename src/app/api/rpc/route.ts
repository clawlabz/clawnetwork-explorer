import { NextRequest, NextResponse } from "next/server";
import { RPC_URL } from "@/lib/config";

const ALLOWED_METHODS = new Set([
  "clw_blockNumber", "clw_getBlockByNumber", "clw_getBalance",
  "clw_getNonce", "clw_getAgent", "clw_getReputation",
  "clw_getServices", "clw_getTransactionByHash", "clw_getTransactionsByAddress",
  "clw_listTokens", "clw_getValidators",
  "clw_getContractInfo", "clw_getContractCode",
  "clw_getContractStorage", "clw_callContractView",
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!ALLOWED_METHODS.has(body?.method)) {
      return NextResponse.json({ error: "Method not allowed" }, { status: 403 });
    }

    const rpcBody = { jsonrpc: "2.0", id: body.id ?? 1, ...body };
    const res = await fetch(RPC_URL.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcBody),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: { message: "RPC node unavailable" } }, { status: 502 });
  }
}
