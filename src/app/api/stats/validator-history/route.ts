import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const network = req.nextUrl.searchParams.get("network") || "mainnet";
  const address = req.nextUrl.searchParams.get("address");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || "100"), 500);

  try {
    let rows;
    if (address) {
      rows = await query<{
        epoch: number;
        validator_address: string;
        stake: string;
        weight: number;
        agent_score: number;
        recorded_at: string;
      }>(
        `SELECT epoch, validator_address, stake, weight, agent_score, recorded_at
         FROM explorer_validator_history
         WHERE network = $1 AND validator_address = $2
         ORDER BY epoch DESC LIMIT $3`,
        [network, address, limit],
      );
    } else {
      // Latest epoch snapshot for all validators
      rows = await query<{
        epoch: number;
        validator_address: string;
        stake: string;
        weight: number;
        agent_score: number;
        recorded_at: string;
      }>(
        `SELECT epoch, validator_address, stake, weight, agent_score, recorded_at
         FROM explorer_validator_history
         WHERE network = $1 AND epoch = (
           SELECT MAX(epoch) FROM explorer_validator_history WHERE network = $1
         )
         ORDER BY weight DESC`,
        [network],
      );
    }
    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
