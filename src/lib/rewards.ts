/**
 * ClawNetwork reward calculation utilities.
 * Mirrors the Rust logic in claw-node/crates/state/src/rewards.rs exactly.
 */

/** 3-second block time: 365.25 * 86400 / 3 */
export const BLOCKS_PER_YEAR = 10_512_000;

export const BLOCKS_PER_DAY = 28_800;
export const BLOCKS_PER_HOUR = 1_200;

/** Block height at which the mining upgrade activates */
export const MINING_UPGRADE_HEIGHT = 2_000;

/** Halving period: 2 years of blocks */
export const HALVING_PERIOD = 2 * BLOCKS_PER_YEAR; // 21_024_000

/** 65% of block reward goes to validators after upgrade */
export const VALIDATOR_REWARD_BPS = 6_500;

/** 35% of block reward goes to miners after upgrade */
export const MINING_REWARD_BPS = 3_500;

/** Reputation bps thresholds (mirroring state.rs constants) */
export const REPUTATION_NEWCOMER_BPS = 2_000;    // 0-7 days
export const REPUTATION_ESTABLISHED_BPS = 5_000;  // 7-30 days
export const REPUTATION_VETERAN_BPS = 10_000;     // 30+ days

export const BLOCKS_7_DAYS = 201_600;
export const BLOCKS_30_DAYS = 864_000;

/** CLAW has 9 decimal places; 1 CLAW = 1_000_000_000 base units */
export const CLAW_DECIMALS = 1_000_000_000n;

export type RewardPeriod = {
  period: number;
  label: string;
  clawPerBlock: number;
  startYear: number;
  endYear: number | null;
};

/** All reward schedule periods for display in the UI */
export const REWARD_SCHEDULE: RewardPeriod[] = [
  // New geometric halving schedule (post-upgrade, which activates almost immediately at block 2000)
  { period: 0, label: "Period 0",  clawPerBlock: 8,    startYear: 0,  endYear: 2   },
  { period: 1, label: "Period 1",  clawPerBlock: 4,    startYear: 2,  endYear: 4   },
  { period: 2, label: "Period 2",  clawPerBlock: 2,    startYear: 4,  endYear: 6   },
  { period: 3, label: "Period 3",  clawPerBlock: 1,    startYear: 6,  endYear: 8   },
  { period: 4, label: "Period 4",  clawPerBlock: 0.5,  startYear: 8,  endYear: 10  },
  { period: 5, label: "Period 5+", clawPerBlock: 0.25, startYear: 10, endYear: null },
];

/**
 * Calculate block reward in base units (9 decimals) for a given block height.
 * Mirrors reward_per_block() in Rust.
 */
export function rewardPerBlock(height: number): bigint {
  if (height < MINING_UPGRADE_HEIGHT) {
    // Legacy step schedule
    const year = Math.floor(height / BLOCKS_PER_YEAR);
    if (year === 0) return 10_000_000_000n;
    if (year === 1) return 8_000_000_000n;
    if (year === 2) return 6_000_000_000n;
    if (year === 3) return 4_000_000_000n;
    if (year <= 9)  return 2_000_000_000n;
    return 1_000_000_000n;
  }
  // Geometric halving from upgrade point
  const adjusted = height - MINING_UPGRADE_HEIGHT;
  const period = Math.floor(adjusted / HALVING_PERIOD);
  if (period === 0) return 8_000_000_000n;
  if (period === 1) return 4_000_000_000n;
  if (period === 2) return 2_000_000_000n;
  if (period === 3) return 1_000_000_000n;
  if (period === 4) return 500_000_000n;
  return 250_000_000n;
}

/** Get the current reward period number (0-5) for a given height */
export function getCurrentPeriod(height: number): number {
  if (height < MINING_UPGRADE_HEIGHT) return -1; // legacy
  const adjusted = height - MINING_UPGRADE_HEIGHT;
  return Math.min(5, Math.floor(adjusted / HALVING_PERIOD));
}

/** Mining pool portion of block reward (base units) */
export function miningPoolPerBlock(height: number): bigint {
  if (height < MINING_UPGRADE_HEIGHT) return 0n;
  return rewardPerBlock(height) * BigInt(MINING_REWARD_BPS) / 10_000n;
}

/** Validator pool portion of block reward (base units) */
export function validatorPoolPerBlock(height: number): bigint {
  const base = rewardPerBlock(height);
  if (height < MINING_UPGRADE_HEIGHT) return base;
  return base * BigInt(VALIDATOR_REWARD_BPS) / 10_000n;
}

