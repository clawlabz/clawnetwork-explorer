"use client";

import { useState } from "react";
import { Search, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { getMinerInfo } from "@/lib/rpc";
import {
  calcMinerReward,
  formatClawAmount,
  reputationTierFromAge,
  BLOCKS_7_DAYS,
  BLOCKS_30_DAYS,
} from "@/lib/rewards";
import type { MinerInfo } from "@/app/rewards/page";
import { truncateAddress, toHexAddress } from "@/lib/rpc";
import type { NetworkId } from "@/lib/config";

interface Props {
  currentHeight: number;
  totalWeight: number;
  network: NetworkId;
}

interface LookupResult {
  miner: MinerInfo;
  perBlock: bigint;
  perDay: bigint;
  sharePercent: number;
}

const TIER_COLORS = {
  newcomer: "text-yellow-400",
  established: "text-blue-400",
  veteran: "text-green-400",
};

const TIER_BG = {
  newcomer: "bg-yellow-500/10 border-yellow-500/30",
  established: "bg-blue-500/10 border-blue-500/30",
  veteran: "bg-green-500/10 border-green-500/30",
};

export function NodeLookup({ currentHeight, totalWeight, network }: Props) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const addr = address.trim();
    if (!addr) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const raw = await getMinerInfo(addr, network);
      if (!raw) {
        setError("Node not found. Make sure this address has registered as a miner (MinerRegister tx).");
        return;
      }

      const miner: MinerInfo = {
        address: toHexAddress(raw.address) || addr,
        tier: (raw.tier as string) || "Online",
        name: (raw.name as string) || "",
        registered_at: (raw.registered_at as number) || 0,
        last_heartbeat: (raw.last_heartbeat as number) || 0,
        active: Boolean(raw.active),
        reputation_bps: (raw.reputation_bps as number) || 0,
      };

      const myWeight = miner.reputation_bps;
      const estimate = calcMinerReward(currentHeight, myWeight, totalWeight || myWeight);

      setResult({
        miner,
        perBlock: estimate.perBlock,
        perDay: estimate.perDay,
        sharePercent: estimate.sharePercent,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  const tier = result ? reputationTierFromAge(result.miner.registered_at, currentHeight) : null;
  const blocksSinceHeartbeat = result ? currentHeight - result.miner.last_heartbeat : 0;
  const heartbeatOk = blocksSinceHeartbeat < 1000;

  return (
    <div className="rounded-xl border border-border bg-surface/50 p-5">
      <div className="flex items-center gap-2 mb-5">
        <Search className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Node Address Lookup</h2>
      </div>

      <form onSubmit={handleLookup} className="flex gap-2 mb-5">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter miner address (64-char hex)"
          className="flex-1 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-muted/50 focus:border-primary focus:outline-none font-[JetBrains_Mono]"
        />
        <button
          type="submit"
          disabled={loading || !address.trim()}
          className="flex items-center gap-2 rounded-lg bg-primary/20 border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/30 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Lookup
        </button>
      </form>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && tier && (
        <div className="space-y-4">
          {/* Identity */}
          <div className="rounded-lg border border-border bg-surface/30 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-muted uppercase tracking-wider mb-1">Address</div>
                <a
                  href={`/address/${result.miner.address}`}
                  className="font-[JetBrains_Mono] text-xs text-primary hover:underline"
                >
                  {truncateAddress(result.miner.address, 8)}
                </a>
              </div>
              <div>
                <div className="text-xs text-muted uppercase tracking-wider mb-1">Name</div>
                <div className="text-sm font-semibold">{result.miner.name || <span className="text-muted/40">—</span>}</div>
              </div>
              <div>
                <div className="text-xs text-muted uppercase tracking-wider mb-1">Status</div>
                <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${result.miner.active ? "text-green-400" : "text-red-400"}`}>
                  {result.miner.active
                    ? <><CheckCircle2 className="h-3.5 w-3.5" /> Active</>
                    : <><XCircle className="h-3.5 w-3.5" /> Inactive</>
                  }
                </span>
              </div>
              <div>
                <div className="text-xs text-muted uppercase tracking-wider mb-1">Heartbeat</div>
                <span className={`text-xs font-[JetBrains_Mono] ${heartbeatOk ? "text-green-400" : "text-red-400"}`}>
                  Block #{result.miner.last_heartbeat.toLocaleString()}
                </span>
                <div className={`text-[10px] ${heartbeatOk ? "text-muted" : "text-red-400"}`}>
                  {blocksSinceHeartbeat.toLocaleString()} blocks ago
                </div>
              </div>
            </div>
          </div>

          {/* Reputation */}
          <div className={`rounded-lg border p-4 flex items-center justify-between ${TIER_BG[tier]}`}>
            <div>
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Reputation Tier</div>
              <div className={`text-lg font-bold capitalize ${TIER_COLORS[tier]}`}>{tier}</div>
              <div className="text-xs text-muted mt-0.5">
                Registered at block #{result.miner.registered_at.toLocaleString()} ·{" "}
                {(currentHeight - result.miner.registered_at).toLocaleString()} blocks ago
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Reputation Weight</div>
              <div className={`text-2xl font-bold font-[JetBrains_Mono] ${TIER_COLORS[tier]}`}>
                {result.miner.reputation_bps.toLocaleString()}
                <span className="text-sm font-normal ml-1">bps</span>
              </div>
            </div>
          </div>

          {/* Reward estimates */}
          {result.miner.active ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Share of Pool", value: `${result.sharePercent < 0.01 ? "< 0.01" : result.sharePercent.toFixed(2)}%`, big: true },
                { label: "Per Block", value: `${formatClawAmount(result.perBlock, 4)} CLAW` },
                { label: "Per Hour", value: `${formatClawAmount(result.perBlock * 1200n, 2)} CLAW` },
                { label: "Per Day", value: `${formatClawAmount(result.perDay, 2)} CLAW`, big: true },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`rounded-lg border p-4 text-center ${stat.big ? "border-primary/30 bg-primary/5" : "border-border bg-surface/30"}`}
                >
                  <div className="text-xs text-muted uppercase tracking-wider mb-1">{stat.label}</div>
                  <div className={`font-[JetBrains_Mono] font-bold ${stat.big ? "text-primary text-lg" : "text-sm"}`}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400 text-center">
              This node is currently inactive — no rewards are being distributed to it.
              It may have missed heartbeats. Last heartbeat was {blocksSinceHeartbeat.toLocaleString()} blocks ago.
            </div>
          )}

          <p className="text-xs text-muted/60">
            Estimates based on current network state ({totalWeight.toLocaleString()} total weight across all active miners).
          </p>
        </div>
      )}
    </div>
  );
}
