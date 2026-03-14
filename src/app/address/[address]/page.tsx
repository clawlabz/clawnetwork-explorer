import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { getBalance, getNonce, getAgent, getReputation, formatCLW } from "@/lib/rpc";
import { ArrowLeft, User, Coins, Shield } from "lucide-react";

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props) {
  const { address } = await params;
  return { title: `Address ${address.slice(0, 8)}...` };
}

export default async function AddressPage({ params }: Props) {
  const { address } = await params;

  let balance = "0";
  let nonce = 0;
  let agent: Record<string, unknown> | null = null;
  let reputation: unknown[] = [];

  try {
    [balance, nonce, agent, reputation] = await Promise.all([
      getBalance(address),
      getNonce(address),
      getAgent(address),
      getReputation(address),
    ]);
  } catch (e) {
    console.error("Failed to fetch address data:", e);
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <a href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </a>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Address</h1>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted break-all">{address}</span>
              <CopyButton text={address} />
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
          <div className="rounded-xl border border-border bg-surface/50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted uppercase tracking-wider">Balance</span>
            </div>
            <span className="text-2xl font-bold text-primary">{formatCLW(balance)}</span>
            <span className="text-sm text-muted ml-1">CLW</span>
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

        {/* Agent Info */}
        {agent && (
          <div className="mb-8 rounded-xl border border-border bg-surface/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-semibold">Agent Identity</h2>
            </div>
            <div className="p-6">
              <pre className="text-xs text-muted overflow-x-auto">{JSON.stringify(agent, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Reputation */}
        {reputation.length > 0 && (
          <div className="rounded-xl border border-border bg-surface/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-semibold">Reputation Attestations ({reputation.length})</h2>
            </div>
            <div className="p-6">
              <pre className="text-xs text-muted overflow-x-auto">{JSON.stringify(reputation, null, 2)}</pre>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
