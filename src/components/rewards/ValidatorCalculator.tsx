"use client";

import { useState, useMemo } from "react";
import { Shield } from "lucide-react";
import { validatorPoolPerBlock, formatClawAmount, BLOCKS_PER_HOUR, BLOCKS_PER_DAY, BLOCKS_PER_YEAR } from "@/lib/rewards";

interface Props {
  currentHeight: number;
  totalValidatorWeight: number;
  validatorCount: number;
}

/**
 * Estimate a validator's weight using the on-chain formula:
 *   weight = stake_claw × 0.4 + agent_score × 0.6
 *
 * where stake_claw is CLAW amount (not base units) and agent_score is in bps (0–10000).
 */
function estimateWeight(stakeClaw: number, agentScoreBps: number): number {
  return stakeClaw * 0.4 + agentScoreBps * 0.6;
}

export function ValidatorCalculator({ currentHeight, totalValidatorWeight, validatorCount }: Props) {
  const [stakeClaw, setStakeClaw] = useState(10_000);
  const [agentScore, setAgentScore] = useState(5_000);
  const [useCustomTotal, setUseCustomTotal] = useState(false);
  const [customTotalWeight, setCustomTotalWeight] = useState(Math.max(1, totalValidatorWeight));

  const effectiveTotalWeight = useCustomTotal ? customTotalWeight : Math.max(1, totalValidatorWeight);

  const myWeight = estimateWeight(stakeClaw, agentScore);
  const totalWithMe = effectiveTotalWeight + myWeight;
  const sharePercent = totalWithMe > 0 ? (myWeight / totalWithMe) * 100 : 0;

  const pool = validatorPoolPerBlock(currentHeight);
  const myShareBigInt = pool > 0n && totalWithMe > 0
    ? pool * BigInt(Math.round(myWeight * 1e6)) / BigInt(Math.round(totalWithMe * 1e6))
    : 0n;

  const rows = useMemo(() => [
    { label: "Per Block",              value: myShareBigInt },
    { label: "Per Hour (1,200 blocks)", value: myShareBigInt * BigInt(BLOCKS_PER_HOUR) },
    { label: "Per Day (28,800 blocks)", value: myShareBigInt * BigInt(BLOCKS_PER_DAY) },
    { label: "Per Month (30 days)",     value: myShareBigInt * BigInt(BLOCKS_PER_DAY) * 30n },
    { label: "Per Year (est.)",         value: myShareBigInt * BigInt(BLOCKS_PER_YEAR) },
  ], [myShareBigInt]);

  return (
    <div className="rounded-xl border border-border bg-surface/50 p-5">
      <div className="flex items-center gap-2 mb-5">
        <Shield className="h-4 w-4 text-purple-400" />
        <h2 className="text-base font-semibold">Validator Reward Calculator</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-4">
          {/* Stake */}
          <div>
            <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">My Stake (CLAW)</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={stakeClaw}
              onChange={(e) => setStakeClaw(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none font-[JetBrains_Mono]"
            />
          </div>

          {/* Agent Score */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-muted uppercase tracking-wider">Agent Score (bps)</label>
              <span className="text-xs text-muted font-[JetBrains_Mono]">{agentScore.toLocaleString()} / 10,000</span>
            </div>
            <input
              type="range"
              min={0}
              max={10000}
              step={100}
              value={agentScore}
              onChange={(e) => setAgentScore(parseInt(e.target.value))}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-[10px] text-muted/60 mt-0.5">
              <span>0</span>
              <span>5,000</span>
              <span>10,000</span>
            </div>
          </div>

          {/* Total weight */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-muted uppercase tracking-wider">Network Total Weight</label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted">
                <input
                  type="checkbox"
                  checked={useCustomTotal}
                  onChange={(e) => setUseCustomTotal(e.target.checked)}
                  className="accent-purple-500"
                />
                Custom
              </label>
            </div>
            {useCustomTotal ? (
              <input
                type="number"
                min={1}
                value={customTotalWeight}
                onChange={(e) => setCustomTotalWeight(Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none font-[JetBrains_Mono]"
              />
            ) : (
              <div className="rounded-lg border border-border bg-border/20 px-3 py-2 text-sm font-[JetBrains_Mono] text-purple-400">
                {totalValidatorWeight.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                <span className="text-muted font-normal text-xs ml-2">({validatorCount} validators, live)</span>
              </div>
            )}
          </div>

          {/* Weight breakdown + share */}
          <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted">My estimated weight</span>
              <span className="font-[JetBrains_Mono] text-purple-300">{myWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Formula</span>
              <span className="font-[JetBrains_Mono] text-muted/60 text-[10px]">
                {stakeClaw.toLocaleString()}×0.4 + {agentScore.toLocaleString()}×0.6
              </span>
            </div>
            <div className="border-t border-purple-500/20 pt-2 flex justify-between">
              <span className="text-xs text-muted">Your share of pool</span>
              <span className="text-xl font-bold text-purple-400 font-[JetBrains_Mono]">
                {sharePercent < 0.01 ? "< 0.01" : sharePercent.toFixed(2)}%
              </span>
            </div>
            <div className="text-xs text-muted">
              Pool: {formatClawAmount(pool, 2)} CLAW/block (65% of block reward)
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
                  i === 2 ? "border border-purple-500/30 bg-purple-500/10" : "border border-border/50 bg-surface/30"
                }`}
              >
                <span className="text-sm text-muted">{row.label}</span>
                <span className={`font-[JetBrains_Mono] text-sm font-bold ${i === 2 ? "text-purple-400 text-base" : "text-text"}`}>
                  {formatClawAmount(row.value, i === 0 ? 4 : 2)}
                  <span className="text-muted font-normal ml-1 text-xs">CLAW</span>
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted/60 mt-3">
            * Estimates assume constant block height and validator set. Actual rewards depend on real-time stake, agent scores, and uptime.
            Transaction fees (50% to block proposer) are not included.
          </p>
        </div>
      </div>
    </div>
  );
}
