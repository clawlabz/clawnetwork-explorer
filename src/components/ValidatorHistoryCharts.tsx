"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCLAW } from "@/lib/rpc";

interface HistoryEntry {
  epoch: number;
  stake: string;
  agent_score: number;
}

interface ValidatorHistoryChartsProps {
  address: string;
  network: string;
}

export function ValidatorHistoryCharts({ address, network }: ValidatorHistoryChartsProps) {
  const [data, setData] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/stats/validator-history?address=${address}&network=${network}&limit=100`);
        const json = await res.json();
        if (json.success && json.data) {
          // Reverse to show chronological order (oldest to newest)
          setData(json.data.reverse());
        }
      } catch (e) {
        console.error("Failed to fetch validator history:", e instanceof Error ? e.message : e);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [address, network]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface/50 p-6 text-center">
        <p className="text-sm text-muted">No history available yet</p>
      </div>
    );
  }

  const chartData = data.map((entry) => ({
    epoch: entry.epoch,
    stake_claw: Number(BigInt(entry.stake) / BigInt(1e9)),
    agent_score: entry.agent_score,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Stake History */}
      <div className="rounded-xl border border-border bg-surface/50 p-6">
        <h3 className="font-semibold mb-4">Stake History</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="epoch"
                tick={{ fill: "#888", fontSize: 11 }}
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
                labelFormatter={(v) => `Epoch ${v}`}
                formatter={(value: unknown) => [`${Number(value ?? 0).toLocaleString()} CLAW`, "Stake"]}
              />
              <Line
                type="monotone"
                dataKey="stake_claw"
                stroke="#F96706"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#F96706" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Score History */}
      <div className="rounded-xl border border-border bg-surface/50 p-6">
        <h3 className="font-semibold mb-4">Agent Score History</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="epoch"
                tick={{ fill: "#888", fontSize: 11 }}
                stroke="#444"
              />
              <YAxis
                tick={{ fill: "#888", fontSize: 11 }}
                stroke="#444"
                label={{ value: "Score", angle: -90, position: "insideLeft", fill: "#888", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#140E0A",
                  border: "1px solid #2A1C14",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: 12,
                }}
                labelFormatter={(v) => `Epoch ${v}`}
                formatter={(value: unknown) => [Number(value ?? 0).toFixed(2), "Score"]}
              />
              <Line
                type="monotone"
                dataKey="agent_score"
                stroke="#00D084"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#00D084" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
