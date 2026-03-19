import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { getTransactionByHash, formatCLAW, truncateAddress, toHexAddress, TX_TYPE_NAMES, parsePlatformActivityReportPayload, type PlatformActivityReportPayload } from "@/lib/rpc";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, FileText } from "lucide-react";

type Props = { params: Promise<{ hash: string }> };

export async function generateMetadata({ params }: Props) {
  const { hash } = await params;
  return { title: `TX ${hash.slice(0, 12)}...` };
}

export default async function TransactionPage({ params }: Props) {
  const { hash } = await params;

  let tx: Record<string, unknown> | null = null;
  let fetchError: string | null = null;
  try {
    tx = await getTransactionByHash(hash);
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

  const txHash = toHexAddress(tx.hash) || String(tx.hash ?? hash);
  const rawTxType = tx.tx_type as number | undefined;
  const typeName = rawTxType !== undefined
    ? (TX_TYPE_NAMES[rawTxType] ?? String(tx.type_name ?? tx.typeName ?? `Type ${rawTxType}`))
    : String(tx.type_name ?? tx.typeName ?? tx.type ?? "Unknown");
  const from = toHexAddress(tx.from);
  const to = toHexAddress(tx.to);
  const amount = tx.amount != null ? String(tx.amount) : null;
  const fee = String(tx.fee ?? "0");
  const nonce = tx.nonce as number | undefined;
  const blockHeight = tx.block_height as number ?? tx.blockHeight as number ?? null;
  const timestamp = tx.timestamp as number ?? 0;
  const payload = tx.payload as number[] | undefined;

  // Parse PlatformActivityReport payload
  let activityReport: PlatformActivityReportPayload | null = null;
  if (rawTxType === 11 && payload && payload.length > 0) {
    try {
      activityReport = parsePlatformActivityReportPayload(payload);
    } catch {
      // Payload parsing failed — ignore
    }
  }

  const rows: { label: string; value: string; link?: string; copy?: boolean }[] = [
    { label: "TX Hash", value: txHash, copy: true },
    { label: "Type", value: typeName },
    { label: "Status", value: "Success" },
    { label: "From", value: from, link: from ? `/address/${from}` : undefined, copy: !!from },
  ];

  if (nonce !== undefined) {
    rows.push({ label: "Nonce", value: String(nonce) });
  }

  if (to) {
    rows.push({ label: "To", value: to, link: `/address/${to}`, copy: true });
  }

  if (amount != null) {
    rows.push({ label: "Amount", value: `${formatCLAW(amount)} CLAW` });
  }

  rows.push({ label: "Fee", value: fee });

  if (blockHeight != null) {
    rows.push({ label: "Block Height", value: `${blockHeight}`, link: `/block/${blockHeight}` });
  }

  rows.push({
    label: "Timestamp",
    value: timestamp ? new Date(timestamp * 1000).toLocaleString() : "—",
  });

  return (
    <>
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
                {row.link ? (
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

        {/* PlatformActivityReport Details */}
        {activityReport && (
          <div className="mt-6 rounded-xl border border-border bg-surface/50 overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
              <FileText className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Platform Activity Report</h2>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary ml-2">
                {activityReport.platform}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 text-left">Agent Address</th>
                    <th className="px-6 py-3 text-left">Action Type</th>
                    <th className="px-6 py-3 text-right">Action Count</th>
                  </tr>
                </thead>
                <tbody>
                  {activityReport.entries.length === 0 ? (
                    <tr><td colSpan={3} className="px-6 py-6 text-center text-muted">No activity entries</td></tr>
                  ) : (
                    activityReport.entries.map((entry, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs">
                          <a href={`/address/${entry.agent_address}`} className="text-primary hover:underline">
                            {truncateAddress(entry.agent_address, 8)}
                          </a>
                        </td>
                        <td className="px-6 py-3">
                          <span className="rounded bg-accent/10 px-2 py-0.5 text-xs text-accent">
                            {entry.action_type}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-xs text-text">
                          {entry.action_count.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-border text-xs text-muted">
              {activityReport.entries.length} entr{activityReport.entries.length === 1 ? "y" : "ies"} reported
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
