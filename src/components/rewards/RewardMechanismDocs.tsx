import { REWARD_SCHEDULE } from "@/lib/rewards";

interface Props {
  currentHeight: number;
}

export function RewardMechanismDocs({ currentHeight }: Props) {
  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <h2 className="text-lg font-semibold">How Rewards Work</h2>
        <p className="text-sm text-muted mt-1">
          Every block (~3 seconds), CLAW is distributed from the Node Incentives Pool (40% of total supply, 4-year linear vesting).
        </p>
      </div>

      {/* Split diagram */}
      <div className="rounded-xl border border-border bg-surface/50 p-5">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Block Reward Split</h3>
        <div className="flex gap-2 mb-4">
          <div
            className="h-10 rounded-l-lg bg-purple-500/30 border border-purple-500/50 flex items-center justify-center text-xs font-bold text-purple-300"
            style={{ flex: 65 }}
          >
            Validators 65%
          </div>
          <div
            className="h-10 rounded-r-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-bold text-primary"
            style={{ flex: 35 }}
          >
            Miners 35%
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-4">
            <div className="font-semibold text-purple-300 mb-1">Validator Pool (65%)</div>
            <p className="text-muted text-xs">Distributed to active validators proportional to their weight (stake × 40% + agent score × 60%).</p>
            <p className="text-muted text-xs mt-2">Transaction fees: 50% to block proposer, 20% to ecosystem, 30% burned.</p>
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <div className="font-semibold text-primary mb-1">Miner Pool (35%)</div>
            <p className="text-muted text-xs">Distributed to all active miners proportional to their <code className="text-primary/80">reputation_bps</code> weight.</p>
            <p className="text-muted text-xs mt-2">Miners do not receive transaction fees — only block rewards.</p>
          </div>
        </div>
      </div>

      {/* Reward schedule */}
      <div className="rounded-xl border border-border bg-surface/50 p-5">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Reward Decay Schedule</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                <th className="px-3 py-2 text-left">Period</th>
                <th className="px-3 py-2 text-left">Years</th>
                <th className="px-3 py-2 text-right">CLAW/Block</th>
                <th className="px-3 py-2 text-right">Validator Pool</th>
                <th className="px-3 py-2 text-right">Miner Pool</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {REWARD_SCHEDULE.map((row) => {
                const isActive = currentHeight >= 2000 && (() => {
                  const adjusted = currentHeight - 2000;
                  const period = Math.min(5, Math.floor(adjusted / (2 * 10_512_000)));
                  return period === row.period || (row.period === 5 && period >= 5);
                })();
                return (
                  <tr
                    key={row.period}
                    className={`border-b border-border/50 ${isActive ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-3 py-2.5 font-[JetBrains_Mono] text-xs">
                      {row.label}
                      {isActive && (
                        <span className="ml-2 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">Current</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted">
                      Year {row.startYear}–{row.endYear ?? "∞"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-[JetBrains_Mono] text-xs font-bold">
                      {row.clawPerBlock}
                    </td>
                    <td className="px-3 py-2.5 text-right font-[JetBrains_Mono] text-xs text-purple-300">
                      {(row.clawPerBlock * 0.65).toFixed(4).replace(/\.?0+$/, "")}
                    </td>
                    <td className="px-3 py-2.5 text-right font-[JetBrains_Mono] text-xs text-primary">
                      {(row.clawPerBlock * 0.35).toFixed(4).replace(/\.?0+$/, "")}
                    </td>
                    <td className="px-3 py-2.5">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />Active
                        </span>
                      ) : (
                        <span className="text-xs text-muted/40">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reputation tiers */}
      <div className="rounded-xl border border-border bg-surface/50 p-5">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Miner Reputation Tiers</h3>
        <p className="text-xs text-muted mb-4">
          Reputation determines your weight in the miner pool. Older nodes get higher weight.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                <th className="px-3 py-2 text-left">Tier</th>
                <th className="px-3 py-2 text-left">Condition</th>
                <th className="px-3 py-2 text-right">Reputation bps</th>
                <th className="px-3 py-2 text-right">Relative Weight</th>
                <th className="px-3 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {[
                { tier: "Newcomer", condition: "< 7 days registered", bps: 2000, weight: "20%", color: "text-yellow-400", bg: "bg-yellow-500/5", note: "First ~7 days after MinerRegister tx" },
                { tier: "Established", condition: "7–30 days registered", bps: 5000, weight: "50%", color: "text-blue-400", bg: "bg-blue-500/5", note: "Stable node, growing influence" },
                { tier: "Veteran", condition: "> 30 days registered", bps: 10000, weight: "100%", color: "text-green-400", bg: "bg-green-500/5", note: "Full weight, maximum rewards" },
              ].map((row) => (
                <tr key={row.tier} className={`border-b border-border/50 ${row.bg}`}>
                  <td className={`px-3 py-2.5 font-semibold text-sm ${row.color}`}>{row.tier}</td>
                  <td className="px-3 py-2.5 text-xs text-muted">{row.condition}</td>
                  <td className="px-3 py-2.5 text-right font-[JetBrains_Mono] text-xs">{row.bps.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right font-[JetBrains_Mono] text-xs font-bold">{row.weight}</td>
                  <td className="px-3 py-2.5 text-xs text-muted">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 rounded-lg bg-border/20 p-3 text-xs text-muted">
          <strong className="text-text">Formula:</strong>{" "}
          <code className="text-primary/80">my_share = pool_per_block × my_reputation_bps ÷ Σ(all_active_miners_reputation_bps)</code>
          <br />
          <span className="mt-1 block">Miners must send a heartbeat every ~1,000 blocks (~50 min) or they become inactive and stop receiving rewards.</span>
        </div>
      </div>
    </div>
  );
}
