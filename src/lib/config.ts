/**
 * Centralized configuration for ClawNetwork Explorer.
 * Supports mainnet/testnet network switching.
 */

export type NetworkId = "mainnet" | "testnet";

export interface NetworkConfig {
  id: NetworkId;
  name: string;
  rpcUrl: string;
  badge: string;
  color: string;
}

const TESTNET_RPC = (
  process.env.TESTNET_RPC_URL ||
  process.env.RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  "http://localhost:9710"
).trim();

const MAINNET_RPC = (
  process.env.MAINNET_RPC_URL ||
  "https://rpc.clawlabz.xyz"
).trim();

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  mainnet: {
    id: "mainnet",
    name: "Mainnet",
    rpcUrl: MAINNET_RPC,
    badge: "Mainnet",
    color: "#F96706",
  },
  testnet: {
    id: "testnet",
    name: "Testnet",
    rpcUrl: TESTNET_RPC,
    badge: "Testnet",
    color: "#eab308",
  },
};

export const DEFAULT_NETWORK: NetworkId = "mainnet";

/** Get RPC URL for a given network (server-side) */
export function getRpcUrl(network: NetworkId): string {
  return NETWORKS[network]?.rpcUrl ?? NETWORKS[DEFAULT_NETWORK].rpcUrl;
}

/** @deprecated Use getRpcUrl(network) instead */
export const RPC_URL = TESTNET_RPC;
