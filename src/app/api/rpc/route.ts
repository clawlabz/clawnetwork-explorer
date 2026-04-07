import { NextRequest, NextResponse } from "next/server";
import { getRpcUrl, type NetworkId } from "@/lib/config";

const ALLOWED_METHODS = new Set([
  "claw_blockNumber", "claw_getBlockByNumber", "claw_getBalance",
  "claw_getNonce", "claw_getAgent", "claw_getReputation",
  "claw_getServices", "claw_getTransactionByHash", "claw_getTransactionsByAddress",
  "claw_getValidators",
  "claw_getTokenInfo",
  "claw_getContractInfo", "claw_getContractCode",
  "claw_getContractStorage", "claw_callContractView",
  "claw_getAgentScore",
  "claw_getStakeDelegation",
  "claw_getValidatorDetail",
  "claw_estimateFee",
  "claw_getMinerInfo",
  "claw_getMiners",
  "claw_getMiningStats",
  "claw_getRecentTransactions",
  "claw_getTokens",
  "claw_getTokenHolders",
  "claw_getTransactionReceipt",
  "claw_totalSupply",
  "claw_getSupplyInfo",
  "claw_getTransactionCount",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function parseNetwork(req: NextRequest): NetworkId {
  const param = req.nextUrl.searchParams.get("network");
  if (param === "mainnet" || param === "testnet") return param;
  return "mainnet";
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!ALLOWED_METHODS.has(body?.method)) {
      return NextResponse.json({ error: "Method not allowed" }, { status: 403, headers: CORS_HEADERS });
    }

    const network = parseNetwork(req);
    const rpcUrl = getRpcUrl(network);

    const rpcBody = { jsonrpc: "2.0", id: body.id ?? 1, ...body };
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcBody),
    });
    const data = await res.json();
    return NextResponse.json(data, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ error: { message: "RPC node unavailable" } }, { status: 502, headers: CORS_HEADERS });
  }
}
