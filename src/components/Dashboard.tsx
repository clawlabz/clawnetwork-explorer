"use client";

import { useEffect, useState, useCallback } from "react";
import { getHealth, getBlockNumber, getBlock, truncateAddress, toHexAddress } from "@/lib/rpc";
import { Layers, Clock, Users, Activity } from "lucide-react";

interface BlockInfo {
  height: number;
  timestamp: number;
  transactions: unknown[];
  validator: string;
  hash: string;
}

export function Dashboard() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [latestBlocks, setLatestBlocks] = useState<BlockInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [h, height] = await Promise.all([getHealth(), getBlockNumber()]);
      setHealth(h);

      const blockPromises: Promise<Record<string, unknown> | null>[] = [];
      const start = Math.max(0, height - 9);
      for (let i = height; i >= start; i--) {
        blockPromises.push(getBlock(i));
      }
      const blocks = (await Promise.all(blockPromises)).filter(Boolean) as unknown as BlockInfo[];
      setLatestBlocks(blocks);
    } catch (e) {
      console.error("Failed to fetch data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const height = health?.height as number || 0;
  const peerCount = health?.peer_count as number || 0;
  const uptime = health?.uptime_secs as number || 0;
  const version = health?.version as string || "unknown";

  const stats = [
    { icon: Layers, label: "Block Height", value: height.toLocaleString(), color: "text-primary" },
    { icon: Clock, label: "Block Time", value: "3s", color: "text-primary" },
    { icon: Users, label: "Active Peers", value: peerCount.toString(), color: "text-primary" },
    { icon: Activity, label: "Version", value: `v${version}`, color: "text-primary" },
  ];

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="rounded-xl border border-border bg-surface/50 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted uppercase tracking-wider">{stat.label}</span>
                <Icon className="h-4 w-4 text-primary/60" />
              </div>
              <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
            </div>
          );
        })}
      </div>

      {/* Latest Blocks */}
      <div className="rounded-xl border border-border bg-surface/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Latest Blocks
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                <th className="px-6 py-3 text-left">Height</th>
                <th className="px-6 py-3 text-left">Validator</th>
                <th className="px-6 py-3 text-left">Txns</th>
                <th className="px-6 py-3 text-left">Time</th>
              </tr>
            </thead>
            <tbody>
              {latestBlocks.map((block) => (
                <tr key={block.height} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                  <td className="px-6 py-3">
                    <a href={`/block/${block.height}`} className="text-primary hover:underline font-mono">
                      {block.height.toLocaleString()}
                    </a>
                  </td>
                  <td className="px-6 py-3 font-mono text-muted text-xs">
                    {(() => {
                      const addr = toHexAddress(block.validator);
                      return addr ? (
                        <a href={`/address/${addr}`} className="text-primary/70 hover:text-primary hover:underline">
                          {truncateAddress(addr)}
                        </a>
                      ) : "—";
                    })()}
                  </td>
                  <td className="px-6 py-3">{block.transactions?.length || 0}</td>
                  <td className="px-6 py-3 text-muted text-xs">
                    {block.timestamp ? new Date(block.timestamp * 1000).toLocaleTimeString() : "—"}
                  </td>
                </tr>
              ))}
              {latestBlocks.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-muted">No blocks yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
