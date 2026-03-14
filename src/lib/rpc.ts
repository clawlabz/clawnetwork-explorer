const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://39.102.144.231:9710";

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(RPC_URL, {
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

export async function getHealth(): Promise<Record<string, unknown>> {
  const res = await fetch(`${RPC_URL}/health`, { cache: "no-store" });
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
