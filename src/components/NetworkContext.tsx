"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { NETWORKS, DEFAULT_NETWORK, type NetworkId, type NetworkConfig } from "@/lib/config";

interface NetworkContextValue {
  network: NetworkId;
  config: NetworkConfig;
  setNetwork: (id: NetworkId) => void;
}

const NetworkContext = createContext<NetworkContextValue>({
  network: DEFAULT_NETWORK,
  config: NETWORKS[DEFAULT_NETWORK],
  setNetwork: () => {},
});

const STORAGE_KEY = "claw-explorer-network";

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<NetworkId>(DEFAULT_NETWORK);

  // Read from localStorage (or cookie fallback) on mount + listen for external changes
  useEffect(() => {
    const syncFromStorage = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "mainnet" || stored === "testnet") {
        setNetworkState(stored);
        return;
      }
      // Fallback: read from cookie
      const match = document.cookie.match(/(?:^|;\s*)claw-network=(mainnet|testnet)/);
      if (match) {
        const cookieVal = match[1] as "mainnet" | "testnet";
        setNetworkState(cookieVal);
        localStorage.setItem(STORAGE_KEY, cookieVal);
      }
    };
    syncFromStorage();
    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, []);

  const setNetwork = useCallback((id: NetworkId) => {
    setNetworkState(id);
    localStorage.setItem(STORAGE_KEY, id);
    // Set cookie so SSR pages can read the network preference
    document.cookie = `claw-network=${id};path=/;max-age=31536000;SameSite=Lax`;
    // Force full page refresh to re-fetch all data with new network
    window.location.reload();
  }, []);

  const config = NETWORKS[network];

  return (
    <NetworkContext.Provider value={{ network, config, setNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
