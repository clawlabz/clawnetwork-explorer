import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  getBlockNumber,
  getBlock,
  toHexAddress,
  truncateAddress,
  formatCLAW,
  parseTokenCreatePayload,
  getServerNetwork,
  computeTokenId,
  getTokens as rpcGetTokens,
  getSupplyInfo,
  getTransactionCount,
  getValidators,
  getMiningStats,
  getTotalSupplyAudit,
} from "@/lib/rpc";
import { type NetworkId } from "@/lib/config";
import { Coins, ArrowLeft, Users, Zap, Blocks, TrendingUp, Package, Trophy } from "lucide-react";

export const metadata = { title: "Tokens" };

interface TokenInfo {
  /** The real on-chain token ID, computed as blake3(sender + name + nonce).
   *  Falls back to creation tx hash if the RPC lookup fails. */
  tokenId: string;
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

/** Compute the real on-chain token ID: blake3(sender || name || nonce).
 *  Falls back to creation tx hash if nonce is unavailable. */
function resolveTokenId(
  creationTxHash: string,
  creator: string,
  name: string,
  nonce: number | undefined,
): string {
  if (nonce !== undefined && creator) {
    try {
      return computeTokenId(creator, name, nonce);
    } catch {
      // Hash computation failed -- fall through
    }
  }
  return creationTxHash;
}

/** Fetch tokens from claw_getTokens RPC */
async function getTokensFromRpc(network?: NetworkId): Promise<TokenInfo[]> {
  const results = await rpcGetTokens(network);
  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }

  return results.map((item) => {
    const t = item as Record<string, unknown>;
    return {
      tokenId: String(t.token_id ?? t.tokenId ?? ""),
      creationTxHash: String(t.creation_tx_hash ?? t.creationTxHash ?? ""),
      name: String(t.name ?? ""),
      symbol: String(t.symbol ?? ""),
      decimals: (t.decimals as number) ?? 0,
      totalSupply: String(t.total_supply ?? t.totalSupply ?? "0"),
      creator: toHexAddress(t.creator ?? t.owner),
      blockHeight: (t.block_height as number) ?? (t.blockHeight as number) ?? 0,
    };
  });
}

