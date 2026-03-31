import { NextRequest, NextResponse } from "next/server";
import { getBlockNumber, getMiners, getValidators } from "@/lib/rpc";
import type { NetworkId } from "@/lib/config";

function parseNetwork(req: NextRequest): NetworkId {
  const param = req.nextUrl.searchParams.get("network");
  if (param === "mainnet" || param === "testnet") return param;
  return "mainnet";
}

export async function GET(req: NextRequest) {
  const network = parseNetwork(req);

  const [height, rawMiners, rawValidators] = await Promise.all([
    getBlockNumber(network).catch(() => 0),
    getMiners(true, 200, network).catch(() => []),
    getValidators(network).catch(() => []),
  ]);

  const validators = rawValidators as Array<{ weight?: number }>;
  const totalValidatorWeight = validators.reduce((sum, v) => sum + (v.weight ?? 0), 0);

  return NextResponse.json({ height, miners: rawMiners, totalValidatorWeight });
}
