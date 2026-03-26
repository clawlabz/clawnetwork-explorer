import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { getTransactionByHash, parseTokenCreatePayload, formatCLAW, truncateAddress, toHexAddress, getServerNetwork } from "@/lib/rpc";
import { notFound } from "next/navigation";
import { ArrowLeft, Coins } from "lucide-react";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: `Token ${id.slice(0, 12)}...` };
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

export default async function TokenDetailPage({ params }: Props) {
  const { id } = await params;
  const network = await getServerNetwork();

  let tx: Record<string, unknown> | null = null;
  let fetchError: string | null = null;
  try {
    tx = await getTransactionByHash(id, network);
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to connect to node";
  }

  if (fetchError) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8">
          <a href="/tokens" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Tokens
          </a>
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-8 text-center">
            <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to load token</h2>
            <p className="text-sm text-muted">{fetchError}</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!tx) notFound();

  // Parse the borsh payload to get token info
  const payload = tx.payload as number[] | undefined;
  let tokenInfo: { name: string; symbol: string; decimals: number; initialSupply: string } | null = null;
  if (payload && payload.length > 0) {
    try {
      tokenInfo = parseTokenCreatePayload(payload);
    } catch {
      // Payload is not a valid TokenCreate — show raw tx instead
    }
  }

  const creator = toHexAddress(tx.from);
  const blockHeight = (tx.block_height as number) ?? (tx.blockHeight as number) ?? null;
  const timestamp = (tx.timestamp as number) ?? 0;
  const txHash = toHexAddress(tx.hash) || id;

  // Build detail rows
  const rows: { label: string; value: string; link?: string; copy?: boolean; badge?: boolean }[] = [];

  if (tokenInfo) {
    rows.push({ label: "Token Name", value: tokenInfo.name });
    rows.push({ label: "Symbol", value: tokenInfo.symbol, badge: true });
    rows.push({ label: "Decimals", value: String(tokenInfo.decimals) });
    rows.push({
      label: "Total Supply",
      value: `${formatTokenSupply(tokenInfo.initialSupply, tokenInfo.decimals)} ${tokenInfo.symbol}`,
    });
  }

  // NOTE: This is the creation tx hash, not the actual on-chain token ID (which is blake3(tx_bytes)).
  // A dedicated claw_getTokenInfo(tokenId) RPC is needed for proper token ID lookup.
  rows.push({ label: "Creation TX", value: txHash, copy: true, link: `/tx/${txHash}` });
  rows.push({
    label: "Creator",
    value: creator,
    link: creator ? `/address/${creator}` : undefined,
    copy: !!creator,
  });

  if (blockHeight != null) {
    rows.push({ label: "Created at Block", value: String(blockHeight), link: `/block/${blockHeight}` });
  }

  rows.push({
    label: "Creation Time",
    value: timestamp ? new Date(timestamp * 1000).toLocaleString() : "—",
  });

  // Transaction link omitted — "Creation TX" row above already links to the transaction

  const displayName = tokenInfo?.name ?? `Token ${truncateAddress(txHash, 8)}`;
  const displaySymbol = tokenInfo?.symbol ?? null;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <a href="/tokens" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Tokens
        </a>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            {displaySymbol && (
              <span className="mt-1 inline-block rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {displaySymbol}
              </span>
            )}
          </div>
        </div>

        {/* Overview Cards (only when token info is available) */}
        {tokenInfo && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
            <div className="rounded-xl border border-border bg-surface/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted uppercase tracking-wider">Total Supply</span>
              </div>
              <span className="text-xl font-bold text-primary">
                {formatTokenSupply(tokenInfo.initialSupply, tokenInfo.decimals)}
              </span>
              <span className="text-sm text-muted ml-1">{tokenInfo.symbol}</span>
            </div>

            <div className="rounded-xl border border-border bg-surface/50 p-5">
              <span className="text-xs text-muted uppercase tracking-wider">Decimals</span>
              <p className="text-2xl font-bold mt-1">{tokenInfo.decimals}</p>
            </div>

            <div className="rounded-xl border border-border bg-surface/50 p-5">
              <span className="text-xs text-muted uppercase tracking-wider">Creator</span>
              <p className="mt-1">
                {creator ? (
                  <a href={`/address/${creator}`} className="font-mono text-sm text-primary hover:underline">
                    {truncateAddress(creator, 8)}
                  </a>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Detail Rows */}
        <div className="rounded-xl border border-border bg-surface/50 divide-y divide-border">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1 px-6 py-4 md:flex-row md:items-center md:gap-8">
              <span className="w-36 shrink-0 text-xs text-muted uppercase tracking-wider">{row.label}</span>
              <div className="flex items-center gap-2 min-w-0">
                {row.badge ? (
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-sm text-primary font-semibold">
                    {row.value}
                  </span>
                ) : row.link ? (
                  <a href={row.link} className="font-mono text-sm text-primary hover:underline truncate">
                    {row.label === "Created at Block" ? row.value : truncateAddress(row.value, 12)}
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
