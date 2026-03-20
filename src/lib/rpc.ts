import { getRpcUrl, DEFAULT_NETWORK, type NetworkId } from "./config";

const isServer = typeof window === "undefined";

/** Read network from localStorage (client-side only) */
function getClientNetwork(): NetworkId {
  if (isServer) return DEFAULT_NETWORK;
  try {
    const stored = localStorage.getItem("claw-explorer-network");
    if (stored === "mainnet" || stored === "testnet") return stored;
  } catch { /* ignore */ }
  return DEFAULT_NETWORK;
}

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const network = getClientNetwork();
  let url: string;

  if (isServer) {
    url = getRpcUrl(network);
  } else {
    url = `/api/rpc?network=${network}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
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

export async function getContractInfo(address: string): Promise<Record<string, unknown> | null> {
  return rpc<Record<string, unknown> | null>("clw_getContractInfo", [address]);
}

export async function getContractCode(address: string): Promise<Record<string, unknown> | null> {
  return rpc<Record<string, unknown> | null>("clw_getContractCode", [address]);
}

export async function getContractStorage(address: string, key: string): Promise<string | null> {
  return rpc<string | null>("clw_getContractStorage", [address, key]);
}

export async function callContractView(address: string, method: string, args: string = ""): Promise<Record<string, unknown> | null> {
  return rpc<Record<string, unknown> | null>("clw_callContractView", [address, method, args]);
}

export interface AgentScore {
  total_score: number;
  activity_score: number;
  uptime_score: number;
  block_production_score: number;
  economic_score: number;
  platform_score: number;
  decay_factor: number;
}

export async function getAgentScore(address: string): Promise<AgentScore | null> {
  try {
    return await rpc<AgentScore | null>("clw_getAgentScore", [address]);
  } catch {
    return null;
  }
}

export interface PlatformActivityEntry {
  agent_address: string;
  action_count: number;
  action_type: string;
}

export interface PlatformActivityReportPayload {
  platform: string;
  entries: PlatformActivityEntry[];
}

/** Parse PlatformActivityReport payload (type 11) from Borsh-encoded bytes */
export function parsePlatformActivityReportPayload(payloadBytes: number[]): PlatformActivityReportPayload {
  const r: BorshReader = { data: payloadBytes, offset: 0 };
  const platform = borshReadString(r);
  const entryCount = borshReadU32LE(r);
  const entries: PlatformActivityEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    const addrBytes = r.data.slice(r.offset, r.offset + 32);
    r.offset += 32;
    const agent_address = toHexAddress(addrBytes);
    const action_count = borshReadU32LE(r);
    const action_type = borshReadString(r);
    entries.push({ agent_address, action_count, action_type });
  }
  return { platform, entries };
}

export async function getValidators(): Promise<unknown[]> {
  return rpc<unknown[]>("clw_getValidators");
}

export interface ValidatorDetail {
  address: string;
  stake: string;
  weight: number;
  agentScore: number;
  commission_bps?: number;
  delegatedBy?: string | null;
  uptime?: {
    produced_blocks: number;
    expected_blocks: number;
    signed_blocks: number;
    uptime_pct: number;
  };
  jailed?: boolean;
}

export async function getValidatorDetail(address: string): Promise<ValidatorDetail | null> {
  try {
    return await rpc<ValidatorDetail>("clw_getValidatorDetail", [address]);
  } catch {
    return null;
  }
}

export async function getStakeDelegation(address: string): Promise<string | null> {
  try {
    return await rpc<string | null>("clw_getStakeDelegation", [address]);
  } catch {
    return null;
  }
}

export async function getHealth(): Promise<Record<string, unknown>> {
  const network = getClientNetwork();

  if (isServer) {
    const rpcUrl = getRpcUrl(network);
    const res = await fetch(`${rpcUrl}/health`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    return res.json();
  }

  const res = await fetch(`/api/health?network=${network}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  return res.json();
}

