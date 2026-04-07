import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const network = req.nextUrl.searchParams.get("network") || "mainnet";

  try {
    const rows = await query<{
      total_transactions: string;
      total_addresses: string;
      total_transfer_volume: string;
      last_indexed_height: string;
      updated_at: string;
    }>(
      "SELECT total_transactions, total_addresses, total_transfer_volume, last_indexed_height, updated_at FROM explorer_network_stats WHERE network = $1",
      [network],
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
