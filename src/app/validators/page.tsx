import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  getValidators,
  getStakeDelegation,
  getValidatorDetail,
  getHealth,
  formatCLAW,
  truncateAddress,
  type ValidatorDetail,
} from "@/lib/rpc";
import { Shield, ArrowLeft, Users, Layers, Blocks, Activity } from "lucide-react";

export const metadata = { title: "Validators — ClawNetwork Explorer" };

interface ValidatorBase {
  address: string;
  stake: string;
  weight: number;
  agentScore: number;
}

interface EnrichedValidator {
  address: string;
  stake: string;
  weight: number;
  agentScore: number;
  commission_bps?: number;
  delegatedBy: string | null;
  uptime_pct?: number;
  produced_blocks?: number;
  jailed?: boolean;
}

/** Format CLAW amount with K/M suffixes for large values */
function formatCLAWCompact(baseUnits: string): string {
  const formatted = formatCLAW(baseUnits);
  const num = parseFloat(formatted);
  if (isNaN(num)) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return formatted;
}

export default async function ValidatorsPage() {
  let validators: EnrichedValidator[] = [];
  let fetchError: string | null = null;
  let epoch = 0;

  try {
    const [rawValidators, health] = await Promise.all([
      getValidators() as Promise<ValidatorBase[]>,
      getHealth().catch(() => ({} as Record<string, unknown>)),
    ]);

    epoch = (health?.epoch as number) || 0;

    const sorted = [...rawValidators].sort((a, b) => b.weight - a.weight);

    // Fetch detail + delegation for each validator in parallel
    const enriched = await Promise.all(
      sorted.map(async (v): Promise<EnrichedValidator> => {
        const [detail, delegation] = await Promise.all([
          getValidatorDetail(v.address),
          getStakeDelegation(v.address),
        ]);

        return {
          address: v.address,
          stake: detail?.stake ?? v.stake,
          weight: detail?.weight ?? v.weight,
          agentScore: detail?.agentScore ?? v.agentScore,
          commission_bps: detail?.commission_bps,
          delegatedBy: detail?.delegatedBy !== undefined ? detail.delegatedBy : delegation,
          uptime_pct: detail?.uptime?.uptime_pct,
          produced_blocks: detail?.uptime?.produced_blocks,
          jailed: detail?.jailed,
        };
      }),
    );

    validators = enriched;
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to fetch validator data";
  }

  const totalWeight = validators.reduce((sum, v) => sum + v.weight, 0);
  const totalStake = validators.reduce((sum, v) => {
    try { return sum + BigInt(v.stake || "0"); } catch { return sum; }
  }, BigInt(0));
  const activeCount = validators.filter((v) => !v.jailed).length;
  const avgScore = validators.length > 0
    ? (validators.reduce((sum, v) => sum + v.agentScore, 0) / validators.length).toFixed(1)
    : "0";

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <a href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </a>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Validators</h1>
            <p className="text-xs text-muted mt-0.5">Active validators securing the network</p>
          </div>
        </div>

        {/* Top Stats Bar */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
          <TopStatCard icon={Users} label="Active Validators" value={activeCount.toString()} color="text-purple-400" />
          <TopStatCard icon={Layers} label="Total Staked" value={`${formatCLAWCompact(totalStake.toString())} CLAW`} color="text-primary" />
          <TopStatCard icon={Activity} label="Avg Agent Score" value={avgScore} color="text-yellow-400" />
          <TopStatCard icon={Blocks} label="Epoch" value={epoch.toString()} color="text-orange-500" />
        </div>

        {fetchError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-8 text-center">
            <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to load validators</h2>
            <p className="text-sm text-muted">{fetchError}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left w-12">Rank</th>
                    <th className="px-4 py-3 text-left">Validator</th>
                    <th className="px-4 py-3 text-left">Stake</th>
                    <th className="px-4 py-3 text-left">Weight</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">Commission</th>
                    <th className="px-4 py-3 text-left">Agent Score</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">Blocks</th>
                    <th className="px-4 py-3 text-left">Delegated By</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {validators.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted">No validators found</td>
                    </tr>
                  ) : (
                    validators.map((v, i) => {
                      const weightPct = totalWeight > 0 ? (v.weight / totalWeight) * 100 : 0;
                      const scorePct = Math.min(100, v.agentScore);
                      const scoreColor = scorePct >= 95 ? "text-green-400" : scorePct >= 80 ? "text-yellow-400" : "text-red-400";
                      const scoreBarColor = scorePct >= 95 ? "bg-green-400" : scorePct >= 80 ? "bg-yellow-400" : "bg-red-400";

                      const status = v.jailed ? "Jailed" : (v.agentScore > 0 || BigInt(v.stake || "0") > BigInt(0)) ? "Active" : "Idle";
                      const statusDotColor = status === "Active" ? "bg-green-400" : status === "Jailed" ? "bg-red-400" : "bg-yellow-400";
                      const statusTextColor = status === "Active" ? "text-green-400" : status === "Jailed" ? "text-red-400" : "text-yellow-400";
                      const statusBgColor = status === "Active" ? "bg-green-500/10" : status === "Jailed" ? "bg-red-500/10" : "bg-yellow-500/10";

                      const commissionDisplay = v.commission_bps !== undefined
                        ? `${(v.commission_bps / 100).toFixed(0)}%`
                        : null;

                      return (
                        <tr key={v.address} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                          {/* Rank */}
                          <td className="px-4 py-3 font-[JetBrains_Mono] text-muted text-xs">
                            #{i + 1}
                          </td>

                          {/* Validator Address */}
                          <td className="px-4 py-3">
                            <a
                              href={`/address/${v.address}`}
                              className="font-[JetBrains_Mono] text-xs text-primary hover:underline"
                            >
                              {truncateAddress(v.address, 8)}
                            </a>
                          </td>

                          {/* Stake */}
                          <td className="px-4 py-3 font-[JetBrains_Mono] font-bold text-xs">
                            {formatCLAWCompact(v.stake)}
                            <span className="text-muted font-normal ml-1">CLAW</span>
                          </td>

                          {/* Weight with progress bar */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 rounded-full bg-border overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary transition-all"
                                  style={{ width: `${Math.min(100, weightPct)}%` }}
                                />
                              </div>
                              <span className="font-[JetBrains_Mono] text-xs text-muted">
                                {weightPct.toFixed(1)}%
                              </span>
                            </div>
                          </td>

                          {/* Commission */}
                          <td className="px-4 py-3 hidden md:table-cell font-[JetBrains_Mono] text-xs text-muted">
                            {commissionDisplay ?? <span className="text-muted/50">&mdash;</span>}
                          </td>

                          {/* Agent Score with color coding */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 rounded-full bg-border overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${scoreBarColor}`}
                                  style={{ width: `${scorePct}%` }}
                                />
                              </div>
                              <span className={`font-[JetBrains_Mono] text-xs font-medium ${scoreColor}`}>
                                {v.agentScore}
                              </span>
                            </div>
                          </td>

                          {/* Blocks Produced */}
                          <td className="px-4 py-3 hidden md:table-cell font-[JetBrains_Mono] text-xs text-muted">
                            {v.produced_blocks !== undefined
                              ? v.produced_blocks.toLocaleString()
                              : <span className="text-muted/50">&mdash;</span>
                            }
                          </td>

                          {/* Delegated By */}
                          <td className="px-4 py-3 font-[JetBrains_Mono] text-xs">
                            {v.delegatedBy ? (
                              <a
                                href={`/address/${v.delegatedBy}`}
                                className="text-primary hover:underline"
                              >
                                {truncateAddress(v.delegatedBy)}
                              </a>
                            ) : (
                              <span className="text-muted">Self-staked</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBgColor} ${statusTextColor}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${statusDotColor}`} />
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

/* ── Top Stat Card ── */

function TopStatCard({
  icon: Icon,
  label,
  value,
  color = "text-primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
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
    </div>
  );
}
