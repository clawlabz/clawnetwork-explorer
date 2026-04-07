import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ValidatorHistoryCharts } from "@/components/ValidatorHistoryCharts";
import {
  getValidatorDetail,
  getAgentScore,
  getServerNetwork,
  formatCLAW,
  truncateAddress,
  type ValidatorDetail,
} from "@/lib/rpc";
import { ArrowLeft, Shield, TrendingUp, Zap, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

interface ValidatorDetailPageProps {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: ValidatorDetailPageProps) {
  const { address } = await params;
  return {
    title: `Validator ${truncateAddress(address)} — ClawNetwork Explorer`,
  };
}

export default async function ValidatorDetailPage({ params }: ValidatorDetailPageProps) {
  const { address } = await params;
  const network = await getServerNetwork();

  let validator: ValidatorDetail | null = null;
  let agentScore = null;
  let fetchError: string | null = null;

  try {
    [validator, agentScore] = await Promise.all([
      getValidatorDetail(address, network),
      getAgentScore(address, network),
    ]);

    if (!validator) {
      fetchError = "Validator not found";
    }
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to fetch validator data";
  }

  if (fetchError || !validator) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-8 flex-1">
          <Link href="/validators" className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Validators
          </Link>
          <div className="rounded-xl border border-border bg-surface/50 p-6 text-center">
            <p className="text-sm text-muted mb-2">{fetchError || "Validator not found"}</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const stakeFormatted = formatCLAW(validator.stake || "0");
  const commissionStr = validator.commission_bps ? (validator.commission_bps / 100).toFixed(2) : "N/A";
  const uptimeStr = validator.uptime?.uptime_pct ? (validator.uptime.uptime_pct * 100).toFixed(2) : "N/A";

  const statusCards = [
    {
      label: "Stake",
      value: stakeFormatted,
      icon: Shield,
    },
    {
      label: "Weight",
      value: validator.weight.toFixed(2),
      icon: TrendingUp,
    },
    {
      label: "Commission",
      value: `${commissionStr}%`,
      icon: Zap,
    },
    {
      label: "Uptime",
      value: `${uptimeStr}%`,
      icon: CheckCircle,
    },
  ];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 flex-1">
        <Link href="/validators" className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Validators
        </Link>

        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              {truncateAddress(address, 12)}
            </h1>
            <div className="flex items-center gap-2">
              {validator.jailed ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  Jailed
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-400">
                  <CheckCircle className="h-3 w-3" />
                  Active
                </div>
              )}
            </div>
            <p className="text-xs text-muted mt-2 font-mono break-all">{address}</p>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {statusCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="rounded-xl border border-border bg-surface/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted uppercase tracking-wider">{card.label}</span>
                    <Icon className="h-4 w-4 text-primary/60" />
                  </div>
                  <span className="text-lg font-bold text-primary break-all">{card.value}</span>
                </div>
              );
            })}
          </div>

          {/* Agent Score */}
          {agentScore && (
            <div className="rounded-xl border border-border bg-surface/50 p-6">
              <h2 className="font-semibold mb-4">Agent Score Breakdown</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <div className="p-3 rounded-lg bg-surface/50 border border-border/50">
                  <p className="text-xs text-muted mb-1">Total</p>
                  <p className="text-lg font-bold text-primary">{agentScore.total.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface/50 border border-border/50">
                  <p className="text-xs text-muted mb-1">Activity</p>
                  <p className="text-sm font-bold text-primary">{agentScore.activity.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface/50 border border-border/50">
                  <p className="text-xs text-muted mb-1">Uptime</p>
                  <p className="text-sm font-bold text-primary">{agentScore.uptime.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface/50 border border-border/50">
                  <p className="text-xs text-muted mb-1">Block Prod</p>
                  <p className="text-sm font-bold text-primary">{agentScore.block_production.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface/50 border border-border/50">
                  <p className="text-xs text-muted mb-1">Economic</p>
                  <p className="text-sm font-bold text-primary">{agentScore.economic.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface/50 border border-border/50">
                  <p className="text-xs text-muted mb-1">Platform</p>
                  <p className="text-sm font-bold text-primary">{agentScore.platform.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {/* History Charts */}
          <ValidatorHistoryCharts address={address} network={network} />

          {/* Additional Info */}
          {validator.uptime && (
            <div className="rounded-xl border border-border bg-surface/50 p-6">
              <h2 className="font-semibold mb-4">Block Production</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="p-3 rounded-lg bg-surface/50 border border-border/50">
                  <p className="text-xs text-muted mb-1">Produced</p>
                  <p className="text-lg font-bold text-primary">{validator.uptime.produced_blocks}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface/50 border border-border/50">
                  <p className="text-xs text-muted mb-1">Expected</p>
                  <p className="text-lg font-bold text-primary">{validator.uptime.expected_blocks}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface/50 border border-border/50">
                  <p className="text-xs text-muted mb-1">Signed</p>
                  <p className="text-lg font-bold text-primary">{validator.uptime.signed_blocks}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface/50 border border-border/50">
                  <p className="text-xs text-muted mb-1">Uptime %</p>
                  <p className="text-lg font-bold text-primary">{(validator.uptime.uptime_pct * 100).toFixed(2)}%</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
