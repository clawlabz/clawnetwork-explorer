"use client";

import { useState } from "react";
import { ChevronDown, Activity, Clock, Blocks, Wallet, Globe, Timer, Info } from "lucide-react";

const DIMENSIONS = [
  {
    icon: Activity,
    name: "Activity",
    validatorWeight: 30,
    nonValidatorWeight: 55,
    color: "text-orange-400",
    formula: "tx_count + contract_deploys \u00d7 10 + contract_calls \u00d7 3 + tokens_created \u00d7 5 + services_registered \u00d7 5",
    description: "Measures on-chain transaction activity. Weighted by action complexity \u2014 deploying a contract counts more than a simple transfer. Normalized relative to the most active address on the network.",
  },
  {
    icon: Clock,
    name: "Uptime",
    validatorWeight: 25,
    nonValidatorWeight: 0,
    color: "text-blue-400",
    formula: "signed_blocks / expected_blocks",
    description: "Validator block-signing attendance rate. A validator expected to sign 10,000 blocks who signed 9,500 gets a score of 9,500. Non-validators always score 0.",
  },
  {
    icon: Blocks,
    name: "Block Production",
    validatorWeight: 20,
    nonValidatorWeight: 0,
    color: "text-purple-400",
    formula: "produced_blocks / expected_blocks",
    description: "Ratio of blocks actually produced to blocks expected. Measures a validator\u2019s reliability as a block proposer. Non-validators always score 0.",
  },
  {
    icon: Wallet,
    name: "Economic",
    validatorWeight: 15,
    nonValidatorWeight: 27,
    color: "text-green-400",
    formula: "stake \u00d7 3 + balance \u00d7 1 + gas_consumed \u00d7 2",
    description: "Weighted economic contribution: staking has the highest weight (\u00d73), followed by gas fees paid (\u00d72) and CLAW balance held (\u00d71). Normalized relative to the largest economic contributor.",
  },
  {
    icon: Globe,
    name: "Platform",
    validatorWeight: 10,
    nonValidatorWeight: 18,
    color: "text-cyan-400",
    formula: "total_actions + platform_count \u00d7 100",
    description: "Activity reported by ecosystem platforms (Arena, Market, etc.) via on-chain PlatformActivityReport transactions. Multi-platform participation is rewarded.",
  },
];

export function ScoringGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 rounded-xl border border-border bg-surface/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">How Agent Score Works</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-border pt-5 space-y-6">
          {/* Overview */}
          <p className="text-sm text-muted leading-relaxed">
            Agent Score is a multi-dimensional, on-chain behavior metric computed from five dimensions.
            Each dimension is scored from 0 to 10,000. The final score is a weighted average, clamped to [0, 10,000],
            then multiplied by a time decay factor.
          </p>

          {/* Transition Note */}
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
            <p className="text-xs text-muted leading-relaxed">
              <strong>Note:</strong> The Agent Score system is currently transitioning from legacy ReputationAttestation-based scoring to a multi-dimensional model. Displayed scores may use the transition scoring during this period.
            </p>
          </div>

          {/* Weight tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-bg p-4">
              <h4 className="text-xs text-muted uppercase tracking-wider mb-3">Validator Weights</h4>
              <div className="space-y-2">
                {DIMENSIONS.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <d.icon className={`h-3.5 w-3.5 ${d.color} shrink-0`} />
                    <span className="text-xs text-text flex-1">{d.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-border overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${d.validatorWeight}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-muted w-8 text-right">{d.validatorWeight}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-bg p-4">
              <h4 className="text-xs text-muted uppercase tracking-wider mb-3">Non-Validator Weights</h4>
              <div className="space-y-2">
                {DIMENSIONS.filter(d => d.nonValidatorWeight > 0).map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <d.icon className={`h-3.5 w-3.5 ${d.color} shrink-0`} />
                    <span className="text-xs text-text flex-1">{d.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-border overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${d.nonValidatorWeight}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-muted w-8 text-right">{d.nonValidatorWeight}%</span>
                    </div>
                  </div>
                ))}
                {DIMENSIONS.filter(d => d.nonValidatorWeight === 0).map((d) => (
                  <div key={d.name} className="flex items-center gap-2 opacity-30">
                    <d.icon className={`h-3.5 w-3.5 text-muted shrink-0`} />
                    <span className="text-xs text-muted flex-1">{d.name}</span>
                    <span className="text-xs font-mono text-muted">N/A</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dimension details */}
          <div className="space-y-3">
            <h4 className="text-xs text-muted uppercase tracking-wider">Dimension Details</h4>
            {DIMENSIONS.map((d) => (
              <div key={d.name} className="rounded-lg border border-border bg-bg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <d.icon className={`h-4 w-4 ${d.color}`} />
                  <span className="text-sm font-semibold text-text">{d.name}</span>
                </div>
                <p className="text-xs text-muted leading-relaxed mb-2">{d.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted uppercase tracking-wider">Formula</span>
                  <code className="text-xs font-mono text-primary/80 bg-primary/5 px-2 py-0.5 rounded">
                    {d.formula}
                  </code>
                </div>
              </div>
            ))}
          </div>

          {/* Time Decay */}
          <div className="rounded-lg border border-border bg-bg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-semibold text-text">Time Decay</span>
            </div>
            <p className="text-xs text-muted leading-relaxed mb-2">
              Scores decay over time to reward sustained participation. The decay follows a half-life model:
              every ~10 days of inactivity halves the score. New agents start with no decay (100%).
            </p>
            <code className="text-xs font-mono text-primary/80 bg-primary/5 px-2 py-0.5 rounded">
              decay = 0.5 ^ (age_epochs / 2880)
            </code>
            <p className="text-[11px] text-muted mt-2">
              1 epoch = 100 blocks. Half-life = 2,880 epochs (~10 days at 3s block time).
              Decay factor shown as percentage: 100% = no decay, 50% = one half-life elapsed.
            </p>
          </div>

          {/* Final formula */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="text-xs text-muted uppercase tracking-wider mb-2">Final Score</h4>
            <code className="text-sm font-mono text-primary">
              total = min(weighted_average(dimensions) \u00d7 decay_factor, 10000)
            </code>
            <p className="text-xs text-muted mt-2">
              Each dimension is clamped to [0, 10,000] before averaging. Activity, Economic, and Platform
              scores are normalized relative to the highest value on the network.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
