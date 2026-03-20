import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { getBlock, truncateAddress, toHexAddress, parseBlockTransaction, formatCLAW, TX_TYPE_NAMES } from "@/lib/rpc";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers, ArrowRightLeft, Gift } from "lucide-react";

type Props = { params: Promise<{ height: string }> };

export async function generateMetadata({ params }: Props) {
  const { height } = await params;
  return { title: `Block #${height}` };
}

export default async function BlockPage({ params }: Props) {
  const { height } = await params;
  const h = parseInt(height, 10);
  if (isNaN(h)) notFound();

  let block: Record<string, unknown> | null = null;
  let fetchError: string | null = null;
  try {
    block = await getBlock(h);
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to connect to node";
  }

  if (fetchError) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8">
          <a href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </a>
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-8 text-center">
            <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to load block #{h}</h2>
            <p className="text-sm text-muted">{fetchError}</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!block) notFound();

  const hash = toHexAddress(block.hash) || String(block.hash ?? "");
  const validator = toHexAddress(block.validator);
  const timestamp = block.timestamp as number || 0;
  const txns = (block.transactions as Record<string, unknown>[]) || [];
  const stateRoot = toHexAddress(block.state_root) || String(block.state_root ?? "");
  const prevHash = toHexAddress(block.prev_hash) || String(block.prev_hash ?? "");

  const parsedTxns = txns.map((tx, txIdx) =>
    parseBlockTransaction(tx, timestamp, h, txIdx)
  );

  // Parse block reward events
  const rawEvents = (block.events as Array<Record<string, unknown>>) || [];
  const rewardEvents = rawEvents
    .filter((e) => e.RewardDistributed != null)
    .map((e) => {
      const data = e.RewardDistributed as Record<string, unknown>;
      return {
        recipient: toHexAddress(data.recipient),
        amount: String(data.amount ?? "0"),
        rewardType: String(data.reward_type ?? ""),
      };
    });

  const REWARD_TYPE_LABELS: Record<string, string> = {
    block_reward: "Block Reward",
    proposer_fee: "Proposer Fee (50%)",
    ecosystem_fee: "Ecosystem Fund (20%)",
    fee_burn: "Fee Burn (30%)",
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <a href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </a>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Block #{h.toLocaleString()}</h1>
            <p className="text-xs text-muted mt-0.5">
              {timestamp ? new Date(timestamp * 1000).toLocaleString() : "Unknown time"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface/50 divide-y divide-border">
          {[
            { label: "Block Hash", value: hash },
            { label: "Previous Hash", value: prevHash },
            { label: "State Root", value: stateRoot },
            { label: "Validator", value: validator, link: `/address/${validator}` },
            { label: "Transactions", value: `${txns.length}` },
            { label: "Timestamp", value: timestamp ? new Date(timestamp * 1000).toLocaleString() : "\u2014" },
          ].map((row) => (
            <div key={row.label} className="flex flex-col gap-1 px-6 py-4 md:flex-row md:items-center md:gap-8">
              <span className="w-32 shrink-0 text-xs text-muted uppercase tracking-wider">{row.label}</span>
              <div className="flex items-center gap-2 min-w-0">
                {row.link ? (
                  <a href={row.link} className="font-mono text-sm text-primary hover:underline truncate">{truncateAddress(row.value, 12)}</a>
                ) : (
                  <span className="font-mono text-sm text-text truncate">{row.value}</span>
                )}
                {row.value && row.value.length > 20 && <CopyButton text={row.value} />}
              </div>
            </div>
          ))}
        </div>

        {parsedTxns.length > 0 && (
          <div className="mt-8 rounded-xl border border-border bg-surface/50 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-primary" /> Transactions ({parsedTxns.length})
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
                  </tr>
                </thead>
                <tbody>
                  {parsedTxns.map((tx, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-3 font-mono text-xs">
                        {tx.hash.includes(":") ? (
                          <span className="text-muted">#{i}</span>
                        ) : (
                          <a href={`/tx/${tx.hash}`} className="text-primary hover:underline">
                            {truncateAddress(tx.hash)}
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {TX_TYPE_NAMES[tx.txType] ?? `Type ${tx.txType}`}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono text-muted text-xs">
                        {tx.from ? (
                          <a href={`/address/${tx.from}`} className="text-primary/70 hover:text-primary hover:underline">
                            {truncateAddress(tx.from)}
                          </a>
                        ) : "\u2014"}
                      </td>
                      <td className="px-6 py-3 font-mono text-muted text-xs">
                        {tx.to ? (
                          <a href={`/address/${tx.to}`} className="text-primary/70 hover:text-primary hover:underline">
                            {truncateAddress(tx.to)}
                          </a>
                        ) : "\u2014"}
                      </td>
                      <td className="px-6 py-3 text-muted text-xs">
                        {tx.amount ? (
                          <span className="text-green-400">{formatCLAW(tx.amount)} CLAW</span>
                        ) : "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rewardEvents.length > 0 && (
          <div className="mt-8 rounded-xl border border-border bg-surface/50 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" /> Rewards & Fees ({rewardEvents.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 text-left">Type</th>
                    <th className="px-6 py-3 text-left">Recipient</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rewardEvents.map((evt, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs ${
                          evt.rewardType === "fee_burn"
                            ? "bg-red-500/10 text-red-400"
                            : evt.rewardType === "block_reward"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-primary/10 text-primary"
                        }`}>
                          {REWARD_TYPE_LABELS[evt.rewardType] ?? evt.rewardType}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono text-muted text-xs">
                        {evt.rewardType === "fee_burn" ? (
                          <span className="text-red-400/70">Burned</span>
                        ) : (
                          <a href={`/address/${evt.recipient}`} className="text-primary/70 hover:text-primary hover:underline">
                            {truncateAddress(evt.recipient)}
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right text-xs">
                        <span className={evt.rewardType === "fee_burn" ? "text-red-400" : "text-green-400"}>
                          {evt.rewardType === "fee_burn" ? "-" : "+"}{formatCLAW(evt.amount)} CLAW
                        </span>
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
