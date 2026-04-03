"use client";

import { useState, useCallback } from "react";
import { Search, Shield, User, Pickaxe, Landmark, ArrowRightLeft, Coins, Clock, Activity, Lock, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

interface InvestigationResult {
  address: string;
  network: string;
  currentBlockHeight: number;
  balance: string;
  balanceRaw: string;
  nonce: number;
  stake: string;
  stakeRaw: string;
  delegation: string | null;
  agent: {
    name: string | null;
    address: string;
    registeredAt: number | null;
    metadata: Record<string, unknown>;
  } | null;
  miner: {
    name: string | null;
    active: boolean;
    tier: string | null;
    registeredAt: number | null;
    lastHeartbeat: number | null;
    reputationBps: number | null;
    ipPrefix: string | null;
  } | null;
  validator: {
    stake: string;
    stakeRaw: string;
    weight: number;
    commissionBps: number;
    delegatedBy: string | null;
    jailed: boolean;
    uptime?: { produced_blocks: number; expected_blocks: number; signed_blocks: number; uptime_pct: number };
  } | null;
  transactions: {
    hash: string;
    txType: string;
    from: string;
    to: string | null;
    amount: string | null;
    amountRaw?: string | null;
    blockHeight: number;
    timestamp: number;
    nonce: number;
  }[];
  transactionCount: number;
  createdTokens: {
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    tokenId: string;
  }[];
  rewardSamples: {
    blockHeight: number;
    timestamp: number;
    amount: string;
    rewardType: string;
  }[];
  estimates: {
    firstActivityBlock: number;
    lastActivityBlock: number;
    activeBlocks: number;
    avgRewardPerBlock: string;
    estimatedTotalRewards: string;
  };
  timeline: {
    firstSeen: { block: number; timestamp: number; type: string } | null;
    lastSeen: { block: number; timestamp: number; type: string } | null;
  };
}

function formatDate(ts: number): string {
  if (!ts) return "N/A";
  return new Date(ts * 1000).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "UTC", timeZoneName: "short",
  });
}

function truncate(s: string, n = 12): string {
  if (s.length <= n * 2) return s;
  return `${s.slice(0, n)}...${s.slice(-n)}`;
}

function Badge({ children, color = "orange" }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    orange: "bg-orange-500/10 text-orange-400",
    green: "bg-green-500/10 text-green-400",
    red: "bg-red-500/10 text-red-400",
    yellow: "bg-yellow-500/10 text-yellow-400",
    blue: "bg-blue-500/10 text-blue-400",
    gray: "bg-gray-500/10 text-gray-400",
  };
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colors[color] || colors.gray}`}>{children}</span>;
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-5 py-3 border-b border-[#2a2a2a] hover:bg-[#222] transition-colors text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
        <Icon className="h-4 w-4 text-orange-500" />
        <h3 className="font-semibold text-sm text-gray-200">{title}</h3>
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
      <span className={`text-sm text-gray-200 break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

