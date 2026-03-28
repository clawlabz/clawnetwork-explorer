import { blake3 as blake3Hash } from "@noble/hashes/blake3.js";
import { getRpcUrl, DEFAULT_NETWORK, type NetworkId } from "./config";

const isServer = typeof window === "undefined";

const COOKIE_NAME = "claw-network";

/** Read network from localStorage (client-side only) */
function getClientNetwork(): NetworkId {
  if (isServer) return DEFAULT_NETWORK;
  try {
    const stored = localStorage.getItem("claw-explorer-network");
    if (stored === "mainnet" || stored === "testnet") return stored;
  } catch { /* ignore */ }
  return DEFAULT_NETWORK;
}

/**
 * Read the selected network from the cookie on the server side.
 * Must be called from a Server Component or Route Handler context.
 */
export async function getServerNetwork(): Promise<NetworkId> {
  if (!isServer) return getClientNetwork();
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const value = cookieStore.get(COOKIE_NAME)?.value;
    if (value === "mainnet" || value === "testnet") return value;
  } catch { /* ignore - not in a request context */ }
  return DEFAULT_NETWORK;
}

async function rpc<T>(method: string, params: unknown[] = [], network?: NetworkId): Promise<T> {
  const resolvedNetwork = network ?? getClientNetwork();
  let url: string;

  if (isServer) {
    url = getRpcUrl(resolvedNetwork);
  } else {
    url = `/api/rpc?network=${resolvedNetwork}`;
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

export async function getBlockNumber(network?: NetworkId): Promise<number> {
  return rpc<number>("claw_blockNumber", [], network);
}

export async function getBlock(height: number, network?: NetworkId): Promise<Record<string, unknown> | null> {
  return rpc<Record<string, unknown> | null>("claw_getBlockByNumber", [height], network);
}

export async function getBalance(address: string, network?: NetworkId): Promise<string> {
  return rpc<string>("claw_getBalance", [address], network);
}

export async function getNonce(address: string, network?: NetworkId): Promise<number> {
  return rpc<number>("claw_getNonce", [address], network);
}

export async function getAgent(address: string, network?: NetworkId): Promise<Record<string, unknown> | null> {
  return rpc<Record<string, unknown> | null>("claw_getAgent", [address], network);
}

export async function getReputation(address: string, network?: NetworkId): Promise<unknown[]> {
  return rpc<unknown[]>("claw_getReputation", [address], network);
}

export async function getServices(type?: string, network?: NetworkId): Promise<unknown[]> {
  return rpc<unknown[]>("claw_getServices", type ? [type] : [], network);
}

export async function getRecentTransactions(limit: number = 50, network?: NetworkId): Promise<unknown[]> {
  return rpc<unknown[]>("claw_getRecentTransactions", [limit], network);
}

export async function getTokens(network?: NetworkId): Promise<unknown[]> {
  return rpc<unknown[]>("claw_getTokens", [], network);
}

export async function getTokenHolders(tokenId: string, network?: NetworkId): Promise<unknown[]> {
  try {
    return await rpc<unknown[]>("claw_getTokenHolders", [tokenId], network);
  } catch {
    return [];
  }
}

export async function getTransactionByHash(hash: string, network?: NetworkId): Promise<Record<string, unknown> | null> {
  return rpc<Record<string, unknown> | null>("claw_getTransactionByHash", [hash], network);
}

export async function getTransactionsByAddress(address: string, limit = 50, offset = 0, network?: NetworkId): Promise<unknown[]> {
  return rpc<unknown[]>("claw_getTransactionsByAddress", [address, limit, offset], network);
}

export async function getTokenInfo(tokenId: string, network?: NetworkId): Promise<Record<string, unknown> | null> {
  try {
    return await rpc<Record<string, unknown> | null>("claw_getTokenInfo", [tokenId], network);
  } catch {
    return null;
  }
}

export async function getContractInfo(address: string, network?: NetworkId): Promise<Record<string, unknown> | null> {
  return rpc<Record<string, unknown> | null>("claw_getContractInfo", [address], network);
}

export async function getContractCode(address: string, network?: NetworkId): Promise<Record<string, unknown> | null> {
  return rpc<Record<string, unknown> | null>("claw_getContractCode", [address], network);
}

export async function getContractStorage(address: string, key: string, network?: NetworkId): Promise<string | null> {
  return rpc<string | null>("claw_getContractStorage", [address, key], network);
}

export async function callContractView(address: string, method: string, args: string = "", network?: NetworkId): Promise<Record<string, unknown> | null> {
  return rpc<Record<string, unknown> | null>("claw_callContractView", [address, method, args], network);
}

export interface AgentScore {
  total: number;
  activity: number;
  uptime: number;
  block_production: number;
  economic: number;
  platform: number;
  decay_factor: number;
}

export async function getAgentScore(address: string, network?: NetworkId): Promise<AgentScore | null> {
  try {
    return await rpc<AgentScore | null>("claw_getAgentScore", [address], network);
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

export async function getValidators(network?: NetworkId): Promise<unknown[]> {
  return rpc<unknown[]>("claw_getValidators", [], network);
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

export async function getValidatorDetail(address: string, network?: NetworkId): Promise<ValidatorDetail | null> {
  try {
    return await rpc<ValidatorDetail>("claw_getValidatorDetail", [address], network);
  } catch {
    return null;
  }
}

export async function getMinerInfo(address: string, network?: NetworkId): Promise<Record<string, unknown> | null> {
  try {
    return await rpc<Record<string, unknown> | null>("claw_getMinerInfo", [address], network);
  } catch {
    return null;
  }
}

export async function getMiners(activeOnly = true, limit = 100, network?: NetworkId): Promise<unknown[]> {
  try {
    return await rpc<unknown[]>("claw_getMiners", [activeOnly, limit], network);
  } catch {
    return [];
  }
}

export async function getMiningStats(network?: NetworkId): Promise<Record<string, unknown> | null> {
  try {
    return await rpc<Record<string, unknown> | null>("claw_getMiningStats", [], network);
  } catch {
    return null;
  }
}

export async function getStakeDelegation(address: string, network?: NetworkId): Promise<string | null> {
  try {
    return await rpc<string | null>("claw_getStakeDelegation", [address], network);
  } catch {
    return null;
  }
}

export async function getHealth(network?: NetworkId): Promise<Record<string, unknown>> {
  const resolvedNetwork = network ?? getClientNetwork();

  if (isServer) {
    const rpcUrl = getRpcUrl(resolvedNetwork);
    const res = await fetch(`${rpcUrl}/health`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    return res.json();
  }

  const res = await fetch(`/api/health?network=${resolvedNetwork}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  return res.json();
}

export function formatCLAW(baseUnits: string): string {
  try {
    const n = BigInt(baseUnits);
    if (n === BigInt(0)) return "0";

    const DECIMALS = BigInt(1e9);
    const whole = n / DECIMALS;
    const frac = n % DECIMALS;

    // Full decimal string (9 digits, trailing zeros stripped)
    const fracStr = frac === BigInt(0)
      ? ""
      : frac.toString().padStart(9, "0").replace(/0+$/, "");

    // Build the raw number as a JS number for precision decisions
    const raw = Number(whole) + (fracStr ? Number(`0.${fracStr}`) : 0);

    // Add thousands separators to the whole part
    const wholeFormatted = whole.toLocaleString("en-US");

    if (raw >= 1000) {
      // 2 decimal places
      const trimmed = fracStr.slice(0, 2).padEnd(2, "0");
      if (trimmed === "00") return wholeFormatted;
      return `${wholeFormatted}.${trimmed}`;
    }

    if (raw >= 1) {
      // 4 decimal places
      const trimmed = fracStr.slice(0, 4).padEnd(4, "0").replace(/0+$/, "");
      if (!trimmed) return wholeFormatted;
      return `${wholeFormatted}.${trimmed}`;
    }

    // < 1: up to 6 significant decimal digits
    // e.g. "0.001234", "0.000001"
    const fullFrac = frac.toString().padStart(9, "0");
    // Find first non-zero digit position
    let significantCount = 0;
    let endIdx = 0;
    for (let i = 0; i < fullFrac.length; i++) {
      if (fullFrac[i] !== "0") significantCount++;
      if (significantCount > 0) endIdx = i + 1;
      if (significantCount >= 6) break;
    }
    const trimmedFrac = fullFrac.slice(0, endIdx);
    return `0.${trimmedFrac}`;
  } catch {
    return "0";
  }
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

export const TX_TYPE_NAMES: Record<number, string> = {
  0: "AgentRegister",
  1: "Transfer",
  2: "TokenCreate",
  3: "TokenMintTransfer",
  4: "ReputationAttest",
  5: "ServiceRegister",
  6: "ContractDeploy",
  7: "ContractCall",
  8: "StakeDeposit",
  9: "StakeWithdraw",
  10: "StakeClaim",
  11: "PlatformActivityReport",
  12: "TokenApprove",
  13: "TokenBurn",
  14: "ChangeDelegation",
  15: "MinerRegister",
  16: "MinerHeartbeat",
  17: "ContractUpgradeAnnounce",
  18: "ContractUpgradeExecute",
};

const TX_TYPE_STRING_TO_NUM: Record<string, number> = {
  AgentRegister: 0,
  TokenTransfer: 1,
  TokenCreate: 2,
  TokenMintTransfer: 3,
  ReputationAttest: 4,
  ServiceRegister: 5,
  ContractDeploy: 6,
  ContractCall: 7,
  StakeDeposit: 8,
  StakeWithdraw: 9,
  StakeClaim: 10,
  PlatformActivityReport: 11,
  TokenApprove: 12,
  TokenBurn: 13,
  ChangeDelegation: 14,
  MinerRegister: 15,
  MinerHeartbeat: 16,
  ContractUpgradeAnnounce: 17,
  ContractUpgradeExecute: 18,
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

/**
 * Compute the on-chain token ID: blake3(sender_bytes || name_utf8 || nonce_le_u64).
 * Matches the Rust derivation in claw-node state/handlers.rs.
 */
export function computeTokenId(senderHex: string, name: string, nonce: number): string {
  const sender = hexToBytes(senderHex);
  const nameBytes = new TextEncoder().encode(name);
  // nonce as u64 little-endian (8 bytes)
  const nonceBuf = new Uint8Array(8);
  const view = new DataView(nonceBuf.buffer);
  view.setBigUint64(0, BigInt(nonce), true);

  const input = new Uint8Array(sender.length + nameBytes.length + 8);
  input.set(sender, 0);
  input.set(nameBytes, sender.length);
  input.set(nonceBuf, sender.length + nameBytes.length);

  const digest = blake3Hash(input);
  return bytesToHex(digest);
}

/** Convert hex string to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Convert Uint8Array to hex string */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Transaction receipt from claw_getTransactionReceipt */
export interface TransactionReceipt {
  blockHeight: number;
  transactionIndex: number;
  success?: boolean;
  fuelConsumed?: number;
  fuelLimit?: number;
  returnData?: string;
  errorMessage?: string | null;
  events?: { topic: string; data: string }[];
  logs?: string[];
}

export async function getTransactionReceipt(hash: string, network?: NetworkId): Promise<TransactionReceipt | null> {
  try {
    return await rpc<TransactionReceipt | null>("claw_getTransactionReceipt", [hash], network);
  } catch {
    return null;
  }
}
