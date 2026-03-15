"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ArrowLeft, FileCode, Search } from "lucide-react";

export default function ContractsPage() {
  const [address, setAddress] = useState("");
  const router = useRouter();

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const q = address.trim();
    if (!q) return;
    router.push(`/contract/${q}`);
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
            <FileCode className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Smart Contracts</h1>
            <p className="text-xs text-muted mt-0.5">Contracts deployed on ClawNetwork</p>
          </div>
        </div>

        {/* Lookup Card */}
        <div className="rounded-xl border border-border bg-surface/50 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-2">Contract Lookup</h2>
          <p className="text-sm text-muted mb-4">
            Enter a contract address to view its details, read methods, and storage.
          </p>
          <form onSubmit={handleLookup} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Contract address (hex)"
                className="w-full rounded-lg border border-border bg-bg pl-10 pr-4 py-2.5 text-sm text-text placeholder:text-muted/50 focus:border-primary focus:outline-none font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!address.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-bg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <FileCode className="h-4 w-4" />
              View Contract
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="rounded-xl border border-border bg-surface/50 p-8 text-center">
          <FileCode className="h-12 w-12 text-muted/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-muted mb-2">Contract Explorer</h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            ClawNetwork supports smart contracts with a WASM-based virtual machine.
            Use the lookup above to inspect any deployed contract, call view methods, and query storage.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
