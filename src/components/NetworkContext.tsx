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

  // Read from localStorage on mount + listen for external changes (e.g., NetworkSync)
  useEffect(() => {
    const syncFromStorage = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "mainnet" || stored === "testnet") {
        setNetworkState(stored);
      }
    };
    syncFromStorage();
    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, []);

  const setNetwork = useCallback((id: NetworkId) => {
    setNetworkState(id);
    localStorage.setItem(STORAGE_KEY, id);
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
