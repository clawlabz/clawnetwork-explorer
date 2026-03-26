"use client";

import { useEffect } from "react";
import type { NetworkId } from "@/lib/config";

/**
 * Syncs a server-detected network to the client-side localStorage and cookie
 * so the Header network badge shows the correct network.
 * This component renders nothing — it just performs a side effect.
 */
export function NetworkSync({ network }: { network: NetworkId }) {
  useEffect(() => {
    const stored = localStorage.getItem("claw-explorer-network");
    if (stored !== network) {
      localStorage.setItem("claw-explorer-network", network);
      document.cookie = `claw-network=${network};path=/;max-age=31536000;SameSite=Lax`;
      // Trigger re-render of NetworkContext without full reload
      window.dispatchEvent(new Event("storage"));
    }
  }, [network]);

  return null;
}
