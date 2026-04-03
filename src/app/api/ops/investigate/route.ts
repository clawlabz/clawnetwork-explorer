import { NextRequest, NextResponse } from "next/server";
import { getRpcUrl } from "@/lib/config";
import type { NetworkId } from "@/lib/config";

const OPS_SECRET = process.env.EXPLORER_OPS_SECRET || "528ludis...";

async function rpcCall<T>(method: string, params: unknown[], network: NetworkId): Promise<T> {
  const url = getRpcUrl(network);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

function toHex(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((b: number) => b.toString(16).padStart(2, "0")).join("");
  }
  return "";
}

function formatClaw(baseUnits: string): string {
  const n = BigInt(baseUnits);
  const whole = n / BigInt(1e9);
  const frac = n % BigInt(1e9);
  const fracStr = frac === BigInt(0) ? "" : "." + frac.toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${fracStr}`;
}

interface TxRecord {
  hash: string;
  txType: string;
  from: string;
  to: string | null;
  amount: string | null;
  blockHeight: number;
  timestamp: number;
  nonce: number;
}

interface BlockRewardEntry {
  blockHeight: number;
  timestamp: number;
  amount: string;
  rewardType: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, secret, network: rawNetwork } = body;

    if (secret !== OPS_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!address || typeof address !== "string" || !/^[0-9a-fA-F]{64}$/.test(address)) {
      return NextResponse.json({ error: "Invalid address (expected 64-char hex)" }, { status: 400 });
    }

    const network: NetworkId = rawNetwork === "testnet" ? "testnet" : "mainnet";
    const addr = address.toLowerCase();

    // Fetch all data in parallel
    const [
      balance,
      nonce,
      agent,
      stake,
      delegation,
      minerInfo,
      validatorDetail,
      transactions,
      tokens,
      blockNumber,
    ] = await Promise.all([
      rpcCall<string>("claw_getBalance", [addr], network),
      rpcCall<number>("claw_getNonce", [addr], network),
      rpcCall<Record<string, unknown> | null>("claw_getAgent", [addr], network).catch(() => null),
      rpcCall<string>("claw_getStake", [addr], network).catch(() => "0"),
      rpcCall<string | null>("claw_getStakeDelegation", [addr], network).catch(() => null),
      rpcCall<Record<string, unknown> | null>("claw_getMinerInfo", [addr], network).catch(() => null),
      rpcCall<Record<string, unknown> | null>("claw_getValidatorDetail", [addr], network).catch(() => null),
      rpcCall<Record<string, unknown>[]>("claw_getTransactionsByAddress", [addr, 200, 0], network).catch(() => []),
      rpcCall<Record<string, unknown>[]>("claw_getTokens", [], network).catch(() => []),
      rpcCall<number>("claw_blockNumber", [], network),
    ]);

    // Format agent info
    const agentInfo = agent ? {
      name: agent.name ? String(agent.name) : null,
      address: toHex(agent.address),
      registeredAt: agent.registered_at ? Number(agent.registered_at) : null,
      metadata: agent.metadata || {},
    } : null;

    // Format miner info
    const minerData = minerInfo ? {
      name: minerInfo.name ? String(minerInfo.name) : null,
      active: Boolean(minerInfo.active),
      tier: minerInfo.tier ? String(minerInfo.tier) : null,
      registeredAt: minerInfo.registered_at ? Number(minerInfo.registered_at) : null,
      lastHeartbeat: minerInfo.last_heartbeat ? Number(minerInfo.last_heartbeat) : null,
      reputationBps: minerInfo.reputation_bps ? Number(minerInfo.reputation_bps) : null,
      ipPrefix: Array.isArray(minerInfo.ip_prefix) ? (minerInfo.ip_prefix as number[]).join(".") : null,
    } : null;

    // Format validator info
    const validatorData = validatorDetail ? {
      stake: formatClaw(String(validatorDetail.stake || "0")),
      stakeRaw: String(validatorDetail.stake || "0"),
      weight: Number(validatorDetail.weight || 0),
      commissionBps: Number(validatorDetail.commission_bps || 0),
      delegatedBy: validatorDetail.delegatedBy ? String(validatorDetail.delegatedBy) : null,
      jailed: Boolean(validatorDetail.jailed),
      uptime: validatorDetail.uptime as Record<string, unknown> | undefined,
    } : null;

    // Format transactions
    const formattedTxs: TxRecord[] = transactions.map((tx: Record<string, unknown>) => ({
      hash: String(tx.hash || ""),
      txType: String(tx.txType || tx.transaction_type || "unknown"),
      from: String(tx.from || ""),
      to: tx.to ? String(tx.to) : null,
      amount: tx.amount ? formatClaw(String(tx.amount)) : null,
      amountRaw: tx.amount ? String(tx.amount) : null,
      blockHeight: Number(tx.blockHeight || tx.block_number || 0),
      timestamp: Number(tx.timestamp || 0),
      nonce: Number(tx.nonce || 0),
    }));

    // Find tokens created by this address
    const createdTokens = (tokens as Record<string, unknown>[])
      .filter(t => {
        const creator = String(t.creator || "").toLowerCase();
        return creator === addr;
      })
      .map(t => ({
        name: String(t.name || ""),
        symbol: String(t.symbol || ""),
        decimals: Number(t.decimals || 0),
        totalSupply: String(t.total_supply || "0"),
        tokenId: String(t.token_id || ""),
      }));

    // Estimate reward income from block samples
    // Sample a few blocks to estimate per-block reward
    const rewardSamples: BlockRewardEntry[] = [];
    const addrBytes = [];
    for (let i = 0; i < addr.length; i += 2) {
      addrBytes.push(parseInt(addr.slice(i, i + 2), 16));
    }
    const addrPrefix = addrBytes.slice(0, 8);

    // Sample blocks where this address was likely active
    const firstActivity = minerData?.registeredAt || agentInfo?.registeredAt || 0;
    const lastActivity = minerData?.lastHeartbeat || blockNumber;

    if (firstActivity > 0) {
      const sampleBlocks = [
        firstActivity + 10,
        Math.floor((firstActivity + lastActivity) / 2),
        lastActivity - 10,
      ].filter(b => b > 0 && b <= blockNumber);

      for (const blockNum of sampleBlocks) {
        try {
          const block = await rpcCall<Record<string, unknown>>("claw_getBlockByNumber", [blockNum, true], network);
          const events = (block?.events || []) as Record<string, unknown>[];
          for (const event of events) {
            const rd = event.RewardDistributed as Record<string, unknown> | undefined;
            if (!rd) continue;
            const recipient = rd.recipient as number[] | undefined;
            if (!recipient) continue;
            const matches = addrPrefix.every((b, i) => recipient[i] === b);
            if (matches) {
              rewardSamples.push({
                blockHeight: blockNum,
                timestamp: Number(block?.timestamp || 0),
                amount: formatClaw(String(rd.amount || "0")),
                rewardType: String(rd.reward_type || "unknown"),
              });
            }
          }
        } catch {
          // skip failed blocks
        }
      }
    }

    // Calculate totals
    const activeBlocks = lastActivity - firstActivity;
    const avgRewardPerBlock = rewardSamples.length > 0
      ? rewardSamples.reduce((sum, s) => sum + Number(s.amount.replace(/,/g, "")), 0) / rewardSamples.length
      : 0;
    const estimatedTotalRewards = avgRewardPerBlock * activeBlocks;

    // Determine first seen timestamp
    const sortedTxs = [...formattedTxs].sort((a, b) => a.blockHeight - b.blockHeight);
    const firstTx = sortedTxs[0];
    const lastTx = sortedTxs[sortedTxs.length - 1];

    const result = {
      address: addr,
      network,
      currentBlockHeight: blockNumber,
      balance: formatClaw(balance),
      balanceRaw: balance,
      nonce,
      stake: formatClaw(stake),
      stakeRaw: stake,
      delegation,
      agent: agentInfo,
      miner: minerData,
      validator: validatorData,
      transactions: formattedTxs,
      transactionCount: formattedTxs.length,
      createdTokens,
      rewardSamples,
      estimates: {
        firstActivityBlock: firstActivity,
        lastActivityBlock: lastActivity,
        activeBlocks,
        avgRewardPerBlock: avgRewardPerBlock.toFixed(4),
        estimatedTotalRewards: estimatedTotalRewards.toFixed(2),
      },
      timeline: {
        firstSeen: firstTx ? { block: firstTx.blockHeight, timestamp: firstTx.timestamp, type: firstTx.txType } : null,
        lastSeen: lastTx ? { block: lastTx.blockHeight, timestamp: lastTx.timestamp, type: lastTx.txType } : null,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
