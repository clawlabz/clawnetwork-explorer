"use client";

import { useEffect, useState, useRef } from "react";
import {
  getHealth,
  getBlockNumber,
  getBlock,
  getValidators,
  getRecentTransactions,
  getVersion,
  truncateAddress,
  toHexAddress,
  parseBlockTransaction,
  formatCLAW,
  TX_TYPE_NAMES,
  type ParsedTx,
  type VersionInfo,
} from "@/lib/rpc";
import {
  Layers,
  Clock,
  Users,
  Activity,
  ArrowRightLeft,
  Cpu,
  Zap,
  Globe,
  Timer,
  Blocks,
  TrendingUp,
  Box,
  ArrowUpRight,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { useNetwork } from "./NetworkContext";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";

interface BlockInfo {
  height: number;
  timestamp: number;
  transactions: Record<string, unknown>[];
  validator: string;
  hash: string;
}

interface ChartPoint {
  block: number;
  blockTime: number;
  txCount: number;
}

export function Dashboard() {
  const { config: networkConfig } = useNetwork();
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [latestBlocks, setLatestBlocks] = useState<BlockInfo[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [totalTxns, setTotalTxns] = useState(0);
  const [tps, setTps] = useState(0);
  const [avgBlockTime, setAvgBlockTime] = useState(0);
  const [validatorCount, setValidatorCount] = useState(0);
  const [recentTxs, setRecentTxs] = useState<ParsedTx[]>([]);
  const [networkAge, setNetworkAge] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDataRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const lastFetchedHeightRef = useRef<number>(-1);
  const cachedBlocksRef = useRef<BlockInfo[]>([]);

  fetchDataRef.current = async () => {
    try {
      const MAX_BLOCKS = 100;
      const [h, height, versionData] = await Promise.all([getHealth(), getBlockNumber(), getVersion()]);
      setHealth(h);
      setVersionInfo(versionData);

      const lastHeight = lastFetchedHeightRef.current;
      let allBlocks: BlockInfo[];

      if (lastHeight < 0 || height - lastHeight > MAX_BLOCKS) {
        // First load or large gap: fetch all blocks
        const count = Math.min(MAX_BLOCKS, height + 1);
        const start = Math.max(0, height - count + 1);
        const blockPromises: Promise<Record<string, unknown> | null>[] = [];
        for (let i = height; i >= start; i--) {
          blockPromises.push(getBlock(i));
        }
        allBlocks = (await Promise.all(blockPromises)).filter(Boolean) as unknown as BlockInfo[];
      } else if (height > lastHeight) {
        // Incremental: only fetch new blocks since last poll
        const blockPromises: Promise<Record<string, unknown> | null>[] = [];
        for (let i = height; i > lastHeight; i--) {
          blockPromises.push(getBlock(i));
        }
        const newBlocks = (await Promise.all(blockPromises)).filter(Boolean) as unknown as BlockInfo[];
        // Merge with cached blocks, keep latest MAX_BLOCKS
        const merged = [...newBlocks, ...cachedBlocksRef.current];
        allBlocks = merged.slice(0, MAX_BLOCKS);
      } else {
        // No new blocks, reuse cached
        allBlocks = cachedBlocksRef.current;
      }

      lastFetchedHeightRef.current = height;
      cachedBlocksRef.current = allBlocks;
      setLatestBlocks(allBlocks);

      // Build chart data from sorted blocks
      const sorted = [...allBlocks].sort((a, b) => a.height - b.height);
      const allPoints: ChartPoint[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const timeDiff = sorted[i].timestamp - sorted[i - 1].timestamp;
        allPoints.push({
          block: sorted[i].height,
          blockTime: Math.max(0, timeDiff),
          txCount: sorted[i].transactions?.length || 0,
        });
      }
      // Show last 30 points on chart, but use all points for avg
      setChartData(allPoints.slice(-30));

      // Stats
      const totalTx = sorted.reduce((sum, b) => sum + (b.transactions?.length || 0), 0);
      setTotalTxns(totalTx);

      // Rolling average from all fetched blocks (up to 100)
      if (sorted.length >= 2) {
        const timeSpan = sorted[sorted.length - 1].timestamp - sorted[0].timestamp;
        setAvgBlockTime(Math.round((timeSpan / (sorted.length - 1)) * 100) / 100);
      }

      const recent = sorted.slice(-10);
      if (recent.length >= 2) {
        const recentTxns = recent.reduce((sum, b) => sum + (b.transactions?.length || 0), 0);
        const recentTimeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
        setTps(recentTimeSpan > 0 ? Math.round((recentTxns / recentTimeSpan) * 100) / 100 : 0);
      }

      try {
        const vals = await getValidators();
        setValidatorCount(Array.isArray(vals) ? vals.length : 0);
      } catch {
        const validators = new Set(sorted.map((b) => toHexAddress(b.validator)).filter(Boolean));
        setValidatorCount(validators.size);
      }

      // Compute network age from block 1 timestamp (block 0 has hardcoded genesis time)
      try {
        const firstBlock = await getBlock(1);
        if (firstBlock) {
          const startTs = firstBlock.timestamp as number;
          const nowSecs = Math.floor(Date.now() / 1000);
          const ageSecs = Math.max(0, nowSecs - startTs);
          const days = Math.floor(ageSecs / 86400);
          const hours = Math.floor((ageSecs % 86400) / 3600);
          setNetworkAge(days > 0 ? `${days}d ${hours}h` : `${hours}h`);
        }
      } catch { /* ignore */ }

      // Fetch recent transactions via RPC (not from scanned blocks)
      try {
        const txResults = await getRecentTransactions(500);
        if (Array.isArray(txResults) && txResults.length > 0) {
          const mapped: ParsedTx[] = (txResults as Record<string, unknown>[]).map((tx) => ({
            hash: toHexAddress(tx.hash) || "",
            txType: (tx.txType as number) ?? -1,
            from: toHexAddress(tx.from),
            to: toHexAddress(tx.to),
            amount: String(tx.amount ?? ""),
            timestamp: (tx.timestamp as number) ?? 0,
            blockHeight: (tx.blockHeight as number) ?? 0,
          })).filter((tx) => tx.txType !== 15 && tx.txType !== 16) // Hide miner operational txs
            .slice(0, 8); // Dashboard only shows latest 8
          setRecentTxs(mapped);
        }
      } catch { /* ignore — will show empty */ }

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataRef.current?.();
    const interval = setInterval(() => fetchDataRef.current?.(), 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const height = (health?.height as number) || 0;
  const peerCount = (health?.peer_count as number) || 0;
  const version = (health?.version as string) || "unknown";
  const epoch = (health?.epoch as number) || 0;
  const mempoolSize = (health?.mempool_size as number) || 0;
  const rawStatus = (health?.status as string) || "unknown";
  // RPC returns "ok" for healthy status — normalize to standard labels
  const status = rawStatus === "ok" ? "healthy" : rawStatus;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          Failed to connect to node: {error}
        </div>
      )}

      {versionInfo?.upgrade_level === "critical" && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Critical Update Required</p>
            <p className="text-red-200 text-xs mt-1">Your node version {versionInfo?.node_version} requires an immediate upgrade to {versionInfo?.latest_version}. Please update as soon as possible.</p>
          </div>
        </div>
      )}

      {versionInfo?.announcement && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm text-blue-300 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Network Announcement</p>
            <p className="text-blue-200 text-xs mt-1">{versionInfo?.announcement}</p>
          </div>
        </div>
      )}

      {versionInfo?.upgrade_level === "required" && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3 text-sm text-orange-300 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Update Available: {versionInfo?.latest_version}</p>
            <p className="text-orange-200 text-xs mt-1">{versionInfo?.changelog}</p>
          </div>
        </div>
      )}

      {/* Hero Stats - Primary Metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Layers} label="Block Height" value={height.toLocaleString()} color="text-primary" />
        <StatCard icon={ArrowRightLeft} label="Transactions" value={totalTxns.toLocaleString()} subtext={`in last ${latestBlocks.length} blocks`} color="text-orange-500" />
        <StatCard icon={Zap} label="TPS" value={tps.toString()} subtext="transactions/sec" color="text-yellow-400" />
        <StatCard icon={Users} label="Validators" value={validatorCount.toString()} subtext="active" color="text-purple-400" />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MiniStat icon={Clock} label="Avg Block Time" value={`${avgBlockTime}s`} />
        <MiniStat icon={Globe} label="Peers" value={peerCount.toString()} />
        <MiniStat icon={Blocks} label="Epoch" value={epoch.toString()} />
        <MiniStat icon={Timer} label="Network Age" value={networkAge || "—"} />
        <MiniStat icon={Cpu} label="Mempool" value={mempoolSize.toString()} />
      </div>

      {/* Network Status Bar */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-surface/30 px-5 py-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${status === "healthy" ? "bg-emerald-400" : status === "degraded" ? "bg-yellow-400" : "bg-red-400"}`} />
          <span className="text-xs uppercase tracking-wider text-muted">Network</span>
          <span className={`text-xs font-semibold ${status === "healthy" ? "text-orange-500" : status === "degraded" ? "text-yellow-400" : "text-red-400"}`}>
            {status}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-primary/50" />
          <span className="text-xs text-muted">v{version}</span>
          {versionInfo?.upgrade_level === "recommended" && (
            <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              <span className="text-[10px] text-yellow-400 font-semibold">Update</span>
            </span>
          )}
          {versionInfo?.upgrade_level === "required" && (
            <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-orange-500/20 border border-orange-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              <span className="text-[10px] text-orange-400 font-semibold">Required</span>
            </span>
          )}
          {versionInfo?.upgrade_level === "critical" && (
            <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[10px] text-red-400 font-semibold">Critical</span>
            </span>
          )}
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-primary/50" />
          <span className="text-xs text-muted">{networkConfig.name}</span>
        </div>
      </div>

      {/* Charts Row */}
      {chartData.length > 1 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Block Time Chart */}
          <div className="rounded-xl border border-border bg-surface/50 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-primary" />
              Block Time
              <span className="text-xs font-normal text-muted">last {chartData.length} blocks</span>
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F96706" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#F96706" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="block" tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v) => `${v}`} stroke="transparent" />
                  <YAxis tick={{ fill: "#666", fontSize: 10 }} stroke="transparent" width={30} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#140E0A", border: "1px solid #2A1C14", borderRadius: "8px", color: "#e8e8e8", fontSize: 12 }}
                    labelFormatter={(v) => `Block #${v}`}
                    formatter={(value) => [`${value}s`, "Block Time"]}
                  />
                  <ReferenceLine y={3} stroke="#666" strokeDasharray="6 3" label={{ value: "Target", fill: "#666", fontSize: 10, position: "insideTopRight" }} />
                  <Area type="monotone" dataKey="blockTime" stroke="#F96706" strokeWidth={2} fill="url(#btGrad)" dot={false} activeDot={{ r: 3, fill: "#F96706" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Transaction Activity Chart */}
          <div className="rounded-xl border border-border bg-surface/50 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <ArrowRightLeft className="h-4 w-4 text-orange-500" />
              Transaction Activity
              <span className="text-xs font-normal text-muted">per block</span>
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="block" tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v) => `${v}`} stroke="transparent" />
                  <YAxis tick={{ fill: "#666", fontSize: 10 }} stroke="transparent" width={30} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#140E0A", border: "1px solid #2A1C14", borderRadius: "8px", color: "#e8e8e8", fontSize: 12 }}
                    labelFormatter={(v) => `Block #${v}`}
                    formatter={(value) => [value, "Transactions"]}
                  />
                  <Bar dataKey="txCount" fill="#F96706" fillOpacity={0.7} radius={[3, 3, 0, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Latest Blocks & Transactions - Side by Side on Desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Latest Blocks */}
        <div className="rounded-xl border border-border bg-surface/50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Box className="h-4 w-4 text-primary" /> Latest Blocks
            </h2>
            <a href="/stats" className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors">
              View All <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
          <div className="divide-y divide-border/50">
            {latestBlocks.slice(0, 8).map((block) => {
              const validator = toHexAddress(block.validator);
              const txCount = block.transactions?.length || 0;
              const timeAgo = block.timestamp ? formatTimeAgo(block.timestamp) : "—";
              return (
                <div key={block.height} className="flex items-center gap-4 px-5 py-3 hover:bg-primary/5 transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <a href={`/block/${block.height}`} className="text-sm font-semibold text-primary hover:underline font-mono">
                        #{block.height.toLocaleString()}
                      </a>
                      <span className="text-xs text-muted">{timeAgo}</span>
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      Validator{" "}
                      {validator ? (
                        <a href={`/address/${validator}`} className="text-primary/60 hover:text-primary font-mono">
                          {truncateAddress(validator, 4)}
                        </a>
                      ) : "—"}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-md bg-surface px-2 py-1 text-xs text-muted border border-border/50">
                    {txCount} txn{txCount !== 1 ? "s" : ""}
                  </div>
                </div>
              );
            })}
            {latestBlocks.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted">No blocks yet</div>
            )}
          </div>
        </div>

        {/* Latest Transactions */}
        <div className="rounded-xl border border-border bg-surface/50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-orange-500" /> Latest Transactions
            </h2>
            <a href="/transactions" className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors">
              View All <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
          <div className="divide-y divide-border/50">
            {(() => {
              const allTxs = recentTxs.length > 0 ? recentTxs : latestBlocks.flatMap((block) =>
                (block.transactions || []).map((tx, txIdx) =>
                  parseBlockTransaction(tx as unknown as Record<string, unknown>, block.timestamp, block.height, txIdx)
                )
              );
              if (allTxs.length === 0) {
                return <div className="px-5 py-8 text-center text-sm text-muted">No recent transactions</div>;
              }
              return allTxs.slice(0, 8).map((tx, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-primary/5 transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                    <ArrowRightLeft className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {tx.hash.includes(":") ? (
                        <a href={`/block/${tx.blockHeight}`} className="text-sm font-mono text-primary hover:underline">
                          Block #{tx.blockHeight}
                        </a>
                      ) : (
                        <a href={`/tx/${tx.hash}`} className="text-sm font-mono text-primary hover:underline">
                          {truncateAddress(tx.hash, 8)}
                        </a>
                      )}
                      <span className="text-xs text-muted">{tx.timestamp ? formatTimeAgo(tx.timestamp) : "—"}</span>
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {tx.from ? (
                        <>
                          From{" "}
                          <a href={`/address/${tx.from}`} className="text-primary/60 hover:text-primary font-mono">
                            {truncateAddress(tx.from, 4)}
                          </a>
                        </>
                      ) : null}
                      {tx.to ? (
                        <>
                          {" → "}
                          <a href={`/address/${tx.to}`} className="text-primary/60 hover:text-primary font-mono">
                            {truncateAddress(tx.to, 4)}
                          </a>
                        </>
                      ) : (tx.txType === 8 || tx.txType === 9) ? (
                        <span className="text-muted/60 italic"> → Self (Stake)</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] text-primary whitespace-nowrap">
                      {TX_TYPE_NAMES[tx.txType] ?? `Type ${tx.txType}`}
                    </span>
                    {tx.amount ? (
                      <span className="text-[10px] text-orange-500 font-mono">{formatCLAW(tx.amount)} CLAW</span>
                    ) : null}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helper Components ── */

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color = "text-primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/50 p-5 relative overflow-hidden group hover:border-primary/30 transition-colors">
      <div className="absolute -right-3 -top-3 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
        <Icon className="h-20 w-20" />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color} opacity-70`} />
        <span className="text-xs text-muted uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      {subtext && <p className="text-[10px] text-muted mt-1">{subtext}</p>}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface/30 px-4 py-3">
      <Icon className="h-4 w-4 text-primary/40 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-text">{value}</p>
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 0) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