export type ReputationTier = "newcomer" | "established" | "veteran";

/** Derive reputation tier from how long a miner has been registered */
export function reputationTierFromAge(registeredAt: number, currentHeight: number): ReputationTier {
  const age = currentHeight - registeredAt;
  if (age < BLOCKS_7_DAYS) return "newcomer";
  if (age < BLOCKS_30_DAYS) return "established";
  return "veteran";
}

/** Get reputation bps from tier name */
export function reputationBpsFromTier(tier: ReputationTier): number {
  if (tier === "newcomer") return REPUTATION_NEWCOMER_BPS;
  if (tier === "established") return REPUTATION_ESTABLISHED_BPS;
  return REPUTATION_VETERAN_BPS;
}

export interface MinerRewardParams {
  height: number;
  myReputationBps: number;
  totalActiveMiners: number;
  /** Approximate total weight of all miners. If not provided, assumes all others are Veterans */
  otherMinersReputationBps?: number;
}

export interface RewardEstimate {
  perBlock: bigint;
  perHour: bigint;
  perDay: bigint;
  perMonth: bigint;
  perYear: bigint;
  sharePercent: number;
  poolPerBlock: bigint;
}

/**
 * Calculate a miner's expected reward share.
 *
 * @param height - current block height
 * @param myReputationBps - this miner's reputation (0-10000)
 * @param totalWeight - sum of all active miners' reputation_bps (including this one)
 */
export function calcMinerReward(
  height: number,
  myReputationBps: number,
  totalWeight: number,
): RewardEstimate {
  const pool = miningPoolPerBlock(height);

  if (totalWeight === 0 || pool === 0n) {
    return { perBlock: 0n, perHour: 0n, perDay: 0n, perMonth: 0n, perYear: 0n, sharePercent: 0, poolPerBlock: pool };
  }

  // share = pool * myWeight / totalWeight
  const perBlock = pool * BigInt(myReputationBps) / BigInt(totalWeight);
  const sharePercent = (myReputationBps / totalWeight) * 100;

  return {
    perBlock,
    perHour: perBlock * BigInt(BLOCKS_PER_HOUR),
    perDay: perBlock * BigInt(BLOCKS_PER_DAY),
    perMonth: perBlock * BigInt(BLOCKS_PER_DAY) * 30n,
    perYear: perBlock * BigInt(BLOCKS_PER_YEAR),
    sharePercent,
    poolPerBlock: pool,
  };
}

/**
 * Build a simple scenario: N miners, all with the same reputation bps except mine.
 * Useful for the "what if" calculator.
 */
export function calcMinerRewardSimple(params: {
  height: number;
  myReputationBps: number;
  totalMiners: number;
  othersReputationBps: number;
}): RewardEstimate {
  const { height, myReputationBps, totalMiners, othersReputationBps } = params;
  if (totalMiners <= 0) {
    return { perBlock: 0n, perHour: 0n, perDay: 0n, perMonth: 0n, perYear: 0n, sharePercent: 0, poolPerBlock: 0n };
  }
  const others = Math.max(0, totalMiners - 1);
  const totalWeight = myReputationBps + others * othersReputationBps;
  return calcMinerReward(height, myReputationBps, totalWeight);
}

/** Format base units to a human-readable CLAW string (e.g. "2.8", "80,640") */
export function formatClawAmount(baseUnits: bigint, decimals = 2): string {
  if (baseUnits === 0n) return "0";
  const whole = baseUnits / CLAW_DECIMALS;
  const frac = baseUnits % CLAW_DECIMALS;

  const fracStr = frac === 0n ? "" : frac.toString().padStart(9, "0").replace(/0+$/, "").slice(0, decimals);

  const wholeFormatted = whole.toLocaleString("en-US");
  if (!fracStr || fracStr === "0".repeat(fracStr.length)) return wholeFormatted;
  return `${wholeFormatted}.${fracStr}`;
}

/** Format as compact string with K/M suffix */
export function formatClawCompact(baseUnits: bigint): string {
  const whole = Number(baseUnits / CLAW_DECIMALS);
  if (whole >= 1_000_000) return `${(whole / 1_000_000).toFixed(2)}M`;
  if (whole >= 1_000) return `${(whole / 1_000).toFixed(1)}K`;
  const full = formatClawAmount(baseUnits, 4);
  return full;
}
