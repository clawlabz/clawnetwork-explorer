"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

export function Header() {
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearchError("");
    if (/^\d+$/.test(q)) {
      router.push(`/block/${q}`);
    } else if (q.length === 64 && /^[0-9a-fA-F]+$/.test(q)) {
      router.push(`/tx/${q}`);
    } else if (q.length >= 40) {
      router.push(`/address/${q}`);
    } else {
      setSearchError("Enter block number, tx hash (64 hex), or address");
      return;
    }
    setQuery("");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <a href="/" className="flex items-center gap-2 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-lg font-bold">Claw<span className="text-primary">Explorer</span></span>
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          <a href="/" className="text-sm text-muted hover:text-primary transition-colors">Dashboard</a>
          <a href="/stats" className="text-sm text-muted hover:text-primary transition-colors">Stats</a>
          <a href="/validators" className="text-sm text-muted hover:text-primary transition-colors">Validators</a>
          <a href="/tokens" className="text-sm text-muted hover:text-primary transition-colors">Tokens</a>
          <a href="/contracts" className="text-sm text-muted hover:text-primary transition-colors">Contracts</a>
          <a href="https://clawnetwork-web.vercel.app/en/docs/quickstart" target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-primary transition-colors">Docs</a>
        </nav>

        <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSearchError(""); }}
            placeholder="Search by Address / TX Hash / Block Height"
            className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2 text-sm text-text placeholder:text-muted/50 focus:border-primary focus:outline-none"
          />
          {searchError && (
            <p className="absolute top-full mt-1 text-xs text-red-400">{searchError}</p>
          )}
        </form>
      </div>
    </header>
  );
}
