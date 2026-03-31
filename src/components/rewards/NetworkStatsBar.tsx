"use client";

import { Blocks, Users, Zap, Database, TrendingDown } from "lucide-react";
import {
  rewardPerBlock,
  miningPoolPerBlock,
  getCurrentPeriod,
  formatClawAmount,
  BLOCKS_PER_DAY,
} from "@/lib/rewards";

interface Props {
  height: number;
  activeMiners: number;
  validatorCount: number;
}

export function NetworkStatsBar({ height, activeMiners, validatorCount }: Props) {
  const reward = rewardPerBlock(height);
  const miningPool = miningPoolPerBlock(height);
  const period = getCurrentPeriod(height);
  const dailyMinerPool = miningPool * BigInt(BLOCKS_PER_DAY);

  const stats = [
    {
      icon: Blocks,
      label: "Block Height",
      value: height.toLocaleString(),
      color: "text-primary",
    },
    {
      icon: Zap,
      label: "Reward / Block",
      value: `${formatClawAmount(reward, 2)} CLAW`,
      color: "text-yellow-400",
      sub: `Period ${period}`,
    },
    {
      icon: Database,
      label: "Miner Pool / Block",
      value: `${formatClawAmount(miningPool, 2)} CLAW`,
      color: "text-primary",
      sub: "35% of block reward",
    },
    {
      icon: TrendingDown,
      label: "Daily Miner Pool",
      value: `${formatClawAmount(dailyMinerPool, 0)} CLAW`,
      color: "text-primary",
      sub: "28,800 blocks/day",
    },
    {
      icon: Users,
      label: "Active Validators",
      value: validatorCount.toString(),
      color: "text-purple-400",
    },
    {
      icon: Users,
      label: "Active Miners",
      value: activeMiners.toString(),
      color: "text-green-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-border bg-surface/50 p-4 relative overflow-hidden group hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <s.icon className={`h-3.5 w-3.5 ${s.color} opacity-70`} />
            <span className="text-[10px] text-muted uppercase tracking-wider truncate">{s.label}</span>
          </div>
          <div className={`text-base font-bold font-[JetBrains_Mono] ${s.color} truncate`}>{s.value}</div>
          {s.sub && <div className="text-[10px] text-muted/60 mt-0.5 truncate">{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}
