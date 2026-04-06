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
import { supabase } from "@/lib/supabase";
import { type NetworkId } from "@/lib/config";
import { ArrowRightLeft, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

export const metadata = { title: "Transactions" };

// ── Types ──────────────────────────────────────────────────────────────────

interface TxQueryParams {
  page: number;
  limit: number;
  txType: number | null;
  address: string;
  fromTs: number | null;
  toTs: number | null;
}

interface PageResult {
  transactions: ParsedTx[];
  total: number;
  page: number;
  limit: number;
}

// ── Mainnet: DB-backed paginated query ─────────────────────────────────────

async function fetchFromDb(params: TxQueryParams): Promise<PageResult> {
  const { page, limit, txType, address, fromTs, toTs } = params;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("explorer_transactions")
    .select(
      "hash, tx_type, type_name, from_addr, to_addr, amount, block_height, tx_index, timestamp",
      { count: "exact" },
    )
    .eq("network", "mainnet")
    .not("tx_type", "in", "(15,16)")
    .order("block_height", { ascending: false })
    .order("tx_index", { ascending: false })
    .range(offset, offset + limit - 1);

  if (txType !== null) {
    query = query.eq("tx_type", txType);
  }

  if (address) {
    const addr = address.toLowerCase();
    query = query.or(`from_addr.eq.${addr},to_addr.eq.${addr}`);
  }

  if (fromTs !== null) {
    query = query.gte("timestamp", fromTs);
  }

  if (toTs !== null) {
    query = query.lte("timestamp", toTs);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const transactions: ParsedTx[] = (data ?? []).map((row) => ({
    hash: row.hash,
    txType: row.tx_type,
    from: row.from_addr,
    to: row.to_addr ?? "",
    amount: row.amount ?? "",
    timestamp: row.timestamp,
    blockHeight: row.block_height,
  }));

  return { transactions, total: count ?? 0, page, limit };
}

// ── Testnet: RPC-backed (existing behavior) ────────────────────────────────

function mapRpcTransaction(tx: Record<string, unknown>): ParsedTx {
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

async function fetchFromRpc(network: NetworkId): Promise<PageResult> {
  const HIDDEN_TX_TYPES = new Set([15, 16]);
  let transactions: ParsedTx[] = [];

  try {
    const results = await rpcGetRecentTransactions(500, network);
    if (Array.isArray(results) && results.length > 0) {
      transactions = results.map((tx) => mapRpcTransaction(tx as Record<string, unknown>));
    }
  } catch {
    transactions = await getRecentTransactionsFallback(network);
  }

  transactions = transactions.filter((tx) => !HIDDEN_TX_TYPES.has(tx.txType));

  return { transactions, total: transactions.length, page: 1, limit: transactions.length };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTimeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const FILTERABLE_TYPES = Object.entries(TX_TYPE_NAMES).filter(
  ([k]) => k !== "15" && k !== "16",
);

// ── Page component ─────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const network = await getServerNetwork();
  const isMainnet = network === "mainnet";

  const page = Math.max(1, Number(sp.page) || 1);
  const limit = 25;
  const txTypeParam = sp.tx_type != null ? Number(sp.tx_type) : null;
  const addressParam = (typeof sp.address === "string" ? sp.address : "") || "";
  // Support both from_ts (unix) and from_date (YYYY-MM-DD) inputs — all UTC
  const fromTsParam = sp.from_ts ? Number(sp.from_ts)
    : sp.from_date ? Math.floor(new Date(sp.from_date as string + "T00:00:00Z").getTime() / 1000)
    : null;
  const toTsParam = sp.to_ts ? Number(sp.to_ts)
    : sp.to_date ? Math.floor(new Date(sp.to_date as string + "T23:59:59Z").getTime() / 1000)
    : null;

  let result: PageResult;
  let fetchError: string | null = null;

  try {
    if (isMainnet) {
      result = await fetchFromDb({ page, limit, txType: txTypeParam, address: addressParam, fromTs: fromTsParam, toTs: toTsParam });
    } else {
      result = await fetchFromRpc(network);
    }
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to fetch transactions";
    result = { transactions: [], total: 0, page: 1, limit };
  }

  const { transactions, total } = result;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function buildUrl(overrides: Record<string, string | number | null>): string {
    const p = new URLSearchParams();
    const merged = {
      page: String(page),
      ...(txTypeParam !== null ? { tx_type: String(txTypeParam) } : {}),
      ...(addressParam ? { address: addressParam } : {}),
      ...(fromTsParam !== null ? { from_ts: String(fromTsParam) } : {}),
      ...(toTsParam !== null ? { to_ts: String(toTsParam) } : {}),
    };
    for (const [k, v] of Object.entries({ ...merged, ...overrides })) {
      if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
    }
    return `/transactions?${p.toString()}`;
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <a href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </a>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
            <ArrowRightLeft className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Transactions</h1>
            <p className="text-xs text-muted mt-0.5">
              {isMainnet ? `${total.toLocaleString()} total transactions` : `Recent transactions (last 200)`}
            </p>
          </div>
        </div>

        {/* Filters — mainnet only */}
        {isMainnet && (
          <form method="GET" action="/transactions" className="flex flex-wrap gap-3 mb-6">
            <select
              name="tx_type"
              defaultValue={txTypeParam !== null ? String(txTypeParam) : ""}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Types</option>
              {FILTERABLE_TYPES.map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            <input
              type="text"
              name="address"
              placeholder="Filter by address..."
              defaultValue={addressParam}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm w-64 font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <input
              type="date"
              name="from_date"
              defaultValue={fromTsParam ? new Date(fromTsParam * 1000).toISOString().slice(0, 10) : ""}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              title="From date"
            />

            <input
              type="date"
              name="to_date"
              defaultValue={toTsParam ? new Date(toTsParam * 1000).toISOString().slice(0, 10) : ""}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              title="To date"
            />

            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              Filter
            </button>

            {(txTypeParam !== null || addressParam || fromTsParam !== null || toTsParam !== null) && (
              <a
                href="/transactions"
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-primary transition-colors"
              >
                Clear
              </a>
            )}
          </form>
        )}

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
                        No transactions found.
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
                          ) : (tx.txType === 8 || tx.txType === 9) ? (
                            <span className="text-muted italic text-[10px]">Self (Stake)</span>
                          ) : tx.txType === 10 ? (
                            <span className="text-muted italic text-[10px]">Claim</span>
                          ) : (
                            <span className="text-muted">--</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-xs">
                          {tx.amount && tx.amount !== "0" ? (
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

            {/* Pagination — mainnet only */}
            {isMainnet && totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-6 py-3">
                <p className="text-xs text-muted">
                  Page {page} of {totalPages.toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <a
                      href={buildUrl({ page: page - 1 })}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors"
                    >
                      <ChevronLeft className="h-3 w-3" /> Prev
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted">
                      <ChevronLeft className="h-3 w-3" /> Prev
                    </span>
                  )}

                  {page < totalPages ? (
                    <a
                      href={buildUrl({ page: page + 1 })}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors"
                    >
                      Next <ChevronRight className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted">
                      Next <ChevronRight className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
