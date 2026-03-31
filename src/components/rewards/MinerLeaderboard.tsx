"use client";

import { Trophy } from "lucide-react";
import { calcMinerReward, formatClawAmount, reputationTierFromAge, type ReputationTier } from "@/lib/rewards";
import type { MinerInfo } from "@/app/rewards/page";
import { truncateAddress, toHexAddress } from "@/lib/rpc";

interface Props {
  miners: MinerInfo[];
  currentHeight: number;
  totalWeight: number;
}

const TIER_COLORS: Record<ReputationTier, string> = {
  newcomer: "text-yellow-400",
  established: "text-blue-400",
  veteran: "text-green-400",
};

export function MinerLeaderboard({ miners, currentHeight, totalWeight }: Props) {
  const rows = miners
    .filter((m) => m.active)
    .map((m) => {
      const tier = reputationTierFromAge(m.registered_at, currentHeight);
      const estimate = calcMinerReward(currentHeight, m.reputation_bps, totalWeight);
      return { ...m, tier, estimate, address: toHexAddress(m.address) || String(m.address) };
    })
    .sort((a, b) => b.reputation_bps - a.reputation_bps);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface/50 p-8 text-center text-muted text-sm">
        No active miners found on this network.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface/50 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Trophy className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Active Miners</h2>
        <span className="ml-auto text-xs text-muted">{rows.length} nodes</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left w-10">#</th>
              <th className="px-4 py-3 text-left">Address</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Name</th>
              <th className="px-4 py-3 text-left">Reputation</th>
              <th className="px-4 py-3 text-right">Pool Share</th>
              <th className="px-4 py-3 text-right">Per Day</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Last Heartbeat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const blocksSinceHb = currentHeight - row.last_heartbeat;
              const hbOk = blocksSinceHb < 1000;

              return (
                <tr key={row.address} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                  <td className="px-4 py-3 font-[JetBrains_Mono] text-xs text-muted">#{i + 1}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`/address/${row.address}`}
                      className="font-[JetBrains_Mono] text-xs text-primary hover:underline"
                    >
                      {truncateAddress(row.address, 6)}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted hidden md:table-cell">
                    {row.name || <span className="text-muted/30">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold capitalize ${TIER_COLORS[row.tier]}`}>
                        {row.tier}
                      </span>
                      <span className="font-[JetBrains_Mono] text-xs text-muted">
                        {row.reputation_bps.toLocaleString()} bps
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-[JetBrains_Mono] text-xs">
                    <span className="text-primary font-bold">
                      {row.estimate.sharePercent < 0.01 ? "< 0.01" : row.estimate.sharePercent.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-[JetBrains_Mono] text-xs font-bold">
                    {formatClawAmount(row.estimate.perDay, 2)}
                    <span className="text-muted font-normal ml-1">CLAW</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`text-xs font-[JetBrains_Mono] ${hbOk ? "text-muted" : "text-red-400"}`}>
                      #{row.last_heartbeat.toLocaleString()}
                      {!hbOk && <span className="ml-1 text-[10px] text-red-400">stale</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
