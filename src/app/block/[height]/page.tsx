import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { getBlock, truncateAddress, toHexAddress } from "@/lib/rpc";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";

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
  try {
    block = await getBlock(h);
  } catch { /* ignore */ }

  if (!block) notFound();

  const hash = toHexAddress(block.hash) || String(block.hash ?? "");
  const validator = toHexAddress(block.validator);
  const timestamp = block.timestamp as number || 0;
  const txns = (block.transactions as unknown[]) || [];
  const stateRoot = toHexAddress(block.state_root) || String(block.state_root ?? "");
  const prevHash = toHexAddress(block.prev_hash) || String(block.prev_hash ?? "");

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
            { label: "Timestamp", value: timestamp ? new Date(timestamp * 1000).toLocaleString() : "—" },
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

        {txns.length > 0 && (
          <div className="mt-8 rounded-xl border border-border bg-surface/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-semibold">Transactions ({txns.length})</h2>
            </div>
            <div className="p-6">
              <pre className="text-xs text-muted overflow-x-auto">{JSON.stringify(txns, null, 2)}</pre>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
