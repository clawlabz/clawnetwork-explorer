const DIRECT_RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "http://39.102.144.231:9710";
const isServer = typeof window === "undefined";

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const url = isServer ? DIRECT_RPC_URL : "/api/rpc";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

export async function getBlockNumber(): Promise<number> {
  return rpc<number>("clw_blockNumber");
}

export async function getBlock(height: number): Promise<Record<string, unknown> | null> {
  return rpc<Record<string, unknown> | null>("clw_getBlockByNumber", [height]);
}

export async function getBalance(address: string): Promise<string> {
  return rpc<string>("clw_getBalance", [address]);
}

export async function getNonce(address: string): Promise<number> {
  return rpc<number>("clw_getNonce", [address]);
}

export async function getAgent(address: string): Promise<Record<string, unknown> | null> {
  return rpc<Record<string, unknown> | null>("clw_getAgent", [address]);
}

export async function getReputation(address: string): Promise<unknown[]> {
  return rpc<unknown[]>("clw_getReputation", [address]);
}

export async function getServices(type?: string): Promise<unknown[]> {
  return rpc<unknown[]>("clw_getServices", type ? [type] : []);
}

export async function getTransactionByHash(hash: string): Promise<Record<string, unknown> | null> {
  return rpc<Record<string, unknown> | null>("clw_getTransactionByHash", [hash]);
}

export async function getTransactionsByAddress(address: string, limit = 50, offset = 0): Promise<unknown[]> {
  return rpc<unknown[]>("clw_getTransactionsByAddress", [address, limit, offset]);
}

export async function getHealth(): Promise<Record<string, unknown>> {
  const url = isServer ? `${DIRECT_RPC_URL}/health` : "/api/health";
  const res = await fetch(url, { cache: "no-store" });
  return res.json();
}

export function formatCLW(baseUnits: string): string {
  const n = BigInt(baseUnits);
  const whole = n / BigInt(1e9);
  const frac = n % BigInt(1e9);
  if (frac === BigInt(0)) return `${whole}`;
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

export function truncateAddress(addr: string, chars = 6): string {
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

/** Convert a value that may be a byte array (number[]) to hex string */
export function toHexAddress(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const hex = value.map((b: number) => b.toString(16).padStart(2, "0")).join("");
    if (hex === "0".repeat(hex.length)) return "";
    return hex;
  }
  return "";
}

/** Parse raw transaction from block to extract to, amount, and compute a display hash */
export interface ParsedTx {
  hash: string;
  txType: number;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  blockHeight: number;
}

export function parseBlockTransaction(
  tx: Record<string, unknown>,
  blockTimestamp: number,
  blockHeight: number,
  txIndex: number,
): ParsedTx {
  const txType = tx.tx_type as number;
  const from = toHexAddress(tx.from);
  const payload = tx.payload as number[] | undefined;

  let to = "";
  let amount = "";

  if (payload && payload.length > 0) {
    switch (txType) {
      case 1: // TokenTransfer: [to:32][amount:16 u128 LE]
        if (payload.length >= 48) {
          to = toHexAddress(payload.slice(0, 32));
          amount = readU128LE(payload, 32);
        }
        break;
      case 3: // TokenMintTransfer: [tokenId:32][to:32][amount:16 u128 LE]
        if (payload.length >= 80) {
          to = toHexAddress(payload.slice(32, 64));
          amount = readU128LE(payload, 64);
        }
        break;
      case 4: // ReputationAttest: [to:32]...
        if (payload.length >= 32) {
          to = toHexAddress(payload.slice(0, 32));
        }
        break;
    }
  }

  // Use blockHeight+txIndex as a pseudo-hash for linking (until RPC returns real hash)
  const hash = `${blockHeight}:${txIndex}`;

  return { hash, txType, from, to, amount, timestamp: blockTimestamp, blockHeight };
}

function readU128LE(bytes: number[], offset: number): string {
  let value = BigInt(0);
  for (let i = 15; i >= 0; i--) {
    value = (value << BigInt(8)) | BigInt(bytes[offset + i] ?? 0);
  }
  return value.toString();
}