/** Fallback: scan recent blocks for TokenCreate (type 2) transactions to build token list */
async function getTokensFromBlocks(network?: NetworkId): Promise<TokenInfo[]> {
  const height = await getBlockNumber(network);
  const count = Math.min(height + 1, 500);
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
            const nonce = tx.nonce as number | undefined;
            const tokenId = resolveTokenId(hash, from, decoded.name, nonce);
            tokens.push({
              tokenId,
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

/** Try the new RPC first, fall back to block scanning */
async function fetchTokens(network?: NetworkId): Promise<TokenInfo[]> {
  try {
    const tokens = await getTokensFromRpc(network);
    if (tokens.length > 0) {
      return tokens;
    }
  } catch {
    // RPC method not available -- fall back to block scanning
  }
  return getTokensFromBlocks(network);
}

/** Supply Overview and Network Stats Section */
async function SupplyAndStatsSection({ network }: { network?: NetworkId }) {
  // Fetch all data in parallel
  const [supplyInfo, blockHeight, validators, miningStats, txCount] = await Promise.allSettled([
    getSupplyInfo(network),
    getBlockNumber(network),
    getValidators(network),
    getMiningStats(network),
    getTransactionCount(network),
  ]);

  // Extract values with fallback to null on failure
  const supplyData = supplyInfo.status === "fulfilled" ? (supplyInfo.value as Record<string, unknown>) : null;
  const blockNum = blockHeight.status === "fulfilled" ? blockHeight.value : null;
  const validatorList = validators.status === "fulfilled" ? (validators.value as unknown[]) : [];
  const miningData = miningStats.status === "fulfilled" ? (miningStats.value as Record<string, unknown>) : null;
  const txCountNum = txCount.status === "fulfilled" ? txCount.value : null;

  // Parse supply data — claw_getSupplyInfo returns snake_case fields
  const totalSupplyStr = (supplyData?.total_supply ?? supplyData?.totalSupply) as string | undefined || "0";
  const totalBalancesStr = (supplyData?.circulating_supply ?? supplyData?.totalBalances) as string | undefined || "0";
  const totalStakesStr = (supplyData?.staked_supply ?? supplyData?.totalStakes) as string | undefined || "0";
  const totalUnbondingStr = (supplyData?.unbonding_supply ?? supplyData?.totalUnbonding) as string | undefined || "0";
  const numHolders = (supplyData?.num_balance_entries ?? supplyData?.numBalanceEntries) as number | undefined || 0;

  // Calculate derived supply metrics
  const MAX_SUPPLY = BigInt("1000000000000000000"); // 1B CLAW in base units
  const totalSupplyBig = BigInt(totalSupplyStr);
  const stakedBig = BigInt(totalStakesStr) + BigInt(totalUnbondingStr);
  const burnedBig = MAX_SUPPLY - totalSupplyBig;

  // Parse mining stats
  const activeMiners = miningData?.activeMiners as number | undefined || 0;
  const blockRewardStr = miningData?.currentBlockReward as string | undefined || "0";

  return (
    <div className="space-y-8 mb-8">
      {/* Supply Overview Table */}
      <div className="rounded-xl border border-border bg-surface/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold">Supply Overview</h2>
        </div>
        <div className="divide-y divide-border/50">
          <div className="flex items-center justify-between px-6 py-4 hover:bg-primary/5 transition-colors">
            <span className="text-sm text-muted">Max Supply</span>
            <span className="font-mono font-semibold">{formatCLAW(MAX_SUPPLY.toString())} CLAW</span>
          </div>
          <div className="flex items-center justify-between px-6 py-4 hover:bg-primary/5 transition-colors">
            <span className="text-sm text-muted">Total Supply</span>
            <span className="font-mono font-semibold">{formatCLAW(totalSupplyStr)} CLAW</span>
          </div>
          <div className="flex items-center justify-between px-6 py-4 hover:bg-primary/5 transition-colors">
            <span className="text-sm text-muted">Circulating Supply</span>
            <span className="font-mono font-semibold">{formatCLAW(totalBalancesStr)} CLAW</span>
          </div>
          <div className="flex items-center justify-between px-6 py-4 hover:bg-primary/5 transition-colors">
            <span className="text-sm text-muted">Staked Supply</span>
            <span className="font-mono font-semibold">{formatCLAW(stakedBig.toString())} CLAW</span>
          </div>
          <div className="flex items-center justify-between px-6 py-4 hover:bg-primary/5 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Burned</span>
              <a href="https://chain.clawlabz.xyz/whitepaper#tokenomics" target="_blank" rel="noopener noreferrer" className="text-xs text-primary/60 hover:text-primary transition-colors" title="30% of transaction fees are permanently burned. See Whitepaper §5 Tokenomics.">
                Fee Burn 30% · Why?
              </a>
            </div>
            <span className="font-mono font-semibold text-red-400">{formatCLAW(burnedBig.toString())} CLAW</span>
          </div>
          <div className="flex items-center justify-between px-6 py-4 hover:bg-primary/5 transition-colors">
            <span className="text-sm text-muted">Holders</span>
            <span className="font-mono font-semibold">{numHolders.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Network Stats Cards */}
      <div>
        <h2 className="text-lg font-bold mb-4">Network Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Validators Card */}
          <div className="rounded-lg border border-border bg-surface/50 p-4 hover:bg-primary/5 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs text-muted uppercase tracking-wider">Validators</span>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{validatorList.length}</p>
          </div>

          {/* Active Miners Card */}
          <div className="rounded-lg border border-border bg-surface/50 p-4 hover:bg-primary/5 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs text-muted uppercase tracking-wider">Active Miners</span>
              <Package className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{activeMiners}</p>
          </div>

          {/* Block Height Card */}
          <div className="rounded-lg border border-border bg-surface/50 p-4 hover:bg-primary/5 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs text-muted uppercase tracking-wider">Block Height</span>
              <Blocks className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{blockNum !== null ? blockNum.toLocaleString() : "—"}</p>
          </div>

          {/* Total Transactions Card */}
          <div className="rounded-lg border border-border bg-surface/50 p-4 hover:bg-primary/5 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs text-muted uppercase tracking-wider">Transactions</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{txCountNum !== null ? txCountNum.toLocaleString() : "—"}</p>
          </div>

          {/* Block Reward Card */}
          <div className="rounded-lg border border-border bg-surface/50 p-4 hover:bg-primary/5 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs text-muted uppercase tracking-wider">Block Reward</span>
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{formatCLAW(blockRewardStr)} <span className="text-sm text-muted font-normal">CLAW</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function TokensPage() {
  const network = await getServerNetwork();

  let tokens: TokenInfo[] = [];
  let fetchError: string | null = null;

  try {
    tokens = await fetchTokens(network);
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
            <p className="text-xs text-muted mt-0.5">All tokens on ClawNetwork</p>
          </div>
        </div>

        <SupplyAndStatsSection network={network} />

        {/* Custom Tokens Section */}
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-6">Custom Tokens</h2>

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
                      <tr key={token.tokenId} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                        <td className="px-6 py-3 text-muted">{i + 1}</td>
                        <td className="px-6 py-3 font-semibold">
                          <a href={`/token/${token.tokenId}`} className="text-primary hover:underline">
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
        </div>

        {/* Rich List Section */}
        <RichListSection network={network} />
      </main>
      <Footer />
    </>
  );
}

/* ── Genesis address labels ── */
const KNOWN_ADDRESSES: Record<string, { label: string; type: "genesis" | "system" }> = {
  // genesis_address_hex(N) = N as first byte + 31 zero bytes
  ["01" + "00".repeat(31)]: { label: "Node Incentives", type: "genesis" },
  ["02" + "00".repeat(31)]: { label: "Ecosystem Fund", type: "genesis" },
  "71fa1a514e07c7c96bf0c825c29dfc8059cfa995318972dd258a4e316873e66b": { label: "Team", type: "genesis" },
  ["04" + "00".repeat(31)]: { label: "Early Contributors", type: "genesis" },
  ["05" + "00".repeat(31)]: { label: "Liquidity Reserve", type: "genesis" },
};

async function RichListSection({ network }: { network?: NetworkId }) {
  let holdings: { address: string; balance: string; stake: string; total: string }[] = [];
  let totalSupply = "0";

  try {
    const data = await getTotalSupplyAudit(network);
    totalSupply = (data.totalSupply as string) || "0";
    const allBalances = (data.balances as { address: string; balance: string }[]) || [];
    const allStakes = (data.stakes as { address: string; stake: string }[]) || [];

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
  } catch {
    return null;
  }

  const genesisCount = holdings.filter((h) => KNOWN_ADDRESSES[h.address]).length;
  const genesisTotal = holdings
    .filter((h) => KNOWN_ADDRESSES[h.address])
    .reduce((sum, h) => sum + BigInt(h.total), BigInt(0));

  return (
    <div className="mt-8" id="rich-list">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Rich List</h2>
          <span className="text-xs text-muted">Top {holdings.length} addresses by total holdings</span>
        </div>
        {genesisCount > 0 && (
          <div className="text-xs text-muted">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              {genesisCount} genesis addresses · {formatCLAW(genesisTotal.toString())} CLAW non-circulating
            </span>
          </div>
        )}
      </div>

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
              {holdings.map((entry, i) => {
                const known = KNOWN_ADDRESSES[entry.address];
                const isGenesis = !!known;
                const hasStake = BigInt(entry.stake || "0") > BigInt(0);
                const pct = (() => {
                  try {
                    const total = BigInt(entry.total);
                    const supply = BigInt(totalSupply || "1");
                    if (supply === BigInt(0)) return "0.00%";
                    return `${(Number(total * BigInt(10000) / supply) / 100).toFixed(2)}%`;
                  } catch { return "—"; }
                })();

                return (
                  <tr key={entry.address} className={`border-b border-border/50 transition-colors ${isGenesis ? "bg-yellow-500/[0.03] hover:bg-yellow-500/[0.06]" : "hover:bg-primary/5"}`}>
                    <td className="px-4 py-3 font-[JetBrains_Mono] text-muted text-xs">#{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a href={`/address/${entry.address}`} className="font-[JetBrains_Mono] text-xs text-primary hover:underline">
                          {truncateAddress(entry.address, 8)}
                        </a>
                        {known && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 text-[10px] text-yellow-400">
                            {known.label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-[JetBrains_Mono] text-xs ${isGenesis ? "text-muted" : ""}`}>
                      {formatCLAW(entry.balance)}
                    </td>
                    <td className="px-4 py-3 text-right font-[JetBrains_Mono] text-xs">
                      {hasStake ? <span className="text-purple-400">{formatCLAW(entry.stake)}</span> : <span className="text-muted/50">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-[JetBrains_Mono] font-bold text-xs ${isGenesis ? "text-muted" : ""}`}>
                        {formatCLAW(entry.total)}
                      </span>
                      <span className="text-muted font-normal ml-1">CLAW</span>
                    </td>
                    <td className="px-4 py-3 text-right font-[JetBrains_Mono] text-xs text-muted">{pct}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
