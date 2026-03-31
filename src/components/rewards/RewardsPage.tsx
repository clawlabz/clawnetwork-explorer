"use client";

import { useState, useCallback, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { NetworkStatsBar } from "./NetworkStatsBar";
import { MinerCalculator } from "./MinerCalculator";
import { ValidatorCalculator } from "./ValidatorCalculator";
import { NodeLookup } from "./NodeLookup";
import { MinerLeaderboard } from "./MinerLeaderboard";
import { RewardMechanismDocs } from "./RewardMechanismDocs";
import type { MinerInfo } from "@/app/rewards/page";
import type { NetworkId } from "@/lib/config";

interface Props {
  initialHeight: number;
  initialMiners: MinerInfo[];
  validatorCount: number;
  initialTotalValidatorWeight: number;
  network: NetworkId;
}

const AUTO_REFRESH_MS = 30_000;

export function RewardsPage({
  initialHeight,
  initialMiners,
  validatorCount,
  initialTotalValidatorWeight,
  network,
}: Props) {
  const [height, setHeight] = useState(initialHeight);
  const [miners, setMiners] = useState(initialMiners);
  const [totalValidatorWeight, setTotalValidatorWeight] = useState(initialTotalValidatorWeight);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const activeMiners = miners.filter((m) => m.active);
  const totalMinerWeight = activeMiners.reduce((sum, m) => sum + m.reputation_bps, 0);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/rewards-data?network=${network}`);
      if (res.ok) {
        const data = await res.json();
        setHeight(data.height);
        setMiners(data.miners);
        if (data.totalValidatorWeight != null) {
          setTotalValidatorWeight(data.totalValidatorWeight);
        }
        setLastRefreshed(new Date());
      }
    } catch {
      // keep stale data on error
    } finally {
      setRefreshing(false);
    }
  }, [network]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(refresh, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Node Rewards</h1>
          <p className="text-sm text-muted mt-1">
            Real-time earnings calculator and network stats for ClawNetwork nodes.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface/50 px-3 py-2 text-xs text-muted hover:border-primary/40 hover:text-text transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString()}` : "Refresh"}
        </button>
      </div>

      {/* Stats bar */}
      <NetworkStatsBar
        height={height}
        activeMiners={activeMiners.length}
        validatorCount={validatorCount}
      />

      {/* Miner calculator + Node lookup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MinerCalculator
          currentHeight={height}
          activeMiners={activeMiners.length}
          totalWeight={totalMinerWeight}
        />
        <NodeLookup
          currentHeight={height}
          totalWeight={totalMinerWeight}
          network={network}
        />
      </div>

      {/* Validator calculator */}
      <ValidatorCalculator
        currentHeight={height}
        totalValidatorWeight={totalValidatorWeight}
        validatorCount={validatorCount}
      />

      {/* Miner leaderboard */}
      <MinerLeaderboard
        miners={miners}
        currentHeight={height}
        totalWeight={totalMinerWeight}
      />

      {/* Reward mechanism docs */}
      <RewardMechanismDocs currentHeight={height} />
    </div>
  );
}
