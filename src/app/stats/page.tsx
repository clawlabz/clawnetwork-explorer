"use client";

import { useEffect, useState, useRef } from "react";
import { getBlockNumber, getBlock, getHealth, getValidators, formatCLAW } from "@/lib/rpc";
import { Layers, Clock, Activity, ArrowRightLeft, Users } from "lucide-react";
import { useNetwork } from "@/components/NetworkContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface BlockData {
  height: number;
  timestamp: number;
  txCount: number;
  validator: string;
}

interface ChartPoint {
  block: number;
  blockTime: number;
  txCount: number;
}

interface DailyStats {
  date: string;
  tx_count: number;
  transfer_volume: string;
  unique_senders: number;
  unique_receivers: number;
}

export default function StatsPage() {
  const { network } = useNetwork();
  const [loading, setLoading] = useState(true);
  const [blockHeight, setBlockHeight] = useState(0);
  const [tps, setTps] = useState(0);
  const [avgBlockTime, setAvgBlockTime] = useState(0);
  const [totalTxns, setTotalTxns] = useState(0);
  const [validatorCount, setValidatorCount] = useState(0);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [dailyData, setDailyData] = useState<DailyStats[]>([]);

  const fetchDataRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const lastFetchedHeightRef = useRef<number>(-1);
  const cachedBlocksRef = useRef<BlockData[]>([]);

  fetchDataRef.current = async () => {
    try {
      const MAX_BLOCKS = 50;
      const [health, height] = await Promise.all([getHealth(), getBlockNumber()]);
      setBlockHeight(height);

      const lastHeight = lastFetchedHeightRef.current;
      let blocks: BlockData[];

      const toBlockData = (b: Record<string, unknown>): BlockData => ({
        height: b.height as number,
        timestamp: b.timestamp as number,
        txCount: Array.isArray(b.transactions) ? (b.transactions as unknown[]).length : 0,
        validator: String(b.validator ?? ""),
      });

      if (lastHeight < 0 || height - lastHeight > MAX_BLOCKS) {
        // First load or large gap: fetch all blocks
        const count = Math.min(MAX_BLOCKS, height + 1);
        const start = Math.max(0, height - count + 1);
        const blockPromises: Promise<Record<string, unknown> | null>[] = [];
        for (let i = start; i <= height; i++) {
          blockPromises.push(getBlock(i));
        }
        const rawBlocks = await Promise.all(blockPromises);
        blocks = rawBlocks.filter(Boolean).map((b) => toBlockData(b!)).sort((a, b) => a.height - b.height);
      } else if (height > lastHeight) {
        // Incremental: only fetch new blocks since last poll
        const blockPromises: Promise<Record<string, unknown> | null>[] = [];
        for (let i = lastHeight + 1; i <= height; i++) {
          blockPromises.push(getBlock(i));
        }
        const rawNewBlocks = await Promise.all(blockPromises);
        const newBlocks = rawNewBlocks.filter(Boolean).map((b) => toBlockData(b!));
        // Merge with cached, sort, keep latest MAX_BLOCKS
        const merged = [...cachedBlocksRef.current, ...newBlocks].sort((a, b) => a.height - b.height);
        blocks = merged.slice(-MAX_BLOCKS);
      } else {
        // No new blocks, reuse cached
        blocks = cachedBlocksRef.current;
      }

      lastFetchedHeightRef.current = height;
      cachedBlocksRef.current = blocks;

      // Calculate chart data (block times between consecutive blocks)
      const points: ChartPoint[] = [];
      for (let i = 1; i < blocks.length; i++) {
        const timeDiff = blocks[i].timestamp - blocks[i - 1].timestamp;
        points.push({
          block: blocks[i].height,
          blockTime: Math.max(0, timeDiff),
          txCount: blocks[i].txCount,
        });
      }
      setChartData(points);

      // Total transactions across fetched blocks
      const totalTx = blocks.reduce((sum, b) => sum + b.txCount, 0);
      setTotalTxns(totalTx);

      // Average block time
      if (blocks.length >= 2) {
        const timeSpan = blocks[blocks.length - 1].timestamp - blocks[0].timestamp;
        const avg = timeSpan / (blocks.length - 1);
        setAvgBlockTime(Math.round(avg * 100) / 100);
      }

      // TPS from last 10 blocks
      const recent = blocks.slice(-10);
      if (recent.length >= 2) {
        const recentTxns = recent.reduce((sum, b) => sum + b.txCount, 0);
        const recentTimeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
        setTps(recentTimeSpan > 0 ? Math.round((recentTxns / recentTimeSpan) * 100) / 100 : 0);
      }

      // Get active validator count from RPC
      try {
        const vals = await getValidators();
        setValidatorCount(Array.isArray(vals) ? vals.length : 0);
      } catch {
        const validators = new Set(blocks.map((b) => b.validator).filter(Boolean));
        setValidatorCount(validators.size);
      }

      // Fetch daily stats
      try {
        const res = await fetch(`/api/stats/daily?network=${network}&days=90`);
        const json = await res.json();
        if (json.success && json.data) {
          setDailyData(json.data);
        }
      } catch {
        // ignore - daily stats API may not be available yet
      }
    } catch (e) {
      console.error("Failed to fetch stats:", e instanceof Error ? e.message : e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataRef.current?.();
    const interval = setInterval(() => fetchDataRef.current?.(), 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const overviewStats = [
    { icon: Layers, label: "Block Height", value: blockHeight.toLocaleString() },
    { icon: Activity, label: "TPS", value: tps.toString() },
    { icon: Clock, label: "Avg Block Time", value: `${avgBlockTime}s` },
    { icon: ArrowRightLeft, label: "Total Txns (50 blocks)", value: totalTxns.toLocaleString() },
    { icon: Users, label: "Active Validators", value: validatorCount.toString() },
  ];

  return (
    <>
    <Header />
    <main className="mx-auto max-w-7xl px-4 py-8 flex-1">
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Network Statistics</h1>
        <p className="text-sm text-muted">Real-time metrics from the ClawNetwork blockchain</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {overviewStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="rounded-xl border border-border bg-surface/50 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted uppercase tracking-wider">{stat.label}</span>
                <Icon className="h-4 w-4 text-primary/60" />
              </div>
              <span className="text-2xl font-bold text-primary">{stat.value}</span>
            </div>
          );
        })}
      </div>

      {/* Block Time Chart */}
      <div className="rounded-xl border border-border bg-surface/50 p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Block Time (last {chartData.length} blocks)
        </h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="blockTimeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F96706" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#F96706" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="block"
                tick={{ fill: "#888", fontSize: 11 }}
                tickFormatter={(v) => `#${v}`}
                stroke="#444"
              />
              <YAxis
                tick={{ fill: "#888", fontSize: 11 }}
                stroke="#444"
                label={{ value: "Seconds", angle: -90, position: "insideLeft", fill: "#888", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#140E0A",
                  border: "1px solid #2A1C14",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: 12,
                }}
                labelFormatter={(v) => `Block #${v}`}
                formatter={(value) => [`${value}s`, "Block Time"]}
              />
              <Area
                type="monotone"
                dataKey="blockTime"
                stroke="#F96706"
                strokeWidth={2}
                fill="url(#blockTimeGradient)"
                fillOpacity={1}
                dot={false}
                activeDot={{ r: 4, fill: "#F96706" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transactions Per Block Chart */}
      <div className="rounded-xl border border-border bg-surface/50 p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary" />
          Transactions Per Block (last {chartData.length} blocks)
        </h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="block"
                tick={{ fill: "#888", fontSize: 11 }}
                tickFormatter={(v) => `#${v}`}
                stroke="#444"
              />
              <YAxis
                tick={{ fill: "#888", fontSize: 11 }}
                stroke="#444"
                allowDecimals={false}
                label={{ value: "Transactions", angle: -90, position: "insideLeft", fill: "#888", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#140E0A",
                  border: "1px solid #2A1C14",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: 12,
                }}
                labelFormatter={(v) => `Block #${v}`}
                formatter={(value) => [value, "Transactions"]}
              />
              <Bar
                dataKey="txCount"
                fill="#F96706"
                fillOpacity={0.6}
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Trend Charts */}
      {dailyData.length > 0 ? (
        <div className="space-y-6">
          {/* Daily Transaction Volume */}
          <div className="rounded-xl border border-border bg-surface/50 p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Daily Transaction Volume ({dailyData.length} days)
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#888", fontSize: 11 }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
                    }}
                    stroke="#444"
                  />
                  <YAxis
                    tick={{ fill: "#888", fontSize: 11 }}
                    stroke="#444"
                    label={{ value: "Transactions", angle: -90, position: "insideLeft", fill: "#888", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#140E0A",
                      border: "1px solid #2A1C14",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => `Date: ${v}`}
                    formatter={(value) => [value, "Transactions"]}
                  />
                  <Line type="monotone" dataKey="tx_count" stroke="#F96706" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Active Addresses */}
          <div className="rounded-xl border border-border bg-surface/50 p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Daily Active Addresses ({dailyData.length} days)
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#888", fontSize: 11 }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
                    }}
                    stroke="#444"
                  />
                  <YAxis
                    tick={{ fill: "#888", fontSize: 11 }}
                    stroke="#444"
                    label={{ value: "Unique Addresses", angle: -90, position: "insideLeft", fill: "#888", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#140E0A",
                      border: "1px solid #2A1C14",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => `Date: ${v}`}
                    formatter={(value) => [value, "Addresses"]}
                  />
                  <Line type="monotone" dataKey="active_addresses" stroke="#00D084" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Transfer Volume */}
          <div className="rounded-xl border border-border bg-surface/50 p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Daily Transfer Volume ({dailyData.length} days)
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData.map((d) => ({
                  ...d,
                  transfer_volume_claw: Number(BigInt(d.transfer_volume) / BigInt(1e9))
                }))}>
                  <defs>
                    <linearGradient id="transferGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00D084" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#00D084" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#888", fontSize: 11 }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
                    }}
                    stroke="#444"
                  />
                  <YAxis
                    tick={{ fill: "#888", fontSize: 11 }}
                    stroke="#444"
                    label={{ value: "CLAW", angle: -90, position: "insideLeft", fill: "#888", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#140E0A",
                      border: "1px solid #2A1C14",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => `Date: ${v}`}
                    formatter={(value: unknown) => [`${Number(value ?? 0).toLocaleString()} CLAW`, "Transfer Volume"]}
                  />
                  <Area type="monotone" dataKey="transfer_volume_claw" stroke="#00D084" fill="url(#transferGradient)" fillOpacity={1} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface/50 p-6 text-center">
          <p className="text-sm text-muted">No daily data available yet</p>
        </div>
      )}
    </div>
    </main>
    <Footer />
    </>
  );
}
