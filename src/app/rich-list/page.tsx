import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  getServerNetwork,
  formatCLAW,
  truncateAddress,
  getTotalSupplyAudit,
} from "@/lib/rpc";
import { ArrowLeft, Trophy, Wallet } from "lucide-react";

export const metadata = { title: "Rich List — ClawNetwork Explorer" };

interface HoldingEntry {
  address: string;
  balance: string;
  stake: string;
  total: string;
}

export default async function RichListPage() {
  const network = await getServerNetwork();
  let holdings: HoldingEntry[] = [];
  let totalSupply = "0";
  let fetchError: string | null = null;

  try {
    const data = await getTotalSupplyAudit(network);
    totalSupply = (data.totalSupply as string) || "0";
    const allBalances = (data.balances as { address: string; balance: string }[]) || [];
    const allStakes = (data.stakes as { address: string; stake: string }[]) || [];

    // Merge balances and stakes by address
    const holdingMap = new Map<string, { balance: bigint; stake: bigint }>();
    for (const b of allBalances) {
      const existing = holdingMap.get(b.address) || { balance: BigInt(0), stake: BigInt(0) };
      existing.balance = BigInt(b.balance || "0");
      holdingMap.set(b.address, existing);
    }
    for (const s of allStakes) {
      const existing = holdingMap.get(s.address) || { balance: BigInt(0), stake: BigInt(0) };
      existing.stake = BigInt(s.stake || "0");
      holdingMap.set(s.address, existing);
    }

    // Sort by total holdings (balance + stake) descending, take top 100
    holdings = Array.from(holdingMap.entries())
      .map(([address, { balance, stake }]) => ({
        address,
        balance: balance.toString(),
        stake: stake.toString(),
        total: (balance + stake).toString(),
      }))
      .sort((a, b) => {
        const aBig = BigInt(a.total);
        const bBig = BigInt(b.total);
        return bBig > aBig ? 1 : bBig < aBig ? -1 : 0;
      })
      .slice(0, 100);
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to fetch balance data";
  }

  const totalSupplyFormatted = formatCLAW(totalSupply);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <a
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </a>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Rich List</h1>
            <p className="text-xs text-muted mt-0.5">Top 100 addresses by CLAW balance</p>
          </div>
        </div>

        {/* Total Supply Card */}
        <div className="mb-6">
          <div className="rounded-xl border border-border bg-surface/50 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Wallet className="h-5 w-5 text-primary" />
              <span className="text-xs text-muted uppercase tracking-wider">Total Supply</span>
            </div>
            <p className="text-3xl font-bold text-primary">{totalSupplyFormatted}</p>
            <p className="text-xs text-muted mt-2">CLAW</p>
          </div>
        </div>

        {/* Rich List Table */}
        {fetchError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-8 text-center">
            <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to load rich list</h2>
            <p className="text-sm text-muted">{fetchError}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left w-12">Rank</th>
                    <th className="px-4 py-3 text-left">Address</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-right">Staked</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">% of Supply</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted">
                        No balance data found
                      </td>
                    </tr>
                  ) : (
                    holdings.map((entry, i) => {
                      const percentOfSupply = (() => {
                        try {
                          const total = BigInt(entry.total || "0");
                          const supply = BigInt(totalSupply || "1");
                          if (supply === BigInt(0)) return "0.00%";
                          const pct = Number(total * BigInt(10000) / supply) / 100;
                          return `${pct.toFixed(2)}%`;
                        } catch {
                          return "—";
                        }
                      })();
                      const hasStake = BigInt(entry.stake || "0") > BigInt(0);

                      return (
                        <tr key={entry.address} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                          <td className="px-4 py-3 font-[JetBrains_Mono] text-muted text-xs">
                            #{i + 1}
                          </td>
                          <td className="px-4 py-3">
                            <a
                              href={`/address/${entry.address}`}
                              className="font-[JetBrains_Mono] text-xs text-primary hover:underline"
                            >
                              {truncateAddress(entry.address, 8)}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-right font-[JetBrains_Mono] text-xs">
                            {formatCLAW(entry.balance)}
                          </td>
                          <td className="px-4 py-3 text-right font-[JetBrains_Mono] text-xs">
                            {hasStake ? (
                              <span className="text-purple-400">{formatCLAW(entry.stake)}</span>
                            ) : (
                              <span className="text-muted/50">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-[JetBrains_Mono] font-bold text-xs">
                              {formatCLAW(entry.total)}
                            </span>
                            <span className="text-muted font-normal ml-1">CLAW</span>
                          </td>
                          <td className="px-4 py-3 text-right font-[JetBrains_Mono] text-xs text-muted">
                            {percentOfSupply}
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
