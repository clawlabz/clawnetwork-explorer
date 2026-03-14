import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getBlockNumber, getBlock, toHexAddress, truncateAddress } from "@/lib/rpc";
import { Shield, ArrowLeft } from "lucide-react";

export const metadata = { title: "Validators" };

interface ValidatorStats {
  address: string;
  blocksProposed: number;
  lastActive: number;
}

async function getValidatorsFromBlocks(): Promise<ValidatorStats[]> {
  const height = await getBlockNumber();
  const count = Math.min(height, 200);
  const start = Math.max(0, height - count + 1);

  const blockPromises = [];
  for (let i = height; i >= start; i--) {
    blockPromises.push(getBlock(i));
  }

  const blocks = (await Promise.all(blockPromises)).filter(Boolean) as Record<string, unknown>[];
  const map = new Map<string, { count: number; lastActive: number }>();

  for (const block of blocks) {
    const addr = toHexAddress(block.validator);
    if (!addr) continue;
    const ts = block.timestamp as number || 0;
    const existing = map.get(addr);
    if (existing) {
      existing.count++;
      if (ts > existing.lastActive) existing.lastActive = ts;
    } else {
      map.set(addr, { count: 1, lastActive: ts });
    }
  }

  return Array.from(map.entries())
    .map(([address, { count, lastActive }]) => ({ address, blocksProposed: count, lastActive }))
    .sort((a, b) => b.blocksProposed - a.blocksProposed);
}

export default async function ValidatorsPage() {
  let validators: ValidatorStats[] = [];
  let fetchError: string | null = null;

  try {
    validators = await getValidatorsFromBlocks();
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to fetch validator data";
  }

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
            <p className="text-xs text-muted mt-0.5">Block proposers from the last 200 blocks</p>
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
                    <th className="px-6 py-3 text-left">Blocks Proposed</th>
                    <th className="px-6 py-3 text-left">Share</th>
                    <th className="px-6 py-3 text-left">Last Active</th>
                    <th className="px-6 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {validators.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-muted">No validators found</td></tr>
                  ) : (
                    (() => {
                      const totalBlocks = validators.reduce((sum, x) => sum + x.blocksProposed, 0);
                      return validators.map((v, i) => {
                      const share = totalBlocks > 0 ? ((v.blocksProposed / totalBlocks) * 100).toFixed(1) : "0";
                      const isRecent = v.lastActive > 0 && (Date.now() / 1000 - v.lastActive) < 300;
                      return (
                        <tr key={v.address} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                          <td className="px-6 py-3 text-muted">{i + 1}</td>
                          <td className="px-6 py-3 font-mono text-xs">
                            <a href={`/address/${v.address}`} className="text-primary hover:underline">
                              {truncateAddress(v.address, 8)}
                            </a>
                          </td>
                          <td className="px-6 py-3 font-bold">{v.blocksProposed}</td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 rounded-full bg-border overflow-hidden">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                              </div>
                              <span className="text-xs text-muted">{share}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-muted text-xs">
                            {v.lastActive ? new Date(v.lastActive * 1000).toLocaleString() : "—"}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${isRecent ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${isRecent ? "bg-green-400" : "bg-yellow-400"}`} />
                              {isRecent ? "Active" : "Idle"}
                            </span>
                          </td>
                        </tr>
                      );
                    });
                    })()
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
