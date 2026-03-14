import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { getTransactionByHash, formatCLAW, truncateAddress, toHexAddress } from "@/lib/rpc";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";

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
  const typeName = String(tx.type_name ?? tx.typeName ?? tx.type ?? "Unknown");
  const from = toHexAddress(tx.from);
  const to = toHexAddress(tx.to);
  const amount = tx.amount != null ? String(tx.amount) : null;
  const fee = String(tx.fee ?? "0");
  const nonce = tx.nonce as number | undefined;
  const blockHeight = tx.block_height as number ?? tx.blockHeight as number ?? null;
  const timestamp = tx.timestamp as number ?? 0;

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
      </main>
      <Footer />
    </>
  );
}