export default function InvestigatePage() {
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<"mainnet" | "testnet">("mainnet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InvestigationResult | null>(null);

  const handleAuth = useCallback(() => {
    if (secret.trim()) {
      setAuthenticated(true);
    }
  }, [secret]);

  const handleInvestigate = useCallback(async () => {
    const addr = address.trim().toLowerCase();
    if (!addr || !/^[0-9a-f]{64}$/.test(addr)) {
      setError("Invalid address — must be 64-char hex");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/ops/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr, secret, network }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        if (res.status === 401) setAuthenticated(false);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [address, secret, network]);

  // Auth gate
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center">
        <div className="w-full max-w-sm p-8 rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a]">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="h-6 w-6 text-orange-500" />
            <h1 className="text-xl font-bold text-gray-100">Ops Access</h1>
          </div>
          <input
            type="password"
            placeholder="Enter ops secret"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAuth()}
            className="w-full px-4 py-2.5 rounded-lg bg-[#111] border border-[#333] text-gray-200 placeholder-gray-600 text-sm focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={handleAuth}
            className="w-full mt-4 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm transition-colors"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] text-gray-200">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-7 w-7 text-orange-500" />
          <div>
            <h1 className="text-2xl font-bold">Address Investigation</h1>
            <p className="text-sm text-gray-500">Internal ops tool — not public</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-6">
          <select
            value={network}
            onChange={e => setNetwork(e.target.value as "mainnet" | "testnet")}
            className="px-3 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-sm text-gray-300 focus:outline-none focus:border-orange-500"
          >
            <option value="mainnet">Mainnet</option>
            <option value="testnet">Testnet</option>
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Enter address (64-char hex)"
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleInvestigate()}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-sm text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-orange-500"
            />
          </div>
          <button
            onClick={handleInvestigate}
            disabled={loading}
            className="px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium text-sm transition-colors"
          >
            {loading ? "Investigating..." : "Investigate"}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 mb-6 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Overview Card */}
            <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Balance</p>
                  <p className="text-lg font-bold text-orange-400">{result.balance} CLAW</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Staked</p>
                  <p className="text-lg font-bold text-yellow-400">{result.stake} CLAW</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Nonce (TX sent)</p>
                  <p className="text-lg font-bold text-gray-200">{result.nonce}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Value</p>
                  <p className="text-lg font-bold text-green-400">
                    {(Number(result.balanceRaw) / 1e9 + Number(result.stakeRaw) / 1e9).toLocaleString("en-US", { maximumFractionDigits: 2 })} CLAW
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#2a2a2a]">
                <p className="text-xs font-mono text-gray-500 break-all">{result.address}</p>
                <div className="flex gap-2 mt-2">
                  <Badge color="orange">{result.network}</Badge>
                  {result.agent && <Badge color="blue">Agent: {result.agent.name}</Badge>}
                  {result.miner && <Badge color={result.miner.active ? "green" : "red"}>Miner: {result.miner.active ? "Active" : "Inactive"}</Badge>}
                  {result.validator && <Badge color={result.validator.jailed ? "red" : "green"}>Validator</Badge>}
                  {result.createdTokens.length > 0 && <Badge color="yellow">{result.createdTokens.length} Token(s)</Badge>}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <Section title="Timeline" icon={Clock}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-[#111] border border-[#2a2a2a]">
                  <p className="text-xs text-gray-500 mb-1">First Seen</p>
                  {result.timeline.firstSeen ? (
                    <>
                      <p className="text-sm text-gray-200">{formatDate(result.timeline.firstSeen.timestamp)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Block #{result.timeline.firstSeen.block.toLocaleString()} — {result.timeline.firstSeen.type}
                      </p>
                    </>
                  ) : <p className="text-sm text-gray-500">No transactions</p>}
                </div>
                <div className="p-3 rounded-lg bg-[#111] border border-[#2a2a2a]">
                  <p className="text-xs text-gray-500 mb-1">Last Seen</p>
                  {result.timeline.lastSeen ? (
                    <>
                      <p className="text-sm text-gray-200">{formatDate(result.timeline.lastSeen.timestamp)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Block #{result.timeline.lastSeen.block.toLocaleString()} — {result.timeline.lastSeen.type}
                      </p>
                    </>
                  ) : <p className="text-sm text-gray-500">No transactions</p>}
                </div>
              </div>
              {result.estimates.activeBlocks > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-[#111] border border-[#2a2a2a]">
                  <p className="text-xs text-gray-500 mb-1">Estimated Reward Income</p>
                  <p className="text-sm text-gray-200">
                    ~<strong className="text-orange-400">{Number(result.estimates.estimatedTotalRewards).toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong> CLAW
                    over {result.estimates.activeBlocks.toLocaleString()} blocks
                    <span className="text-gray-500 ml-2">(avg {result.estimates.avgRewardPerBlock} CLAW/block)</span>
                  </p>
                </div>
              )}
            </Section>

            {/* Agent Info */}
            {result.agent && (
              <Section title="Agent Identity" icon={User}>
                <Field label="Name" value={result.agent.name || "—"} />
                <Field label="Address" value={result.agent.address} mono />
                <Field label="Registered At" value={result.agent.registeredAt ? `Block #${result.agent.registeredAt.toLocaleString()}` : "—"} />
                {Object.keys(result.agent.metadata).length > 0 && (
                  <Field label="Metadata" value={<pre className="text-xs">{JSON.stringify(result.agent.metadata, null, 2)}</pre>} />
                )}
              </Section>
            )}

            {/* Miner Info */}
            {result.miner && (
              <Section title="Miner Info" icon={Pickaxe}>
                <Field label="Name" value={result.miner.name || "—"} />
                <Field label="Status" value={result.miner.active ? <Badge color="green">Active</Badge> : <Badge color="red">Inactive</Badge>} />
                <Field label="Tier" value={result.miner.tier || "—"} />
                <Field label="Registered At" value={result.miner.registeredAt ? `Block #${result.miner.registeredAt.toLocaleString()}` : "—"} />
                <Field label="Last Heartbeat" value={result.miner.lastHeartbeat ? `Block #${result.miner.lastHeartbeat.toLocaleString()}` : "—"} />
                <Field label="Reputation" value={result.miner.reputationBps != null ? `${result.miner.reputationBps} bps (${(result.miner.reputationBps / 100).toFixed(0)}%)` : "—"} />
                <Field label="IP Prefix" value={result.miner.ipPrefix || "—"} />
                {result.rewardSamples.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                    <p className="text-xs text-gray-500 mb-2">Reward Samples</p>
                    <div className="space-y-1">
                      {result.rewardSamples.map((s, i) => (
                        <div key={i} className="flex gap-4 text-xs">
                          <span className="text-gray-500">Block #{s.blockHeight.toLocaleString()}</span>
                          <span className="text-orange-400">{s.amount} CLAW</span>
                          <span className="text-gray-500">{s.rewardType}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Validator Info */}
            {result.validator && (
              <Section title="Validator Info" icon={Landmark}>
                <Field label="Stake" value={`${result.validator.stake} CLAW`} />
                <Field label="Weight" value={result.validator.weight.toString()} />
                <Field label="Commission" value={`${result.validator.commissionBps} bps (${(result.validator.commissionBps / 100).toFixed(0)}%)`} />
                <Field label="Delegated By" value={result.validator.delegatedBy || "Self"} mono />
                <Field label="Jailed" value={result.validator.jailed ? <Badge color="red">Yes</Badge> : <Badge color="green">No</Badge>} />
                {result.validator.uptime && (
                  <>
                    <Field label="Uptime" value={`${(result.validator.uptime.uptime_pct).toFixed(1)}%`} />
                    <Field label="Blocks Produced" value={`${result.validator.uptime.produced_blocks} / ${result.validator.uptime.expected_blocks}`} />
                  </>
                )}
              </Section>
            )}

            {/* Created Tokens */}
            {result.createdTokens.length > 0 && (
              <Section title={`Created Tokens (${result.createdTokens.length})`} icon={Coins}>
                <div className="space-y-3">
                  {result.createdTokens.map((t, i) => (
                    <div key={i} className="p-3 rounded-lg bg-[#111] border border-[#2a2a2a]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-gray-200">{t.name}</span>
                        <Badge color="yellow">{t.symbol}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        Supply: {BigInt(t.totalSupply).toLocaleString()} — Decimals: {t.decimals}
                      </p>
                      <p className="text-xs font-mono text-gray-600 mt-1">{t.tokenId}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Transaction History */}
            <Section title={`Transactions (${result.transactionCount})`} icon={ArrowRightLeft}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-[#2a2a2a]">
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Block</th>
                      <th className="text-left py-2 px-2">Time (UTC)</th>
                      <th className="text-left py-2 px-2">Type</th>
                      <th className="text-left py-2 px-2">Amount</th>
                      <th className="text-left py-2 px-2">To</th>
                      <th className="text-left py-2 px-2">TX Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.transactions].sort((a, b) => a.blockHeight - b.blockHeight).map((tx, i) => (
                      <tr key={tx.hash} className="border-b border-[#1f1f1f] hover:bg-[#1f1f1f]">
                        <td className="py-2 px-2 text-gray-500">{tx.nonce}</td>
                        <td className="py-2 px-2">
                          <a href={`/block/${tx.blockHeight}`} className="text-orange-400 hover:underline">
                            {tx.blockHeight.toLocaleString()}
                          </a>
                        </td>
                        <td className="py-2 px-2 text-gray-400">{formatDate(tx.timestamp)}</td>
                        <td className="py-2 px-2">
                          <Badge color={
                            tx.txType === "StakeDeposit" ? "yellow" :
                            tx.txType === "MinerHeartbeat" ? "green" :
                            tx.txType === "TokenCreate" ? "blue" :
                            tx.txType === "MinerRegister" || tx.txType === "AgentRegister" ? "orange" :
                            "gray"
                          }>{tx.txType}</Badge>
                        </td>
                        <td className="py-2 px-2 text-gray-200">{tx.amount ? `${tx.amount} CLAW` : "—"}</td>
                        <td className="py-2 px-2 font-mono text-gray-400">
                          {tx.to ? (
                            <a href={`/address/${tx.to}`} className="hover:text-orange-400">{truncate(tx.to, 6)}</a>
                          ) : "—"}
                        </td>
                        <td className="py-2 px-2 font-mono text-gray-500">
                          <a href={`/tx/${tx.hash}`} className="hover:text-orange-400">{truncate(tx.hash, 8)}</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Delegation Info */}
            {result.delegation && (
              <Section title="Stake Delegation" icon={Activity} defaultOpen={false}>
                <Field label="Delegated To" value={result.delegation} mono />
                <Field label="Self-Delegated" value={result.delegation === result.address ? "Yes" : "No"} />
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
