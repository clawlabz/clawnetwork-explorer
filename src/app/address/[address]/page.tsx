import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { ContractSection } from "@/components/ContractSection";
import { getBalance, getNonce, getAgent, getReputation, getTransactionsByAddress, getAgentScore, getContractInfo, getContractCode, getServerNetwork, formatCLAW, truncateAddress, toHexAddress, TX_TYPE_NAMES, type AgentScore } from "@/lib/rpc";
import { ArrowLeft, User, Coins, Shield, ArrowRightLeft, Star, Activity, Clock, Blocks, Wallet, Globe, FileCode, Hash, Box } from "lucide-react";

const PAGE_SIZE = 20;

type Props = {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ page?: string }>;
};

interface ContractInfoData {
  address: string;
  codeHash: string;
  creator: string;
  deployedAt: number;
}

interface ContractCodeData {
  code: string;
  size: number;
}

export async function generateMetadata({ params }: Props) {
  const { address } = await params;
  return { title: `Address ${address.slice(0, 8)}...` };
}

export default async function AddressPage({ params, searchParams }: Props) {
  const { address } = await params;
  const sp = await searchParams;
  const pageParam = sp.page;
  const network = await getServerNetwork();
  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  let balance = "0";
  let nonce = 0;
  let agent: Record<string, unknown> | null = null;
  let reputation: unknown[] = [];
  let transactions: Record<string, unknown>[] = [];
  let agentScore: AgentScore | null = null;
  let contractInfo: ContractInfoData | null = null;
  let contractCode: ContractCodeData | null = null;

  try {
    [balance, nonce, agent, reputation, transactions, agentScore, contractInfo, contractCode] = await Promise.all([
      getBalance(address, network),
      getNonce(address, network),
      getAgent(address, network),
      getReputation(address, network),
      getTransactionsByAddress(address, PAGE_SIZE + 1, offset, network) as Promise<Record<string, unknown>[]>,
      getAgentScore(address, network),
      getContractInfo(address, network) as Promise<ContractInfoData | null>,
      getContractCode(address, network) as Promise<ContractCodeData | null>,
    ]);
  } catch (e) {
    console.error("Failed to fetch address data:", e);
  }

  const isContract = contractInfo != null;

  // Deduplicate transactions by hash (RPC may return the same tx multiple times)
  const seen = new Set<string>();
  const uniqueTransactions = transactions.filter(tx => {
    const hash = toHexAddress(tx.hash);
    if (!hash || seen.has(hash)) return false;
    seen.add(hash);
    // Hide miner operational txs (MinerRegister=15, MinerHeartbeat=16)
    const t = (tx.txType ?? tx.tx_type) as number | undefined;
    if (t === 15 || t === 16) return false;
    return true;
  });

  const hasNextPage = uniqueTransactions.length > PAGE_SIZE;
  const displayTransactions = hasNextPage ? uniqueTransactions.slice(0, PAGE_SIZE) : uniqueTransactions;
  const hasPrevPage = currentPage > 1;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <a href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </a>

        {/* Header with type badge */}
        <div className="flex items-center gap-3 mb-8">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isContract ? "bg-primary/10" : "bg-primary/10"}`}>
            {isContract ? (
              <FileCode className="h-5 w-5 text-primary" />
            ) : (
              <User className="h-5 w-5 text-primary" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{isContract ? "Contract" : "Address"}</h1>
              {isContract && (
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Smart Contract
                </span>
              )}
              {agent && (
                <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-400">
                  Agent
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted break-all">{address}</span>
              <CopyButton text={address} />
            </div>
          </div>
        </div>

        {/* Account Overview Cards */}
        <div className={`grid grid-cols-1 gap-4 ${isContract ? "md:grid-cols-3 lg:grid-cols-3" : "md:grid-cols-3"} mb-8`}>
          <div className="rounded-xl border border-border bg-surface/50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted uppercase tracking-wider">Balance</span>
            </div>
            <span className="text-2xl font-bold text-primary">{formatCLAW(balance)}</span>
            <span className="text-sm text-muted ml-1">CLAW</span>
          </div>

          <div className="rounded-xl border border-border bg-surface/50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-accent" />
              <span className="text-xs text-muted uppercase tracking-wider">Nonce</span>
            </div>
            <span className="text-2xl font-bold">{nonce}</span>
          </div>

          <div className="rounded-xl border border-border bg-surface/50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-green-400" />
              <span className="text-xs text-muted uppercase tracking-wider">Agent</span>
            </div>
            <span className="text-lg font-semibold">
              {agent ? (agent.name as string || "Registered") : "Not Registered"}
            </span>
          </div>
        </div>

        {/* Contract Info Cards (only for contracts) */}
        {isContract && contractInfo && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted uppercase tracking-wider">Creator</span>
              </div>
              {contractInfo.creator ? (
                <a href={`/address/${contractInfo.creator}`} className="font-mono text-sm text-primary hover:underline">
                  {truncateAddress(contractInfo.creator, 8)}
                </a>
              ) : (
                <span className="text-muted">--</span>
              )}
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Box className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted uppercase tracking-wider">Deployed At</span>
              </div>
              <span className="text-xl font-bold">
                {contractInfo.deployedAt != null ? (
                  <a href={`/block/${contractInfo.deployedAt}`} className="text-primary hover:underline">
                    #{contractInfo.deployedAt.toLocaleString()}
                  </a>
                ) : (
                  "--"
                )}
              </span>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted uppercase tracking-wider">Code Hash</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-text truncate">{truncateAddress(contractInfo.codeHash, 8)}</span>
                {contractInfo.codeHash && <CopyButton text={contractInfo.codeHash} />}
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center gap-2 mb-2">
                <FileCode className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted uppercase tracking-wider">Code Size</span>
              </div>
              <span className="text-xl font-bold">
                {contractCode?.size != null ? `${contractCode.size.toLocaleString()} bytes` : "--"}
              </span>
            </div>
          </div>
        )}

        {/* Contract Interaction Tabs (only for contracts) */}
        {isContract && contractInfo && (
          <div className="mb-8">
            <ContractSection
              address={address}
              codeHash={contractInfo.codeHash}
              codeSize={contractCode?.size ?? null}
            />
          </div>
        )}

        {/* Agent Info */}
        {agent && (
          <div className="mb-8 rounded-xl border border-border bg-surface/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Agent Identity
              </h2>
            </div>
            <div className="p-6 space-y-3">
              {"name" in agent && agent.name ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted w-32">Name</span>
                  <span className="text-sm font-semibold text-text">{String(agent.name)}</span>
                </div>
              ) : null}
              {"address" in agent && agent.address ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted w-32">Address</span>
                  <span className="text-xs font-mono text-text break-all">{toHexAddress(agent.address)}</span>
                </div>
              ) : null}
              {"registered_at" in agent && agent.registered_at != null ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted w-32">Registered At</span>
                  <span className="text-sm text-text">Block #{Number(agent.registered_at).toLocaleString()}</span>
                </div>
              ) : null}
              {"metadata" in agent && agent.metadata && typeof agent.metadata === "object" && Object.keys(agent.metadata as object).length > 0 ? (
                <div className="flex items-start gap-3">
                  <span className="text-sm text-muted w-32">Metadata</span>
                  <pre className="text-xs text-muted overflow-x-auto">{JSON.stringify(agent.metadata, null, 2)}</pre>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Agent Score */}
        <div className="mb-8 rounded-xl border border-border bg-surface/50 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
            <Star className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Agent Score</h2>
          </div>
          {agentScore ? (
            <div className="p-6">
              {/* Total Score */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex h-14 min-w-[3.5rem] items-center justify-center rounded-xl bg-primary/10 px-3">
                  <span className="text-xl font-bold text-primary">{agentScore.total.toLocaleString()}</span>
                </div>
                <div>
                  <p className="text-sm text-muted">Total Score <span className="text-text font-semibold">({(agentScore.total / 100).toFixed(0)}%)</span></p>
                  <p className="text-xs text-muted mt-0.5">
                    Decay Factor: <span className="text-text font-semibold">{(agentScore.decay_factor / 100).toFixed(1)}%</span>
                  </p>
                </div>
              </div>

              {/* Score Dimensions */}
              <div className="space-y-3">
                <ScoreBar icon={Activity} label="Activity" score={agentScore.activity} max={10000} />
                <ScoreBar icon={Clock} label="Uptime" score={agentScore.uptime} max={10000} />
                <ScoreBar icon={Blocks} label="Block Production" score={agentScore.block_production} max={10000} />
                <ScoreBar icon={Wallet} label="Economic" score={agentScore.economic} max={10000} />
                <ScoreBar icon={Globe} label="Platform" score={agentScore.platform} max={10000} />
              </div>
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-muted">Not a registered agent</p>
              <p className="text-xs text-muted/60 mt-1">Agent Score is only available for registered agents on the network.</p>
            </div>
          )}
        </div>

        {/* Reputation (Deprecated) */}
        {reputation.length > 0 && (
          <div className="mb-8 rounded-xl border border-border bg-surface/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-semibold">
                Reputation Attestations ({reputation.length})
                <span className="ml-2 rounded bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-500">Deprecated</span>
              </h2>
            </div>
            <div className="p-6">
              <pre className="text-xs text-muted overflow-x-auto">{JSON.stringify(reputation, (_key, value) => {
                if (Array.isArray(value) && value.length === 32 && value.every((b: unknown) => typeof b === "number"))
                  return value.map((b: number) => b.toString(16).padStart(2, "0")).join("");
                return value;
              }, 2)}</pre>
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div className="rounded-xl border border-border bg-surface/50 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" /> Transaction History
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 text-left">TX Hash</th>
                  <th className="px-6 py-3 text-left">Type</th>
                  <th className="px-6 py-3 text-left">From</th>
                  <th className="px-6 py-3 text-left">To</th>
                  <th className="px-6 py-3 text-left">Amount</th>
                  <th className="px-6 py-3 text-left">Block</th>
                </tr>
              </thead>
              <tbody>
                {displayTransactions.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted">No transactions yet</td></tr>
                ) : (
                  displayTransactions.map((tx, i) => {
                    const txHash = toHexAddress(tx.hash);
                    const fromAddr = toHexAddress(tx.from);
                    const toAddr = toHexAddress(tx.to);
                    const txType = (tx.txType ?? tx.tx_type) as number | undefined;
                    const rawTypeName = (tx.typeName as string) || (txType !== undefined ? TX_TYPE_NAMES[txType] : undefined) || `Type ${txType ?? "?"}`;
                    const typeName = rawTypeName === "TokenTransfer" ? "Transfer" : rawTypeName;
                    const amount = tx.amount as string | undefined;
                    const blockHeight = (tx.blockHeight ?? tx.block_height) as number | undefined;
                    return (
                      <tr key={txHash || i} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs">
                          {txHash ? (
                            <a href={`/tx/${txHash}`} className="text-primary hover:underline">
                              {truncateAddress(txHash)}
                            </a>
                          ) : "\u2014"}
                        </td>
                        <td className="px-6 py-3">
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {typeName}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-mono text-muted text-xs">
                          {fromAddr ? (
                            <a href={`/address/${fromAddr}`} className="text-primary/70 hover:text-primary hover:underline">
                              {truncateAddress(fromAddr)}
                            </a>
                          ) : "\u2014"}
                        </td>
                        <td className="px-6 py-3 font-mono text-muted text-xs">
                          {toAddr ? (
                            <a href={`/address/${toAddr}`} className="text-primary/70 hover:text-primary hover:underline">
                              {truncateAddress(toAddr)}
                            </a>
                          ) : "\u2014"}
                        </td>
                        <td className="px-6 py-3 font-mono text-xs">
                          {amount ? (
                            <span className="text-primary">{formatCLAW(amount)} CLAW</span>
                          ) : "\u2014"}
                        </td>
                        <td className="px-6 py-3">
                          {blockHeight !== undefined ? (
                            <a href={`/block/${blockHeight}`} className="text-primary hover:underline font-mono text-xs">
                              {blockHeight.toLocaleString()}
                            </a>
                          ) : "\u2014"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(hasPrevPage || hasNextPage) && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <div className="text-xs text-muted">Page {currentPage}</div>
              <div className="flex items-center gap-2">
                {hasPrevPage ? (
                  <a
                    href={`/address/${address}${currentPage > 2 ? `?page=${currentPage - 1}` : ""}`}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-primary hover:bg-primary/5 transition-colors"
                  >
                    Previous
                  </a>
                ) : (
                  <span className="rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted cursor-not-allowed">
                    Previous
                  </span>
                )}
                {hasNextPage ? (
                  <a
                    href={`/address/${address}?page=${currentPage + 1}`}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-primary hover:bg-primary/5 transition-colors"
                  >
                    Next
                  </a>
                ) : (
                  <span className="rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted cursor-not-allowed">
                    Next
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

/* -- Helper Components -- */

function ScoreBar({
  icon: Icon,
  label,
  score,
  max,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  score: number;
  max: number;
}) {
  const capped = Math.min(score, max);
  const pct = Math.min(100, Math.max(0, (capped / max) * 100));
  const isEmpty = capped === 0;
  return (
    <div className={`flex items-center gap-3 ${isEmpty ? "opacity-40" : ""}`}>
      <Icon className="h-4 w-4 text-muted shrink-0" />
      <span className="w-32 shrink-0 text-xs text-muted">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-border/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-28 text-right font-mono text-xs text-text shrink-0 whitespace-nowrap">
        {capped.toLocaleString()} / {max.toLocaleString()}
      </span>
    </div>
  );
}
