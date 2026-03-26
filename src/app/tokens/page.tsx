import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getBlockNumber, getBlock, toHexAddress, truncateAddress, formatCLAW, parseTokenCreatePayload, getServerNetwork } from "@/lib/rpc";
import { type NetworkId } from "@/lib/config";
import { Coins, ArrowLeft } from "lucide-react";

export const metadata = { title: "Tokens" };

interface TokenInfo {
  /** TX hash of the TokenCreate transaction. Used as a routing key until a dedicated
   *  claw_getTokenInfo(tokenId) RPC is available. The actual on-chain token ID is
   *  blake3(tx_bytes), which differs from the tx hash. */
  creationTxHash: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  creator: string;
  blockHeight: number;
}

function formatTokenSupply(baseUnits: string, decimals: number): string {
  try {
    const n = BigInt(baseUnits);
    if (decimals === 0) return n.toLocaleString();
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = n / divisor;
    const frac = n % divisor;
    if (frac === BigInt(0)) return whole.toLocaleString();
    const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
    return `${whole.toLocaleString()}.${fracStr}`;
  } catch {
    return "0";
  }
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
async function getTokensFromBlocks(network?: NetworkId): Promise<TokenInfo[]> {
  const height = await getBlockNumber(network);
  const count = Math.min(height, 500);
  const start = Math.max(0, height - count + 1);

  const blockFns: (() => Promise<Record<string, unknown> | null>)[] = [];
  for (let i = height; i >= start; i--) {
    const h = i;
    blockFns.push(() => getBlock(h, network));
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
            const decoded = parseTokenCreatePayload(payload);
            const hash = toHexAddress(tx.hash);
            tokens.push({
              creationTxHash: hash || `${blockHeight}:token`,
              name: decoded.name,
              symbol: decoded.symbol,
              decimals: decoded.decimals,
              totalSupply: decoded.initialSupply,
              creator: from,
              blockHeight,
            });
          } catch {
            // Skip malformed payload
          }
        }
      }
    }
  }

  return tokens;
}

export default async function TokensPage() {
  const network = await getServerNetwork();

  let tokens: TokenInfo[] = [];
  let fetchError: string | null = null;

  try {
    tokens = await getTokensFromBlocks(network);
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
                    <th className="px-6 py-3 text-left">Decimals</th>
                    <th className="px-6 py-3 text-left">Total Supply</th>
                    <th className="px-6 py-3 text-left">Creator</th>
                    <th className="px-6 py-3 text-left">Block</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token, i) => (
                    <tr key={token.creationTxHash} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-3 text-muted">{i + 1}</td>
                      <td className="px-6 py-3 font-semibold">
                        <a href={`/token/${token.creationTxHash}`} className="text-primary hover:underline">
                          {token.name}
                        </a>
                      </td>
                      <td className="px-6 py-3">
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">{token.symbol}</span>
                      </td>
                      <td className="px-6 py-3 text-center">{token.decimals}</td>
                      <td className="px-6 py-3 font-mono text-xs">{formatTokenSupply(token.totalSupply, token.decimals)}</td>
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
