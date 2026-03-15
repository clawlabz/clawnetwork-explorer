"use client";

import { useNetwork } from "./NetworkContext";

export function NetworkBanner() {
  const { config } = useNetwork();

  if (config.id === "mainnet") return null;

  return (
    <div
      className="border-b text-center py-1.5"
      style={{
        backgroundColor: `${config.color}10`,
        borderColor: `${config.color}30`,
      }}
    >
      <span
        className="text-xs font-medium"
        style={{ color: config.color }}
      >
        {config.badge} — This explorer is connected to ClawNetwork {config.name}
      </span>
    </div>
  );
}
