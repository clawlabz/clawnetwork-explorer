"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Menu, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useNetwork } from "./NetworkContext";
import { NETWORKS, type NetworkId } from "@/lib/config";

const NETWORK_LIST = Object.values(NETWORKS);

/** Try to look up a tx hash via the RPC proxy. Returns true if found. */
async function checkTxExists(hash: string, network: NetworkId): Promise<boolean> {
  try {
    const res = await fetch(`/api/rpc?network=${network}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "claw_getTransactionByHash", params: [hash] }),
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json();
    return json.result != null;
  } catch {
    return false;
  }
}

export function Header() {
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { network, config, setNetwork } = useNetwork();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearchError("");

    if (/^\d+$/.test(q)) {
      router.push(`/block/${q}`);
      setQuery("");
      return;
    }

    if (q.length === 64 && /^[0-9a-fA-F]+$/.test(q)) {
      // 64-char hex could be a tx hash OR an address — check tx first
      setSearching(true);
      try {
        const isTx = await checkTxExists(q, network);
        if (isTx) {
          router.push(`/tx/${q}`);
        } else {
          router.push(`/address/${q}`);
        }
        setQuery("");
      } catch {
        setSearchError("Search failed — please try again");
      } finally {
        setSearching(false);
      }
      return;
    }

    if (q.length >= 40 && /^[0-9a-fA-F]+$/.test(q)) {
      router.push(`/address/${q}`);
      setQuery("");
      return;
    }

    setSearchError("Enter block number, tx hash (64 hex), or address");
  }

  function handleNetworkSelect(id: NetworkId) {
    if (id !== network) {
      setNetwork(id);
    }
    setDropdownOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <a href="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo.svg" alt="ClawExplorer" width={32} height={32} className="rounded-md" />
          <span className="text-lg font-bold">Claw<span className="text-primary">Explorer</span></span>
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          <a href="/" className="text-sm text-muted hover:text-primary transition-colors">Dashboard</a>
          <a href="/stats" className="text-sm text-muted hover:text-primary transition-colors">Stats</a>
          <a href="/validators" className="text-sm text-muted hover:text-primary transition-colors">Validators</a>
          <a href="/rich-list" className="text-sm text-muted hover:text-primary transition-colors">Rich List</a>
          <a href="/tokens" className="text-sm text-muted hover:text-primary transition-colors">Tokens</a>
          <a href="/contracts" className="text-sm text-muted hover:text-primary transition-colors">Contracts</a>
          <a href="/rewards" className="text-sm text-muted hover:text-primary transition-colors">Rewards</a>
          <a href="https://chain.clawlabz.xyz/en/docs/quickstart" target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-primary transition-colors">Docs</a>
        </nav>

        <div className="flex items-center gap-3 flex-1 max-w-lg justify-end">
          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg border border-border bg-surface text-muted hover:text-primary transition-colors"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          {/* Network Switcher */}
          <div ref={dropdownRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium transition-colors hover:border-primary/50"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-text">{config.name}</span>
              <ChevronDown className={`h-3 w-3 text-muted transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-surface shadow-xl shadow-black/30 overflow-hidden z-50">
                {NETWORK_LIST.map((net) => (
                  <button
                    key={net.id}
                    type="button"
                    onClick={() => handleNetworkSelect(net.id)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-xs transition-colors hover:bg-primary/5 ${
                      net.id === network ? "bg-primary/10 text-primary" : "text-text"
                    }`}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: net.color }}
                    />
                    <span className="font-medium">{net.name}</span>
                    {net.id === network && (
                      <span className="ml-auto text-[10px] text-primary/60">Active</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
            {searching ? (
              <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary animate-spin" />
            ) : (
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            )}
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchError(""); }}
              placeholder="Search by Address / TX Hash / Block"
              disabled={searching}
              className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2 text-sm text-text placeholder:text-muted/50 focus:border-primary focus:outline-none disabled:opacity-50"
            />
            {searchError && (
              <p className="absolute top-full mt-1 text-xs text-red-400">{searchError}</p>
            )}
          </form>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <nav className="md:hidden border-t border-border bg-surface/95 backdrop-blur-md px-4 py-3 flex flex-col gap-1">
          {[
            { href: "/", label: "Dashboard" },
            { href: "/stats", label: "Stats" },
            { href: "/validators", label: "Validators" },
            { href: "/rich-list", label: "Rich List" },
            { href: "/tokens", label: "Tokens" },
            { href: "/contracts", label: "Contracts" },
            { href: "/rewards", label: "Rewards" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm text-muted hover:text-primary transition-colors py-2 px-2 rounded-lg hover:bg-primary/5"
            >
              {item.label}
            </a>
          ))}
          <a
            href="https://chain.clawlabz.xyz/en/docs/quickstart"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted hover:text-primary transition-colors py-2 px-2 rounded-lg hover:bg-primary/5"
          >
            Docs
          </a>
        </nav>
      )}
    </header>
  );
}
