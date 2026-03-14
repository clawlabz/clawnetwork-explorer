import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getBlockNumber, getBlock, toHexAddress, truncateAddress, formatCLAW } from "@/lib/rpc";
import { Coins, ArrowLeft } from "lucide-react";

export const metadata = { title: "Tokens" };

interface TokenInfo {
  tokenId: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  creator: string;
  blockHeight: number;
}

async function fetchInBatches<T>(fns: (() => Promise<T>)[], batchSize = 20): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < fns.length; i += batchSize) {
    const batch = await Promise.all(fns.slice(i, i + batchSize).map(fn => fn()));
    results.push(...batch);
  }
  return results;
}

/** Scan recent blocks for TokenCreate (type 2) transactions to build token list */
async function getTokensFromBlocks(): Promise<TokenInfo[]> {
  const height = await getBlockNumber();
  const count = Math.min(height, 500);
  const start = Math.max(0, height - count + 1);

  const blockFns: (() => Promise<Record<string, unknown> | null>)[] = [];
  for (let i = height; i >= start; i--) {
    const h = i;
    blockFns.push(() => getBlock(h));
  }

  const blocks = (await fetchInBatches(blockFns, 20)).filter(Boolean) as Record<string, unknown>[];
  const tokens: TokenInfo[] = [];

  for (const block of blocks) {
    const txns = (block.transactions as Record<string, unknown>[]) || [];
    const blockHeight = block.height as number || 0;

    for (const tx of txns) {
      const rawType = tx.tx_type;
      const txType = typeof rawType === "string"
        ? (rawType === "TokenCreate" ? 2 : -1)
        : (rawType as number);

      if (txType === 2) {
        const payload = tx.payload as number[] | undefined;
        const from = toHexAddress(tx.from);
        if (payload && payload.length > 0) {
          try {
            // Try to extract token info from payload
            // TokenCreate payload: borsh-serialized { name, symbol, decimals, total_supply }
            // For display, we'll use the tx hash as token ID
            const hash = toHexAddress(tx.hash);
            tokens.push({
              tokenId: hash || `${blockHeight}:token`,
              name: `Token-${hash?.slice(0, 8) || "unknown"}`,
              symbol: "TKN",
              decimals: 9,
              totalSupply: "0",
              creator: from,
              blockHeight,
            });
          } catch {
            // Skip malformed
          }
        }
      }
    }
  }

  return tokens;
}

export default async function TokensPage() {
  let tokens: TokenInfo[] = [];
  let fetchError: string | null = null;

  try {
    tokens = await getTokensFromBlocks();
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to fetch token data";
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
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Tokens</h1>
            <p className="text-xs text-muted mt-0.5">Custom tokens created on ClawNetwork</p>
          </div>
        </div>

        {/* Native Token Card */}
        <div className="mb-8 rounded-xl border border-primary/30 bg-primary/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-primary">CLAW</h2>
              <p className="text-sm text-muted">ClawNetwork Native Token</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted">Total Supply</p>
              <p className="text-lg font-bold">1,000,000,000 CLAW</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted">Decimals</p>
              <p className="font-bold">9</p>
            </div>
            <div>
              <p className="text-xs text-muted">Type</p>
              <p className="font-bold">Native</p>
            </div>
            <div>
              <p className="text-xs text-muted">Symbol</p>
              <p className="font-bold">CLAW</p>
            </div>
          </div>
        </div>

        {fetchError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-8 text-center">
            <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to load tokens</h2>
            <p className="text-sm text-muted">{fetchError}</p>
          </div>
        ) : tokens.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface/50 p-8 text-center">
            <Coins className="h-12 w-12 text-muted/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-muted mb-2">No Custom Tokens Yet</h2>
            <p className="text-sm text-muted">Custom tokens created via TokenCreate transactions will appear here.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 text-left">#</th>
                    <th className="px-6 py-3 text-left">Token</th>
                    <th className="px-6 py-3 text-left">Symbol</th>
                    <th className="px-6 py-3 text-left">Creator</th>
                    <th className="px-6 py-3 text-left">Block</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token, i) => (
                    <tr key={token.tokenId} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-3 text-muted">{i + 1}</td>
                      <td className="px-6 py-3 font-semibold">{token.name}</td>
                      <td className="px-6 py-3">
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">{token.symbol}</span>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs">
                        <a href={`/address/${token.creator}`} className="text-primary hover:underline">
                          {truncateAddress(token.creator)}
                        </a>
                      </td>
                      <td className="px-6 py-3">
                        <a href={`/block/${token.blockHeight}`} className="text-primary hover:underline font-mono text-xs">
                          {token.blockHeight.toLocaleString()}
                        </a>
                      </td>
                    </tr>
                  ))}
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
