import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  getBlockNumber,
  getBlock,
  getRecentTransactions as rpcGetRecentTransactions,
  parseBlockTransaction,
  formatCLAW,
  truncateAddress,
  TX_TYPE_NAMES,
  toHexAddress,
  getServerNetwork,
  type ParsedTx,
} from "@/lib/rpc";
import { type NetworkId } from "@/lib/config";
import { ArrowRightLeft, ArrowLeft } from "lucide-react";

export const metadata = { title: "Transactions" };

/** Convert RPC response items to ParsedTx format */
function mapRpcTransaction(tx: Record<string, unknown>): ParsedTx {
  // RPC returns txType (number) and typeName (string) — try both field names
  const rawType = tx.txType ?? tx.tx_type ?? tx.typeName;
  const TX_TYPE_STRING_TO_NUM: Record<string, number> = {
    AgentRegister: 0, TokenTransfer: 1, TokenCreate: 2, TokenMintTransfer: 3,
    ReputationAttest: 4, ServiceRegister: 5, ContractDeploy: 6, ContractCall: 7,
    StakeDeposit: 8, StakeWithdraw: 9, StakeClaim: 10, PlatformActivityReport: 11,
    TokenApprove: 12, TokenBurn: 13, ChangeDelegation: 14, MinerRegister: 15,
    MinerHeartbeat: 16, ContractUpgradeAnnounce: 17, ContractUpgradeExecute: 18,
  };
  const txType = typeof rawType === "string" ? (TX_TYPE_STRING_TO_NUM[rawType] ?? -1) : (rawType as number ?? -1);

  return {
    hash: toHexAddress(tx.hash) || `${tx.block_height ?? tx.blockHeight}:${tx.index ?? 0}`,
    txType,
    from: toHexAddress(tx.from),
    to: toHexAddress(tx.to),
    amount: String(tx.amount ?? ""),
    timestamp: (tx.timestamp as number) ?? 0,
    blockHeight: (tx.block_height as number) ?? (tx.blockHeight as number) ?? 0,
  };
}

/** Fallback: scan last 100 blocks one by one */
async function getRecentTransactionsFallback(network?: NetworkId): Promise<ParsedTx[]> {
  const height = await getBlockNumber(network);
  const count = Math.min(height + 1, 100);
  const start = Math.max(0, height - count + 1);

  const blockPromises = [];
  for (let i = height; i >= start; i--) {
    blockPromises.push(getBlock(i, network));
  }

  const blocks = (await Promise.all(blockPromises)).filter(Boolean) as Record<string, unknown>[];

  const txs: ParsedTx[] = [];
  for (const block of blocks) {
    const blockHeight = block.height as number;
    const blockTimestamp = block.timestamp as number;
    const rawTxs = (block.transactions as Record<string, unknown>[]) || [];
    for (let i = 0; i < rawTxs.length; i++) {
      txs.push(parseBlockTransaction(rawTxs[i], blockTimestamp, blockHeight, i));
    }
  }

  return txs;
}

async function fetchRecentTransactions(network?: NetworkId): Promise<ParsedTx[]> {
  try {
    const results = await rpcGetRecentTransactions(50, network);
    if (Array.isArray(results) && results.length > 0) {
      return results.map((tx) => mapRpcTransaction(tx as Record<string, unknown>));
    }
  } catch {
    // RPC method not available — fall back to block scanning
  }
  return getRecentTransactionsFallback(network);
}

function formatTimeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default async function TransactionsPage() {
  const network = await getServerNetwork();

  let transactions: ParsedTx[] = [];
  let fetchError: string | null = null;

  try {
    transactions = await fetchRecentTransactions(network);
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to fetch transactions";
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <a href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </a>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
            <ArrowRightLeft className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Transactions</h1>
            <p className="text-xs text-muted mt-0.5">
              Recent transactions
              {transactions.length > 0 && ` (${transactions.length} total)`}
            </p>
          </div>
        </div>

        {fetchError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-8 text-center">
            <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to load transactions</h2>
            <p className="text-sm text-muted">{fetchError}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 text-left">TX Hash</th>
                    <th className="px-6 py-3 text-left">Type</th>
                    <th className="px-6 py-3 text-left">From</th>
                    <th className="px-6 py-3 text-left">To</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3 text-left">Block</th>
                    <th className="px-6 py-3 text-left">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-muted">
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx, i) => (
                      <tr key={`${tx.hash}-${i}`} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs">
                          {tx.hash.includes(":") ? (
                            <a href={`/block/${tx.blockHeight}`} className="text-primary hover:underline">
                              Block #{tx.blockHeight}
                            </a>
                          ) : (
                            <a href={`/tx/${tx.hash}`} className="text-primary hover:underline">
                              {truncateAddress(tx.hash, 8)}
                            </a>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] text-primary whitespace-nowrap">
                            {TX_TYPE_NAMES[tx.txType] ?? `Type ${tx.txType}`}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-mono text-xs">
                          {tx.from ? (
                            <a href={`/address/${tx.from}`} className="text-primary/70 hover:text-primary">
                              {truncateAddress(tx.from)}
                            </a>
                          ) : (
                            <span className="text-muted">--</span>
                          )}
                        </td>
                        <td className="px-6 py-3 font-mono text-xs">
                          {tx.to ? (
                            <a href={`/address/${tx.to}`} className="text-primary/70 hover:text-primary">
                              {truncateAddress(tx.to)}
                            </a>
                          ) : (
                            <span className="text-muted">--</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-xs">
                          {tx.amount ? (
                            <span className="text-orange-500">{formatCLAW(tx.amount)} CLAW</span>
                          ) : (
                            <span className="text-muted">--</span>
                          )}
                        </td>
                        <td className="px-6 py-3 font-mono text-xs">
                          <a href={`/block/${tx.blockHeight}`} className="text-primary/70 hover:text-primary">
                            #{tx.blockHeight.toLocaleString()}
                          </a>
                        </td>
                        <td className="px-6 py-3 text-xs text-muted whitespace-nowrap">
                          {tx.timestamp ? formatTimeAgo(tx.timestamp) : "--"}
                        </td>
                      </tr>
                    ))
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
