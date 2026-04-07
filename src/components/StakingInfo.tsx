"use client";

import { useEffect, useState } from "react";
import { getSupplyInfo, getValidators, formatCLAW } from "@/lib/rpc";
import { useNetwork } from "./NetworkContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Lock, TrendingUp } from "lucide-react";

interface ValidatorStake {
  address: string;
  stake: string;
}

export function StakingInfo() {
  const { network } = useNetwork();
  const [totalSupply, setTotalSupply] = useState("0");
  const [stakedSupply, setStakedSupply] = useState("0");
  const [stakingRate, setStakingRate] = useState("0");
  const [validators, setValidators] = useState<ValidatorStake[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [supply, vals] = await Promise.all([
          getSupplyInfo(network).catch(() => null),
          getValidators(network).catch(() => []),
        ]);

        if (supply) {
          const total = BigInt(String(supply.total_supply || "0"));
          const staked = BigInt(String(supply.staked_supply || "0"));
          setTotalSupply(String(supply.total_supply || "0"));
          setStakedSupply(String(supply.staked_supply || "0"));
          if (total > BigInt(0)) {
            setStakingRate((Number(staked * BigInt(10000) / total) / 100).toFixed(1));
          }
        }

        if (Array.isArray(vals)) {
          setValidators(
            (vals as Record<string, unknown>[]).map((v) => ({
              address: String(v.address || ""),
              stake: String(v.stake || "0"),
            }))
          );
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [network]);

  if (loading) return null;

  const chartData = validators
    .sort((a, b) => Number(BigInt(b.stake) - BigInt(a.stake)))
    .map((v, i) => ({
      name: `V${i + 1}`,
      stake: Number(BigInt(v.stake) / BigInt(1e9)),
      address: v.address,
    }));

  return (
    <div className="rounded-xl border border-border bg-surface/50 p-6 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <Lock className="h-4 w-4 text-purple-400" />
        Staking Overview
      </h3>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted uppercase tracking-wider">Total Staked</p>
          <p className="text-lg font-bold text-purple-400">{formatCLAW(stakedSupply)} CLAW</p>
        </div>
        <div>
          <p className="text-xs text-muted uppercase tracking-wider">Staking Rate</p>
          <p className="text-lg font-bold text-primary">{stakingRate}%</p>
        </div>
        <div>
          <p className="text-xs text-muted uppercase tracking-wider">Validators</p>
          <p className="text-lg font-bold text-text">{validators.length}</p>
        </div>
      </div>

      {chartData.length > 0 && (
        <div>
          <p className="text-xs text-muted mb-2">Stake Distribution by Validator</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 10 }} stroke="transparent" />
                <YAxis tick={{ fill: "#666", fontSize: 10 }} stroke="transparent" width={50} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#140E0A", border: "1px solid #2A1C14", borderRadius: "8px", color: "#e8e8e8", fontSize: 12 }}
                  formatter={(value: unknown) => [`${Number(value ?? 0).toLocaleString()} CLAW`, "Stake"]}
                />
                <Bar dataKey="stake" fill="#A855F7" fillOpacity={0.7} radius={[3, 3, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
