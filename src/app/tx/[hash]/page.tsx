import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { NetworkSync } from "@/components/NetworkSync";
import { formatCLAW, truncateAddress, toHexAddress, getServerNetwork, getTransactionReceipt, type TransactionReceipt } from "@/lib/rpc";
import { getRpcUrl, type NetworkId } from "@/lib/config";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";

type Props = {
  params: Promise<{ hash: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { hash } = await params;
  return { title: `TX ${hash.slice(0, 12)}...` };
}

/** Server-side RPC call with explicit network.
 *  The RPC returns: hash, txType, typeName, from, to, amount, nonce, blockHeight, timestamp, fee */
async function fetchTxByHash(hash: string, network: NetworkId): Promise<Record<string, unknown> | null> {
  const rpcUrl = getRpcUrl(network);
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "claw_getTransactionByHash", params: [hash] }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result ?? null;
}

export default async function TransactionPage({ params }: Props) {
  const { hash } = await params;
  const network = await getServerNetwork();

  let tx: Record<string, unknown> | null = null;
  let receipt: TransactionReceipt | null = null;
  let fetchError: string | null = null;
  try {
    const [txResult, receiptResult] = await Promise.all([
      fetchTxByHash(hash, network),
      getTransactionReceipt(hash, network),
    ]);
    tx = txResult;
    receipt = receiptResult;
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
            <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to load transaction</h2>
            <p className="text-sm text-muted">{fetchError}</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!tx) notFound();

  // Only use fields that claw_getTransactionByHash actually returns
  const txHash = toHexAddress(tx.hash) || String(tx.hash ?? hash);
  const txType = (tx.txType as number | undefined) ?? (tx.tx_type as number | undefined);
  const typeName = String(tx.typeName ?? tx.type_name ?? (txType !== undefined ? `Type ${txType}` : "Unknown"));
  const from = toHexAddress(tx.from);
  const to = toHexAddress(tx.to);
  const amount = tx.amount != null ? String(tx.amount) : null;
  const fee = tx.fee != null ? String(tx.fee) : null;
  const nonce = tx.nonce as number | undefined;
  const blockHeight = (tx.blockHeight as number) ?? (tx.block_height as number) ?? null;
  const timestamp = (tx.timestamp as number) ?? 0;

  // Determine status from receipt if available, otherwise from block inclusion
  let status: string;
  if (receipt && receipt.success !== undefined) {
    status = receipt.success ? "Success" : "Failed";
  } else if (blockHeight != null) {
    status = "Confirmed";
  } else {
    status = "Pending";
  }

  const rows: { label: string; value: string; link?: string; copy?: boolean }[] = [
    { label: "TX Hash", value: txHash, copy: true },
    { label: "Type", value: typeName },
    { label: "Status", value: status },
    { label: "From", value: from, link: from ? `/address/${from}` : undefined, copy: !!from },
  ];

  if (nonce !== undefined) {
    rows.push({ label: "Nonce", value: String(nonce) });
  }

  if (to) {
    const isStake = txType === 8; // StakeDeposit
    rows.push({ label: isStake ? "Validator" : "To", value: to, link: `/address/${to}`, copy: true });
  }

  if (amount != null) {
    rows.push({ label: "Amount", value: `${formatCLAW(amount)} CLAW` });
  }

  if (fee != null) {
    rows.push({ label: "Fee", value: fee });
  }

  if (blockHeight != null) {
    rows.push({ label: "Block Height", value: `${blockHeight}`, link: `/block/${blockHeight}` });
  }

  rows.push({
    label: "Timestamp",
    value: timestamp ? new Date(timestamp * 1000).toLocaleString() : "---",
  });

  // Receipt details
  if (receipt) {
    if (receipt.fuelConsumed !== undefined) {
      const fuelStr = receipt.fuelLimit
        ? `${receipt.fuelConsumed.toLocaleString()} / ${receipt.fuelLimit.toLocaleString()}`
        : receipt.fuelConsumed.toLocaleString();
      rows.push({ label: "Fuel Used", value: fuelStr });
    }
    if (receipt.errorMessage) {
      rows.push({ label: "Error", value: receipt.errorMessage });
    }
    if (receipt.returnData && receipt.returnData !== "" && receipt.returnData !== "0".repeat(receipt.returnData.length)) {
      rows.push({ label: "Return Data", value: receipt.returnData });
    }
  }

  // Collect log/event strings for display below the table
  const logEntries: string[] = [];
  if (receipt?.logs && receipt.logs.length > 0) {
    logEntries.push(...receipt.logs);
  }
  if (receipt?.events && receipt.events.length > 0) {
    for (const ev of receipt.events) {
      logEntries.push(`[${ev.topic}] ${ev.data}`);
    }
  }

  return (
    <>
      <NetworkSync network={network} />
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <a href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </a>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Transaction Details</h1>
            <p className="text-xs text-muted mt-0.5 font-mono">{truncateAddress(txHash, 12)}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface/50 divide-y divide-border">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1 px-6 py-4 md:flex-row md:items-center md:gap-8">
              <span className="w-32 shrink-0 text-xs text-muted uppercase tracking-wider">{row.label}</span>
              <div className="flex items-center gap-2 min-w-0">
                {row.label === "Status" ? (
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                    row.value === "Success" ? "bg-green-500/10 text-green-400" :
                    row.value === "Failed" ? "bg-red-500/10 text-red-400" :
                    row.value === "Confirmed" ? "bg-blue-500/10 text-blue-400" :
                    "bg-yellow-500/10 text-yellow-400"
                  }`}>
                    {row.value}
                  </span>
                ) : row.label === "Error" ? (
                  <span className="font-mono text-sm text-red-400 break-all">{row.value}</span>
                ) : row.link ? (
                  <a href={row.link} className="font-mono text-sm text-primary hover:underline truncate">
                    {row.label === "Block Height" ? row.value : truncateAddress(row.value, 12)}
                  </a>
                ) : (
                  <span className="font-mono text-sm text-text truncate">{row.value}</span>
                )}
                {row.copy && row.value && <CopyButton text={row.value} />}
              </div>
            </div>
          ))}
        </div>

        {logEntries.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Logs &amp; Events</h2>
            <div className="rounded-xl border border-border bg-surface/50 p-4 space-y-2">
              {logEntries.map((entry, i) => (
                <pre key={i} className="font-mono text-xs text-text whitespace-pre-wrap break-all">{entry}</pre>
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
