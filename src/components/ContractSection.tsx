"use client";

import { useState } from "react";
import { CopyButton } from "./CopyButton";
import {
  getContractStorage,
  callContractView,
} from "@/lib/rpc";
import { Play, Database, FileCode } from "lucide-react";

interface ViewCallResult {
  returnData: string;
  fuelConsumed: number;
  logs: string[];
}

type ActiveTab = "read" | "storage" | "code";

interface ContractSectionProps {
  address: string;
  codeHash: string;
  codeSize: number | null;
}

export function ContractSection({ address, codeHash, codeSize }: ContractSectionProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("read");

  // Read Contract state
  const [method, setMethod] = useState("");
  const [argsHex, setArgsHex] = useState("");
  const [callResult, setCallResult] = useState<ViewCallResult | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);

  // Storage state
  const [storageKey, setStorageKey] = useState("");
  const [storageValue, setStorageValue] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [queryingStorage, setQueryingStorage] = useState(false);

  async function handleCallView(e: React.FormEvent) {
    e.preventDefault();
    if (!method.trim()) return;
    setCalling(true);
    setCallResult(null);
    setCallError(null);
    try {
      const result = await callContractView(address, method.trim(), argsHex.trim());
      setCallResult(result as unknown as ViewCallResult);
    } catch (e) {
      setCallError(e instanceof Error ? e.message : "Call failed");
    } finally {
      setCalling(false);
    }
  }

  async function handleQueryStorage(e: React.FormEvent) {
    e.preventDefault();
    if (!storageKey.trim()) return;
    setQueryingStorage(true);
    setStorageValue(null);
    setStorageError(null);
    try {
      const result = await getContractStorage(address, storageKey.trim());
      setStorageValue(result);
    } catch (e) {
      setStorageError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setQueryingStorage(false);
    }
  }

  const tabs: { id: ActiveTab; label: string; icon: typeof Play }[] = [
    { id: "read", label: "Read Contract", icon: Play },
    { id: "storage", label: "Storage", icon: Database },
    { id: "code", label: "Code", icon: FileCode },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface/50 overflow-hidden">
      <div className="flex border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted hover:text-primary"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="p-6">
        {/* Read Contract Tab */}
        {activeTab === "read" && (
          <div className="space-y-6">
            <p className="text-sm text-muted">
              Call a view method on this contract. View methods are read-only and do not modify state.
            </p>
            <form onSubmit={handleCallView} className="space-y-4">
              <div>
                <label className="block text-xs text-muted uppercase tracking-wider mb-1.5">Method Name</label>
                <input
                  type="text"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  placeholder="e.g. get_balance"
                  className="w-full rounded-lg border border-border bg-bg pl-4 pr-4 py-2.5 text-sm text-text placeholder:text-muted/50 focus:border-primary focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-muted uppercase tracking-wider mb-1.5">Arguments (hex)</label>
                <input
                  type="text"
                  value={argsHex}
                  onChange={(e) => setArgsHex(e.target.value)}
                  placeholder="Optional hex-encoded arguments"
                  className="w-full rounded-lg border border-border bg-bg pl-4 pr-4 py-2.5 text-sm text-text placeholder:text-muted/50 focus:border-primary focus:outline-none font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={calling || !method.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-bg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {calling ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-bg border-t-transparent" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Call View
              </button>
            </form>

            {callError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                {callError}
              </div>
            )}

            {callResult && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-primary">Result</h3>
                <div className="rounded-lg border border-border bg-bg p-4 space-y-3">
                  <div>
                    <span className="text-xs text-muted uppercase tracking-wider">Return Data</span>
                    <pre className="mt-1 font-mono text-sm text-text break-all whitespace-pre-wrap">
                      {callResult.returnData || "(empty)"}
                    </pre>
                  </div>
                  <div>
                    <span className="text-xs text-muted uppercase tracking-wider">Fuel Consumed</span>
                    <p className="mt-1 font-mono text-sm text-text">{callResult.fuelConsumed?.toLocaleString() ?? "--"}</p>
                  </div>
                  {callResult.logs && callResult.logs.length > 0 && (
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wider">Logs</span>
                      <div className="mt-1 space-y-1">
                        {callResult.logs.map((log, i) => (
                          <p key={i} className="font-mono text-xs text-muted">{log}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Storage Tab */}
        {activeTab === "storage" && (
          <div className="space-y-6">
            <p className="text-sm text-muted">
              Query contract storage by key. Provide the storage key as a hex string.
            </p>
            <form onSubmit={handleQueryStorage} className="space-y-4">
              <div>
                <label className="block text-xs text-muted uppercase tracking-wider mb-1.5">Storage Key (hex)</label>
                <input
                  type="text"
                  value={storageKey}
                  onChange={(e) => setStorageKey(e.target.value)}
                  placeholder="e.g. 0a1b2c3d..."
                  className="w-full rounded-lg border border-border bg-bg pl-4 pr-4 py-2.5 text-sm text-text placeholder:text-muted/50 focus:border-primary focus:outline-none font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={queryingStorage || !storageKey.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-bg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {queryingStorage ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-bg border-t-transparent" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                Query Storage
              </button>
            </form>

            {storageError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                {storageError}
              </div>
            )}

            {storageValue !== null && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-primary">Value</h3>
                <div className="rounded-lg border border-border bg-bg p-4">
                  <pre className="font-mono text-sm text-text break-all whitespace-pre-wrap">
                    {storageValue || "(empty)"}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Code Tab */}
        {activeTab === "code" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Contract bytecode information. Full bytecode is not displayed due to size.
            </p>
            <div className="rounded-lg border border-border bg-bg divide-y divide-border">
              <div className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:gap-8">
                <span className="w-28 shrink-0 text-xs text-muted uppercase tracking-wider">Code Size</span>
                <span className="font-mono text-sm text-text">
                  {codeSize != null ? `${codeSize.toLocaleString()} bytes` : "--"}
                </span>
              </div>
              <div className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:gap-8">
                <span className="w-28 shrink-0 text-xs text-muted uppercase tracking-wider">Code Hash</span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-sm text-text truncate">{codeHash || "--"}</span>
                  {codeHash && <CopyButton text={codeHash} />}
                </div>
              </div>
              <div className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:gap-8">
                <span className="w-28 shrink-0 text-xs text-muted uppercase tracking-wider">Address</span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-sm text-text truncate">{address}</span>
                  <CopyButton text={address} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
