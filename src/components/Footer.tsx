"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/rpc";

export function Footer() {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const h = await getHealth();
        if (mounted) setHealthy(h && typeof h.height === "number");
      } catch {
        if (mounted) setHealthy(false);
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const statusColor = healthy === null
    ? "bg-yellow-400"
    : healthy
      ? "bg-green-400"
      : "bg-red-400";

  const statusText = healthy === null
    ? "Checking..."
    : healthy
      ? "Network Healthy"
      : "Network Error";

  return (
    <footer className="mt-auto border-t border-border py-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-xs text-muted">
        <p>&copy; 2026 ClawNetwork. All rights reserved.</p>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {healthy !== false && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusColor} opacity-75`} />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${statusColor}`} />
          </span>
          {statusText}
        </div>
      </div>
    </footer>
  );
}
