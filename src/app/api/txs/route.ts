import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const page = Math.max(1, Number(params.get("page")) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get("limit")) || DEFAULT_LIMIT));
  const txType = params.get("tx_type");
  const address = params.get("address");
  const fromTs = params.get("from_ts");
  const toTs = params.get("to_ts");

  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from("explorer_transactions")
    .select("hash, tx_type, type_name, from_addr, to_addr, amount, fee, nonce, block_height, tx_index, timestamp, success", { count: "exact" })
    .eq("network", "mainnet")
    .not("tx_type", "in", "(15,16)") // Hide MinerRegister/MinerHeartbeat
    .order("block_height", { ascending: false })
    .order("tx_index", { ascending: false })
    .range(offset, offset + limit - 1);

  if (txType !== null && txType !== "") {
    query = query.eq("tx_type", Number(txType));
  }

  if (address) {
    const addr = address.toLowerCase();
    query = query.or(`from_addr.eq.${addr},to_addr.eq.${addr}`);
  }

  if (fromTs) {
    query = query.gte("timestamp", Number(fromTs));
  }

  if (toTs) {
    query = query.lte("timestamp", Number(toTs));
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: data ?? [],
    meta: {
      total: count ?? 0,
      page,
      limit,
    },
  });
}
