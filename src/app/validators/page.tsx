import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getValidators, getStakeDelegation, formatCLAW, truncateAddress } from "@/lib/rpc";
import { Shield, ArrowLeft } from "lucide-react";

export const metadata = { title: "Validators" };

interface Validator {
  address: string;
  stake: string;
  weight: number;
  agentScore: number;
}

export default async function ValidatorsPage() {
  let validators: Validator[] = [];
  let delegations: Map<string, string | null> = new Map();
  let fetchError: string | null = null;

  try {
    const raw = await getValidators() as Validator[];
    validators = [...raw].sort((a, b) => b.weight - a.weight);

    const delegationResults = await Promise.all(
      validators.map(v => getStakeDelegation(v.address))
    );
    validators.forEach((v, i) => {
      delegations.set(v.address, delegationResults[i]);
    });
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to fetch validator data";
  }

  const totalWeight = validators.reduce((sum, v) => sum + v.weight, 0);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <a href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </a>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Validators</h1>
            <p className="text-xs text-muted mt-0.5">Active validators on the network</p>
          </div>
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
                    <th className="px-6 py-3 text-left">#</th>
                    <th className="px-6 py-3 text-left">Address</th>
                    <th className="px-6 py-3 text-left">Stake (CLAW)</th>
                    <th className="px-6 py-3 text-left">Weight</th>
                    <th className="px-6 py-3 text-left">Agent Score</th>
                    <th className="px-6 py-3 text-left">Delegated By</th>
                    <th className="px-6 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {validators.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-8 text-center text-muted">No validators found</td></tr>
                  ) : (
                    validators.map((v, i) => {
                      const weightShare = totalWeight > 0 ? ((v.weight / totalWeight) * 100).toFixed(1) : "0";
                      const isActive = v.agentScore > 0 || BigInt(v.stake || "0") > BigInt(0);
                      return (
                        <tr key={v.address} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                          <td className="px-6 py-3 text-muted">{i + 1}</td>
                          <td className="px-6 py-3 font-mono text-xs">
                            <a href={`/address/${v.address}`} className="text-primary hover:underline">
                              {truncateAddress(v.address, 8)}
                            </a>
                          </td>
                          <td className="px-6 py-3 font-bold">{formatCLAW(v.stake)}</td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 rounded-full bg-border overflow-hidden">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${weightShare}%` }} />
                              </div>
                              <span className="text-xs text-muted">{v.weight}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-muted">{v.agentScore}</td>
                          <td className="px-6 py-3 font-mono text-xs">
                            {(() => {
                              const owner = delegations.get(v.address);
                              if (owner) {
                                return (
                                  <a href={`/address/${owner}`} className="text-primary hover:underline">
                                    {truncateAddress(owner)}
                                  </a>
                                );
                              }
                              return <span className="text-muted">Self-staked</span>;
                            })()}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${isActive ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-green-400" : "bg-yellow-400"}`} />
                              {isActive ? "Active" : "Idle"}
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
