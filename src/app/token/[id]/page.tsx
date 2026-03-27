import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { getTokenInfo, getTransactionByHash, parseTokenCreatePayload, truncateAddress, toHexAddress, getServerNetwork } from "@/lib/rpc";
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

  // Try claw_getTokenInfo first (id may be a real token ID or a creation tx hash)
  let rpcTokenInfo: Record<string, unknown> | null = null;
  let tx: Record<string, unknown> | null = null;
  let fetchError: string | null = null;

  try {
    rpcTokenInfo = await getTokenInfo(id, network);
  } catch {
    // RPC may not support this method — fall through
  }

  // If RPC returned token info, use it directly
  // Otherwise fall back to looking up by tx hash (legacy route)
  if (!rpcTokenInfo) {
    try {
      tx = await getTransactionByHash(id, network);
    } catch (e) {
      fetchError = e instanceof Error ? e.message : "Failed to connect to node";
    }
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

  if (!rpcTokenInfo && !tx) notFound();

  // Build token info from either the RPC response or the creation tx payload
  let tokenInfo: { name: string; symbol: string; decimals: number; initialSupply: string } | null = null;
  let creator = "";
  let blockHeight: number | null = null;
  let timestamp = 0;
  let txHash = "";
  let tokenId = id;

  if (rpcTokenInfo) {
    // Token data from claw_getTokenInfo RPC
    const name = String(rpcTokenInfo.name ?? "");
    const symbol = String(rpcTokenInfo.symbol ?? "");
    const decimals = (rpcTokenInfo.decimals as number) ?? 0;
    const totalSupply = String(rpcTokenInfo.totalSupply ?? rpcTokenInfo.total_supply ?? "0");
    tokenInfo = { name, symbol, decimals, initialSupply: totalSupply };
    creator = toHexAddress(rpcTokenInfo.creator ?? rpcTokenInfo.owner);
    blockHeight = (rpcTokenInfo.blockHeight as number) ?? (rpcTokenInfo.block_height as number) ?? null;
    timestamp = (rpcTokenInfo.timestamp as number) ?? 0;
    txHash = toHexAddress(rpcTokenInfo.creationTxHash ?? rpcTokenInfo.creation_tx_hash) || "";
    tokenId = String(rpcTokenInfo.tokenId ?? rpcTokenInfo.token_id ?? id);
  } else if (tx) {
    // Fallback: parse from the creation transaction payload
    const payload = tx.payload as number[] | undefined;
    if (payload && payload.length > 0) {
      try {
        tokenInfo = parseTokenCreatePayload(payload);
      } catch {
        // Payload is not a valid TokenCreate — show raw tx instead
      }
    }
    creator = toHexAddress(tx.from);
    blockHeight = (tx.blockHeight as number) ?? (tx.block_height as number) ?? null;
    timestamp = (tx.timestamp as number) ?? 0;
    txHash = toHexAddress(tx.hash) || id;
  }

  // Build detail rows
  const rows: { label: string; value: string; link?: string; copy?: boolean; badge?: boolean }[] = [];

  rows.push({ label: "Token ID", value: tokenId, copy: true });

  if (tokenInfo) {
    rows.push({ label: "Token Name", value: tokenInfo.name });
    rows.push({ label: "Symbol", value: tokenInfo.symbol, badge: true });
    rows.push({ label: "Decimals", value: String(tokenInfo.decimals) });
    rows.push({
      label: "Total Supply",
      value: `${formatTokenSupply(tokenInfo.initialSupply, tokenInfo.decimals)} ${tokenInfo.symbol}`,
    });
  }

  if (txHash) {
    rows.push({ label: "Creation TX", value: txHash, copy: true, link: `/tx/${txHash}` });
  }
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

  const displayName = tokenInfo?.name ?? `Token ${truncateAddress(tokenId, 8)}`;
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
