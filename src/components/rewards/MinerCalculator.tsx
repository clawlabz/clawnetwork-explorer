"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import {
  calcMinerRewardSimple,
  formatClawAmount,
  reputationBpsFromTier,
  type ReputationTier,
} from "@/lib/rewards";

interface Props {
  currentHeight: number;
  activeMiners: number;
  totalWeight: number;
}

const TIER_LABELS: Record<ReputationTier, string> = {
  newcomer: "Newcomer (< 7 days, 20%)",
  established: "Established (7–30 days, 50%)",
  veteran: "Veteran (> 30 days, 100%)",
};

const TIER_COLORS: Record<ReputationTier, string> = {
  newcomer: "text-yellow-400",
  established: "text-blue-400",
  veteran: "text-green-400",
};

export function MinerCalculator({ currentHeight, activeMiners, totalWeight }: Props) {
  const [myTier, setMyTier] = useState<ReputationTier>("newcomer");
  const [otherTier, setOtherTier] = useState<ReputationTier>("veteran");
  const [minerCount, setMinerCount] = useState(Math.max(1, activeMiners));
  const [useCustomCount, setUseCustomCount] = useState(false);

  const effectiveCount = useCustomCount ? minerCount : Math.max(1, activeMiners);
  const myBps = reputationBpsFromTier(myTier);
  const otherBps = reputationBpsFromTier(otherTier);

  const estimate = calcMinerRewardSimple({
    height: currentHeight,
    myReputationBps: myBps,
    totalMiners: effectiveCount,
    othersReputationBps: otherBps,
  });

  const rows = [
    { label: "Per Block", value: estimate.perBlock },
    { label: "Per Hour (1,200 blocks)", value: estimate.perHour },
    { label: "Per Day (28,800 blocks)", value: estimate.perDay },
    { label: "Per Month (30 days)", value: estimate.perMonth },
    { label: "Per Year (est.)", value: estimate.perYear },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface/50 p-5">
      <div className="flex items-center gap-2 mb-5">
        <Calculator className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Miner Reward Calculator</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-4">
          {/* My reputation */}
          <div>
            <label className="text-xs text-muted uppercase tracking-wider block mb-2">My Reputation Tier</label>
            <div className="space-y-2">
              {(["newcomer", "established", "veteran"] as ReputationTier[]).map((tier) => (
                <label key={tier} className="flex items-center gap-3 cursor-pointer group">
                  <div
                    className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                      myTier === tier ? "border-primary bg-primary/20" : "border-border group-hover:border-primary/50"
                    }`}
                    onClick={() => setMyTier(tier)}
                  >
                    {myTier === tier && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  </div>
                  <span
                    className={`text-sm cursor-pointer select-none ${TIER_COLORS[tier]}`}
                    onClick={() => setMyTier(tier)}
                  >
                    {TIER_LABELS[tier]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Other miners' reputation */}
          <div>
            <label className="text-xs text-muted uppercase tracking-wider block mb-2">Other Miners Avg. Tier</label>
            <select
              value={otherTier}
              onChange={(e) => setOtherTier(e.target.value as ReputationTier)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              {(["newcomer", "established", "veteran"] as ReputationTier[]).map((tier) => (
                <option key={tier} value={tier}>{TIER_LABELS[tier]}</option>
              ))}
            </select>
          </div>

          {/* Miner count */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted uppercase tracking-wider">Total Active Miners</label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted">
                <input
                  type="checkbox"
                  checked={useCustomCount}
                  onChange={(e) => setUseCustomCount(e.target.checked)}
                  className="accent-primary"
                />
                Custom
              </label>
            </div>
            {useCustomCount ? (
              <input
                type="number"
                min={1}
                max={10000}
                value={minerCount}
                onChange={(e) => setMinerCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none font-[JetBrains_Mono]"
              />
            ) : (
              <div className="rounded-lg border border-border bg-border/20 px-3 py-2 text-sm font-[JetBrains_Mono] text-primary">
                {activeMiners} <span className="text-muted font-normal text-xs">(live from chain)</span>
              </div>
            )}
          </div>

          {/* Pool share */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
            <div className="text-xs text-muted mb-1">Your share of miner pool</div>
            <div className="text-xl font-bold text-primary font-[JetBrains_Mono]">
              {estimate.sharePercent < 0.01 ? "< 0.01" : estimate.sharePercent.toFixed(2)}%
            </div>
            <div className="text-xs text-muted mt-1">
              Pool: {formatClawAmount(estimate.poolPerBlock, 2)} CLAW/block
            </div>
          </div>
        </div>

        {/* Results */}
        <div>
          <div className="text-xs text-muted uppercase tracking-wider mb-3">Expected Earnings</div>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div
                key={row.label}
                className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                  i === 2 ? "border border-primary/30 bg-primary/10" : "border border-border/50 bg-surface/30"
                }`}
              >
                <span className="text-sm text-muted">{row.label}</span>
                <span className={`font-[JetBrains_Mono] text-sm font-bold ${i === 2 ? "text-primary text-base" : "text-text"}`}>
                  {formatClawAmount(row.value, i === 0 ? 4 : 2)}
                  <span className="text-muted font-normal ml-1 text-xs">CLAW</span>
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted/60 mt-3">
            * Estimates assume constant block height and miner count. Actual rewards depend on pool balance and real-time network state.
          </p>
        </div>
      </div>
    </div>
  );
}