export function formatCLAW(baseUnits: string): string {
  try {
    const n = BigInt(baseUnits);
    const whole = n / BigInt(1e9);
    const frac = n % BigInt(1e9);
    if (frac === BigInt(0)) return whole.toString();
    const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
    return `${whole}.${fracStr}`;
  } catch {
    return "0";
  }
}

/** @deprecated Use formatCLAW instead */
export const formatCLW = formatCLAW;

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

export const TX_TYPE_NAMES: Record<number, string> = {
  0: "AgentRegister",
  1: "TokenTransfer",
  2: "TokenCreate",
  3: "TokenMintTransfer",
  4: "ReputationAttest (Deprecated)",
  5: "ServiceRegister",
  6: "StakeDeposit",
  7: "StakeWithdraw",
  8: "ContractDeploy",
  9: "ContractCall",
  10: "ContractTransfer",
  11: "PlatformActivityReport",
};

const TX_TYPE_STRING_TO_NUM: Record<string, number> = {
  AgentRegister: 0,
  TokenTransfer: 1,
  TokenCreate: 2,
  TokenMintTransfer: 3,
  ReputationAttest: 4,
  ServiceRegister: 5,
  StakeDeposit: 6,
  StakeWithdraw: 7,
  ContractDeploy: 8,
  ContractCall: 9,
  ContractTransfer: 10,
  PlatformActivityReport: 11,
};

export function parseBlockTransaction(
  tx: Record<string, unknown>,
  blockTimestamp: number,
  blockHeight: number,
  txIndex: number,
): ParsedTx {
  const rawType = tx.tx_type;
  const txType = typeof rawType === "string" ? (TX_TYPE_STRING_TO_NUM[rawType] ?? -1) : (rawType as number);
  const from = toHexAddress(tx.from);
  const payload = tx.payload as number[] | undefined;

  let to = "";
  let amount = "";

  if (payload && payload.length > 0) {
    if (txType === 1 && payload.length >= 48) {
      to = toHexAddress(payload.slice(0, 32));
      amount = readU128LE(payload, 32);
    } else if (txType === 3 && payload.length >= 80) {
      to = toHexAddress(payload.slice(32, 64));
      amount = readU128LE(payload, 64);
    } else if (txType === 4 && payload.length >= 32) {
      to = toHexAddress(payload.slice(0, 32));
    }
  }

  const hash = toHexAddress(tx.hash) || `${blockHeight}:${txIndex}`;

  return { hash, txType, from, to, amount, timestamp: blockTimestamp, blockHeight };
}

function readU128LE(bytes: number[], offset: number): string {
  let value = BigInt(0);
  for (let i = 0; i < 16; i++) {
    value |= BigInt(bytes[offset + i] ?? 0) << BigInt(i * 8);
  }
  return value.toString();
}

// --- Borsh decoding helpers ---

interface BorshReader {
  readonly data: number[];
  offset: number;
}

function borshReadU8(r: BorshReader): number {
  const val = r.data[r.offset] ?? 0;
  r.offset += 1;
  return val;
}

function borshReadU32LE(r: BorshReader): number {
  const b = r.data;
  const o = r.offset;
  const val = ((b[o] ?? 0) | ((b[o + 1] ?? 0) << 8) | ((b[o + 2] ?? 0) << 16) | ((b[o + 3] ?? 0) << 24)) >>> 0;
  r.offset += 4;
  return val;
}

function borshReadU128LE(r: BorshReader): string {
  const val = readU128LE(r.data, r.offset);
  r.offset += 16;
  return val;
}

function borshReadString(r: BorshReader): string {
  const len = borshReadU32LE(r);
  const bytes = r.data.slice(r.offset, r.offset + len);
  r.offset += len;
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** Borsh field order: name (String), symbol (String), decimals (u8), total_supply (u128) */
export interface TokenCreatePayload {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
}

export function parseTokenCreatePayload(payloadBytes: number[]): TokenCreatePayload {
  const r: BorshReader = { data: payloadBytes, offset: 0 };
  const name = borshReadString(r);
  const symbol = borshReadString(r);
  const decimals = borshReadU8(r);
  const initialSupply = borshReadU128LE(r);
  return { name, symbol, decimals, initialSupply };
}
