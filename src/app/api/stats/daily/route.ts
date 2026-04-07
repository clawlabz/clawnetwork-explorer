import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const network = req.nextUrl.searchParams.get("network") || "mainnet";
  const days = Math.min(Number(req.nextUrl.searchParams.get("days") || "90"), 365);

  try {
    const rows = await query<{
      date: string;
      tx_count: string;
      transfer_volume: string;
      unique_senders: string;
      unique_receivers: string;
      active_addresses: string;
      type_distribution: Record<string, number> | null;
      daily_total_fees: string;
      daily_avg_fee: string;
    }>(
      `SELECT
         d.date, d.tx_count, d.transfer_volume, d.unique_senders, d.unique_receivers,
         d.type_distribution,
         COALESCE(a.active_addresses, d.unique_senders) AS active_addresses,
         COALESCE(d.daily_total_fees, '0') AS daily_total_fees,
         COALESCE(d.daily_avg_fee, '0') AS daily_avg_fee
       FROM explorer_daily_stats d
       LEFT JOIN LATERAL (
         SELECT COUNT(DISTINCT addr)::TEXT AS active_addresses FROM (
           SELECT from_addr AS addr FROM explorer_transactions
           WHERE network = $1 AND DATE(TO_TIMESTAMP(timestamp)) = d.date
           UNION
           SELECT to_addr AS addr FROM explorer_transactions
           WHERE network = $1 AND DATE(TO_TIMESTAMP(timestamp)) = d.date AND to_addr IS NOT NULL
         ) t
       ) a ON true
       WHERE d.network = $1 AND d.date >= CURRENT_DATE - $3::int
       ORDER BY d.date ASC`,
      [network, network, days],
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
