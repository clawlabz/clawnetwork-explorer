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

interface BalanceEntry {
  address: string;
  balance: string;
}

export default async function RichListPage() {
  const network = await getServerNetwork();
  let balances: BalanceEntry[] = [];
  let totalSupply = "0";
  let fetchError: string | null = null;

  try {
    const data = await getTotalSupplyAudit(network);
    totalSupply = (data.totalSupply as string) || "0";
    const allBalances = (data.balances as BalanceEntry[]) || [];

    // Sort by balance descending and take top 100
    balances = allBalances
      .sort((a, b) => {
        try {
          const aBig = BigInt(a.balance || "0");
          const bBig = BigInt(b.balance || "0");
          return bBig > aBig ? 1 : bBig < aBig ? -1 : 0;
        } catch {
          return 0;
        }
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
                    <th className="px-4 py-3 text-right">% of Supply</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted">
                        No balance data found
                      </td>
                    </tr>
                  ) : (
                    balances.map((entry, i) => {
                      const percentOfSupply = (() => {
                        try {
                          const balance = BigInt(entry.balance || "0");
                          const supply = BigInt(totalSupply || "1");
                          if (supply === BigInt(0)) return "0.00%";
                          const pct = (Number(balance) / Number(supply)) * 100;
                          return `${pct.toFixed(2)}%`;
                        } catch {
                          return "—";
                        }
                      })();

                      return (
                        <tr key={entry.address} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                          {/* Rank */}
                          <td className="px-4 py-3 font-[JetBrains_Mono] text-muted text-xs">
                            #{i + 1}
                          </td>

                          {/* Address Link */}
                          <td className="px-4 py-3">
                            <a
                              href={`/address/${entry.address}`}
                              className="font-[JetBrains_Mono] text-xs text-primary hover:underline"
                            >
                              {truncateAddress(entry.address, 8)}
                            </a>
                          </td>

                          {/* Balance */}
                          <td className="px-4 py-3 text-right">
                            <span className="font-[JetBrains_Mono] font-bold text-xs">
                              {formatCLAW(entry.balance)}
                            </span>
                            <span className="text-muted font-normal ml-1">CLAW</span>
                          </td>

                          {/* Percentage */}
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
