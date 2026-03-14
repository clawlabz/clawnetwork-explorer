/**
 * Centralized configuration for ClawNetwork Explorer.
 * All RPC URL references should import from here.
 */
export const RPC_URL =
  process.env.RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  "http://localhost:9710";
