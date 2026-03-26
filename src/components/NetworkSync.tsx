"use client";

import { useEffect } from "react";
import type { NetworkId } from "@/lib/config";

/**
 * Syncs a server-detected network (from URL ?network= param) to the client-side
 * localStorage so the Header network badge shows the correct network.
 * This component renders nothing — it just performs a side effect.
 */
export function NetworkSync({ network }: { network: NetworkId }) {
  useEffect(() => {
    const stored = localStorage.getItem("claw-explorer-network");
    if (stored !== network) {
      localStorage.setItem("claw-explorer-network", network);
      // Trigger re-render of NetworkContext without full reload
      window.dispatchEvent(new Event("storage"));
    }
  }, [network]);

  return null;
}
