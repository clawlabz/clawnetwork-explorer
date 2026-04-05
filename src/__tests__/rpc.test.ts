import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TX_TYPE_NAMES,
  parseBlockTransaction,
  toHexAddress,
  formatCLAW,
  truncateAddress,
  parseTokenCreatePayload,
  computeTokenId,
  parsePlatformActivityReportPayload,
  getSupplyInfo,
  getTransactionCount,
  getTokens,
  getTransactionByHash,
  getTransactionReceipt,
  getBlockNumber,
  getBlock,
} from '../lib/rpc';

describe('TX_TYPE_NAMES Mapping', () => {
  it('should have entries for all 19 transaction types (0-18)', () => {
    const expectedCount = 19;
    const actualCount = Object.keys(TX_TYPE_NAMES).length;
    expect(actualCount).toBe(expectedCount);
  });

  it('should have no gaps in the mapping (0-18 continuous)', () => {
    for (let i = 0; i < 19; i++) {
      expect(TX_TYPE_NAMES[i]).toBeDefined();
      expect(typeof TX_TYPE_NAMES[i]).toBe('string');
    }
  });

  it('should map correct type names', () => {
    expect(TX_TYPE_NAMES[0]).toBe('AgentRegister');
    expect(TX_TYPE_NAMES[1]).toBe('Transfer');
    expect(TX_TYPE_NAMES[2]).toBe('TokenCreate');
    expect(TX_TYPE_NAMES[3]).toBe('TokenMintTransfer');
    expect(TX_TYPE_NAMES[4]).toBe('ReputationAttest');
    expect(TX_TYPE_NAMES[5]).toBe('ServiceRegister');
    expect(TX_TYPE_NAMES[6]).toBe('ContractDeploy');
    expect(TX_TYPE_NAMES[7]).toBe('ContractCall');
    expect(TX_TYPE_NAMES[8]).toBe('StakeDeposit');
    expect(TX_TYPE_NAMES[9]).toBe('StakeWithdraw');
    expect(TX_TYPE_NAMES[10]).toBe('StakeClaim');
    expect(TX_TYPE_NAMES[11]).toBe('PlatformActivityReport');
    expect(TX_TYPE_NAMES[12]).toBe('TokenApprove');
    expect(TX_TYPE_NAMES[13]).toBe('TokenBurn');
    expect(TX_TYPE_NAMES[14]).toBe('ChangeDelegation');
    expect(TX_TYPE_NAMES[15]).toBe('MinerRegister');
    expect(TX_TYPE_NAMES[16]).toBe('MinerHeartbeat');
    expect(TX_TYPE_NAMES[17]).toBe('ContractUpgradeAnnounce');
    expect(TX_TYPE_NAMES[18]).toBe('ContractUpgradeExecute');
  });

  it('should have no duplicate names', () => {
    const names = Object.values(TX_TYPE_NAMES);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});

describe('parseBlockTransaction', () => {
  it('should parse Transfer transaction (type 1) with 48-byte payload', () => {
    // Create a mock 48-byte payload: to[32] + amount[16]
    const toAddress = Array.from({ length: 32 }, (_, i) => i + 1);
    const amount = Array.from({ length: 16 }, (_, i) => i);
    const payload = [...toAddress, ...amount];

    const tx = {
      tx_type: 'TokenTransfer',
      from: Array.from({ length: 32 }, () => 255),
      payload,
      hash: Array.from({ length: 32 }, () => 42),
    };

    const parsed = parseBlockTransaction(tx, 1000, 100, 0);

    expect(parsed.txType).toBe(1);
    expect(parsed.from).toBeTruthy();
    expect(parsed.to).toBeTruthy();
    expect(parsed.amount).toBeTruthy();
    expect(parsed.timestamp).toBe(1000);
    expect(parsed.blockHeight).toBe(100);
  });

  it('should parse StakeWithdraw transaction (type 9) with 48-byte payload', () => {
    // StakeWithdraw: amount[16] + validator[32]
    const amount = Array.from({ length: 16 }, (_, i) => i);
    const validator = Array.from({ length: 32 }, (_, i) => i + 1);
    const payload = [...amount, ...validator];

    const tx = {
      tx_type: 'StakeWithdraw',
      from: Array.from({ length: 32 }, () => 200),
      payload,
      hash: Array.from({ length: 32 }, () => 50),
    };

    const parsed = parseBlockTransaction(tx, 2000, 200, 5);

    expect(parsed.txType).toBe(9);
    expect(parsed.amount).toBeTruthy();
    expect(parsed.to).toBeTruthy();
    expect(parsed.timestamp).toBe(2000);
    expect(parsed.blockHeight).toBe(200);
  });

  it('should parse StakeDeposit transaction (type 8) with 50-byte payload', () => {
    // StakeDeposit: amount[16] + validator[32] + commission_bps[2]
    const amount = Array.from({ length: 16 }, (_, i) => i);
    const validator = Array.from({ length: 32 }, (_, i) => i + 1);
    const commissionBps = [0, 1];
    const payload = [...amount, ...validator, ...commissionBps];

    const tx = {
      tx_type: 'StakeDeposit',
      from: Array.from({ length: 32 }, () => 150),
      payload,
      hash: Array.from({ length: 32 }, () => 60),
    };

    const parsed = parseBlockTransaction(tx, 3000, 300, 10);

    expect(parsed.txType).toBe(8);
    expect(parsed.amount).toBeTruthy();
    expect(parsed.to).toBeTruthy();
    expect(parsed.timestamp).toBe(3000);
    expect(parsed.blockHeight).toBe(300);
  });

  it('should parse ReputationAttest transaction (type 4) with 32-byte payload', () => {
    // ReputationAttest: to[32]
    const to = Array.from({ length: 32 }, (_, i) => i + 10);
    const payload = to;

    const tx = {
      tx_type: 'ReputationAttest',
      from: Array.from({ length: 32 }, () => 100),
      payload,
      hash: Array.from({ length: 32 }, () => 70),
    };

    const parsed = parseBlockTransaction(tx, 4000, 400, 15);

    expect(parsed.txType).toBe(4);
    expect(parsed.to).toBeTruthy();
    expect(parsed.timestamp).toBe(4000);
    expect(parsed.blockHeight).toBe(400);
  });

  it('should parse TokenMintTransfer transaction (type 3) with 80-byte payload', () => {
    // TokenMintTransfer: token_id[32] + to[32] + amount[16]
    const tokenId = Array.from({ length: 32 }, (_, i) => i);
    const to = Array.from({ length: 32 }, (_, i) => i + 32);
    const amount = Array.from({ length: 16 }, (_, i) => i);
    const payload = [...tokenId, ...to, ...amount];

    const tx = {
      tx_type: 'TokenMintTransfer',
      from: Array.from({ length: 32 }, () => 50),
      payload,
      hash: Array.from({ length: 32 }, () => 80),
    };

    const parsed = parseBlockTransaction(tx, 5000, 500, 20);

    expect(parsed.txType).toBe(3);
    expect(parsed.to).toBeTruthy();
    expect(parsed.amount).toBeTruthy();
    expect(parsed.timestamp).toBe(5000);
    expect(parsed.blockHeight).toBe(500);
  });

  it('should parse ChangeDelegation transaction (type 14) with 66-byte payload', () => {
    // ChangeDelegation: validator[32] + new_owner[32] + commission_bps[2]
    const validator = Array.from({ length: 32 }, (_, i) => i);
    const newOwner = Array.from({ length: 32 }, (_, i) => i + 32);
    const commissionBps = [0, 1];
    const payload = [...validator, ...newOwner, ...commissionBps];

    const tx = {
      tx_type: 'ChangeDelegation',
      from: Array.from({ length: 32 }, () => 75),
      payload,
      hash: Array.from({ length: 32 }, () => 90),
    };

    const parsed = parseBlockTransaction(tx, 6000, 600, 25);

    expect(parsed.txType).toBe(14);
    expect(parsed.to).toBeTruthy();
    expect(parsed.timestamp).toBe(6000);
    expect(parsed.blockHeight).toBe(600);
  });

  it('should handle tx_type as number instead of string', () => {
    const payload = Array.from({ length: 48 }, (_, i) => i);

    const tx = {
      tx_type: 1,
      from: Array.from({ length: 32 }, () => 100),
      payload,
      hash: Array.from({ length: 32 }, () => 99),
    };

    const parsed = parseBlockTransaction(tx, 7000, 700, 30);

    expect(parsed.txType).toBe(1);
  });

  it('should handle empty payload', () => {
    const tx = {
      tx_type: 0,
      from: Array.from({ length: 32 }, () => 111),
      payload: [],
      hash: Array.from({ length: 32 }, () => 111),
    };

    const parsed = parseBlockTransaction(tx, 8000, 800, 35);

    expect(parsed.txType).toBe(0);
    expect(parsed.to).toBe('');
    expect(parsed.amount).toBe('');
  });

  it('should use hash from tx if provided, otherwise use blockHeight:txIndex', () => {
    const tx1 = {
      tx_type: 0,
      from: Array.from({ length: 32 }, () => 122),
      payload: [],
      hash: Array.from({ length: 32 }, () => 222),
    };

    const parsed1 = parseBlockTransaction(tx1, 1000, 100, 5);
    expect(parsed1.hash).toBeTruthy();

    const tx2 = {
      tx_type: 0,
      from: Array.from({ length: 32 }, () => 133),
      payload: [],
      hash: Array.from({ length: 32 }, () => 0),
    };

    const parsed2 = parseBlockTransaction(tx2, 2000, 200, 10);
    expect(parsed2.hash).toBe('200:10');
  });
});

describe('toHexAddress', () => {
  it('should convert string address unchanged', () => {
    const address = '0x1234567890abcdef';
    expect(toHexAddress(address)).toBe(address);
  });

  it('should convert byte array to hex string', () => {
    const bytes = [0x12, 0x34, 0x56, 0x78];
    expect(toHexAddress(bytes)).toBe('12345678');
  });

  it('should return empty string for all-zero bytes', () => {
    const bytes = Array.from({ length: 32 }, () => 0);
    expect(toHexAddress(bytes)).toBe('');
  });

  it('should return empty string for non-string, non-array input', () => {
    expect(toHexAddress(null)).toBe('');
    expect(toHexAddress(123)).toBe('');
    expect(toHexAddress({})).toBe('');
  });

  it('should pad single-digit bytes with leading zero', () => {
    const bytes = [0x01, 0x02, 0x03];
    expect(toHexAddress(bytes)).toBe('010203');
  });
});

describe('formatCLAW', () => {
  it('should format zero', () => {
    expect(formatCLAW('0')).toBe('0');
  });

  it('should format whole CLAW values with thousands separators', () => {
    // 1 CLAW = 1_000_000_000 base units
    expect(formatCLAW('1000000000')).toBe('1');
    expect(formatCLAW('2000000000')).toBe('2');
    expect(formatCLAW('1000000000000')).toBe('1,000');
  });

  it('should format fractional CLAW values (4 decimal places for 1-999 CLAW)', () => {
    // 1.5 CLAW = 1_500_000_000 base units
    const result = formatCLAW('1500000000');
    expect(result).toContain('1.5');
  });

  it('should format very small amounts (up to 6 significant decimals)', () => {
    // 0.001 CLAW = 1_000_000 base units
    const result = formatCLAW('1000000');
    expect(result).toMatch(/^0\./);
  });

  it('should handle large values with 2 decimal places', () => {
    // 1_000_000 CLAW
    const result = formatCLAW('1000000000000000000');
    expect(result).toContain('1,000,000');
  });

  it('should handle invalid input gracefully', () => {
    expect(formatCLAW('invalid')).toBe('0');
    expect(formatCLAW('')).toBe('0');
  });
});

describe('truncateAddress', () => {
  it('should not truncate short addresses', () => {
    const short = '0x1234';
    expect(truncateAddress(short)).toBe(short);
  });

  it('should truncate long addresses to default 6 chars from start and end', () => {
    const long = '0x' + 'a'.repeat(100);
    const result = truncateAddress(long);
    // Default chars=6, so it returns first 6 chars + ... + last 6 chars
    expect(result).toBe('0xaaaa...aaaaaa');
  });

  it('should truncate long addresses to custom char count', () => {
    const long = '0x' + 'a'.repeat(100);
    const result = truncateAddress(long, 4);
    // With chars=4, it returns first 4 chars + ... + last 4 chars
    expect(result).toBe('0xaa...aaaa');
  });

  it('should handle addresses exactly at truncation threshold', () => {
    // At exactly chars * 2 + 2 length, should not truncate
    const addr = '0x' + 'b'.repeat(12); // 2 + 12 = 14 = 6*2 + 2
    expect(truncateAddress(addr)).toBe(addr);
  });
});

describe('parseTokenCreatePayload', () => {
  it('should parse token create payload correctly', () => {
    // Borsh format: name_len(u32) + name + symbol_len(u32) + symbol + decimals(u8) + supply(u128)
    const payload = [
      // "Test" name
      4, 0, 0, 0, // len=4 (little-endian)
      84, 101, 115, 116, // "Test"
      // "TST" symbol
      3, 0, 0, 0, // len=3 (little-endian)
      84, 83, 84, // "TST"
      // decimals
      18,
      // initial supply (1000 in u128 little-endian)
      232, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];

    const result = parseTokenCreatePayload(payload);

    expect(result.name).toBe('Test');
    expect(result.symbol).toBe('TST');
    expect(result.decimals).toBe(18);
    expect(result.initialSupply).toBe('1000');
  });

  it('should handle empty strings in payload', () => {
    const payload = [
      // empty name
      0, 0, 0, 0,
      // empty symbol
      0, 0, 0, 0,
      // decimals
      8,
      // initial supply (0)
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];

    const result = parseTokenCreatePayload(payload);

    expect(result.name).toBe('');
    expect(result.symbol).toBe('');
    expect(result.decimals).toBe(8);
    expect(result.initialSupply).toBe('0');
  });
});

describe('computeTokenId', () => {
  it('should compute token ID from sender, name, and nonce', () => {
    const senderHex = 'a'.repeat(64);
    const name = 'TestToken';
    const nonce = 1;

    const tokenId = computeTokenId(senderHex, name, nonce);

    expect(typeof tokenId).toBe('string');
    expect(tokenId.length).toBe(64); // blake3 digest is 32 bytes = 64 hex chars
  });

  it('should generate different token IDs for different nonces', () => {
    const senderHex = 'b'.repeat(64);
    const name = 'Token';

    const id1 = computeTokenId(senderHex, name, 1);
    const id2 = computeTokenId(senderHex, name, 2);

    expect(id1).not.toBe(id2);
  });

  it('should generate different token IDs for different names', () => {
    const senderHex = 'c'.repeat(64);
    const nonce = 1;

    const id1 = computeTokenId(senderHex, 'Token1', nonce);
    const id2 = computeTokenId(senderHex, 'Token2', nonce);

    expect(id1).not.toBe(id2);
  });

  it('should generate different token IDs for different senders', () => {
    const name = 'Token';
    const nonce = 1;

    const id1 = computeTokenId('d'.repeat(64), name, nonce);
    const id2 = computeTokenId('e'.repeat(64), name, nonce);

    expect(id1).not.toBe(id2);
  });

  it('should handle sender hex with 0x prefix', () => {
    const senderHexWithPrefix = '0x' + 'f'.repeat(64);
    const senderHexWithoutPrefix = 'f'.repeat(64);
    const name = 'Token';
    const nonce = 1;

    const id1 = computeTokenId(senderHexWithPrefix, name, nonce);
    const id2 = computeTokenId(senderHexWithoutPrefix, name, nonce);

    expect(id1).toBe(id2);
  });
});

describe('parsePlatformActivityReportPayload', () => {
  it('should parse platform activity report payload', () => {
    // Build a valid Borsh-encoded payload
    const payload: number[] = [];

    // platform (String)
    const platform = 'ClawArena';
    payload.push(platform.length, 0, 0, 0); // u32 length little-endian
    for (const char of platform) {
      payload.push(char.charCodeAt(0));
    }

    // entryCount (u32)
    payload.push(1, 0, 0, 0); // 1 entry

    // First entry: agent_address[32] + action_count(u32) + action_type(String)
    for (let i = 0; i < 32; i++) {
      payload.push(i);
    }
    payload.push(42, 0, 0, 0); // action_count = 42

    const actionType = 'trade';
    payload.push(actionType.length, 0, 0, 0);
    for (const char of actionType) {
      payload.push(char.charCodeAt(0));
    }

    const result = parsePlatformActivityReportPayload(payload);

    expect(result.platform).toBe('ClawArena');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].action_count).toBe(42);
    expect(result.entries[0].action_type).toBe('trade');
  });

  it('should handle multiple entries', () => {
    const payload: number[] = [];

    // platform
    const platform = 'TestPlatform';
    payload.push(platform.length, 0, 0, 0);
    for (const char of platform) {
      payload.push(char.charCodeAt(0));
    }

    // entryCount (2)
    payload.push(2, 0, 0, 0);

    // First entry
    for (let i = 0; i < 32; i++) {
      payload.push(i % 256);
    }
    payload.push(10, 0, 0, 0); // action_count
    const action1 = 'buy';
    payload.push(action1.length, 0, 0, 0);
    for (const char of action1) {
      payload.push(char.charCodeAt(0));
    }

    // Second entry
    for (let i = 0; i < 32; i++) {
      payload.push((i + 1) % 256);
    }
    payload.push(20, 0, 0, 0); // action_count
    const action2 = 'sell';
    payload.push(action2.length, 0, 0, 0);
    for (const char of action2) {
      payload.push(char.charCodeAt(0));
    }

    const result = parsePlatformActivityReportPayload(payload);

    expect(result.platform).toBe('TestPlatform');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].action_count).toBe(10);
    expect(result.entries[1].action_count).toBe(20);
  });
});

describe('RPC Functions Signatures', () => {
  // These tests verify function existence and signatures WITHOUT triggering real fetch calls.
  // Calling the functions would trigger actual HTTP requests to the RPC proxy.

  it('getSupplyInfo should be a function', () => {
    expect(typeof getSupplyInfo).toBe('function');
  });

  it('getSupplyInfo should accept optional network parameter', () => {
    // Function signature: getSupplyInfo(network?: NetworkId): Promise<unknown>
    expect(getSupplyInfo.length).toBeLessThanOrEqual(1);
  });

  it('getTransactionCount should be a function', () => {
    expect(typeof getTransactionCount).toBe('function');
  });

  it('getTransactionCount should accept optional network parameter', () => {
    expect(getTransactionCount.length).toBeLessThanOrEqual(1);
  });

  it('both functions can be used in Promise.allSettled pattern', () => {
    // Verify the pattern used in Tokens page (src/app/tokens/page.tsx:170-177)
    // is structurally valid — both are functions that return Promises
    expect(typeof getSupplyInfo).toBe('function');
    expect(typeof getTransactionCount).toBe('function');
    // Don't actually call them — just verify they exist for parallel usage
  });
});

describe('Tokens RPC-first with block scan fallback', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return tokens when RPC claw_getTokens succeeds with non-empty array', async () => {
    const mockTokens = [
      {
        token_id: 'token123',
        creation_tx_hash: 'tx123',
        name: 'TestToken',
        symbol: 'TST',
        decimals: 18,
        total_supply: '1000000000000000000',
        creator: Array.from({ length: 32 }, () => 1),
        block_height: 100,
      },
    ];

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: mockTokens,
        }),
        { status: 200 }
      )
    );

    const result = await getTokens();

    expect(result).toEqual(mockTokens);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should return empty array when RPC claw_getTokens returns empty result', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: [],
        }),
        { status: 200 }
      )
    );

    const result = await getTokens();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it('should throw error when RPC claw_getTokens returns error response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32601,
            message: 'Method not found',
          },
        }),
        { status: 200 }
      )
    );

    await expect(getTokens()).rejects.toThrow('Method not found');
  });

  it('should throw error when fetch fails (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

    await expect(getTokens()).rejects.toThrow('Network timeout');
  });

  it('should handle tokens with camelCase field names', async () => {
    const mockTokens = [
      {
        tokenId: 'token456',
        creationTxHash: 'tx456',
        name: 'AnotherToken',
        symbol: 'ATO',
        decimals: 8,
        totalSupply: '500000000',
        creator: [0, 1, 2],
        blockHeight: 200,
      },
    ];

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: mockTokens,
        }),
        { status: 200 }
      )
    );

    const result = await getTokens();

    expect(result).toEqual(mockTokens);
  });

  it('should handle null result from RPC', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: null,
        }),
        { status: 200 }
      )
    );

    const result = await getTokens();

    // getTokens will attempt to use the result, and if it's null, it won't be an array
    expect(result).toEqual(null);
  });

  it('should support RPC-first → block scan fallback pattern (as used in tokens/page.tsx)', async () => {
    // Simulate the fetchTokens() pattern from src/app/tokens/page.tsx:155-166:
    //   1. Try getTokens() via RPC
    //   2. If fails or empty, fall back to getBlockNumber() + getBlock() scan

    // Step 1: RPC getTokens fails
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32601, message: 'Method not found' },
        }),
        { status: 200 }
      )
    );

    let tokensFromRpc: unknown[] = [];
    let usedFallback = false;
    try {
      tokensFromRpc = await getTokens();
    } catch {
      // RPC failed — fall back to block scanning
      usedFallback = true;
    }

    expect(usedFallback).toBe(true);
    expect(tokensFromRpc).toEqual([]);

    // Step 2: Fallback calls getBlockNumber
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ jsonrpc: '2.0', id: 1, result: 100 }),
        { status: 200 }
      )
    );

    const blockHeight = await getBlockNumber();
    expect(blockHeight).toBe(100);

    // Step 3: Fallback scans blocks via getBlock
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            height: 100,
            hash: '0x' + 'a'.repeat(64),
            transactions: [],
          },
        }),
        { status: 200 }
      )
    );

    const block = await getBlock(100);
    expect(block).toBeTruthy();
    expect(block.height).toBe(100);

    // This proves the full RPC-first → block scan fallback path is functional
  });
});

describe('Transaction detail page: tx + receipt parallel fetch', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch tx and receipt in parallel using Promise.allSettled', async () => {
    const mockTx = {
      hash: 'txhash123',
      txType: 1,
      from: 'sender123',
      to: 'recipient123',
      amount: '1000000000',
      fee: '100',
      nonce: 1,
      blockHeight: 100,
      timestamp: 1000,
      type_name: 'Transfer',
    };

    const mockReceipt = {
      blockHeight: 100,
      transactionIndex: 5,
      success: true,
      fuelConsumed: 1000,
      fuelLimit: 10000,
    };

    // Setup fetch to return tx on first call, receipt on second
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: mockTx,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: mockReceipt,
          }),
          { status: 200 }
        )
      );

    // Simulate the parallel fetch pattern from tx/[hash]/page.tsx
    const [txResult, receiptResult] = await Promise.all([
      getTransactionByHash('txhash123'),
      getTransactionReceipt('txhash123'),
    ]);

    expect(txResult).toEqual(mockTx);
    expect(receiptResult).toEqual(mockReceipt);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should handle Promise.all when both tx and receipt succeed', async () => {
    const mockTx = {
      hash: 'abc123',
      txType: 1,
      from: 'addr1',
      to: 'addr2',
      amount: '500000000',
    };

    const mockReceipt = {
      blockHeight: 50,
      transactionIndex: 0,
      success: true,
    };

    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: mockTx,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: mockReceipt,
          }),
          { status: 200 }
        )
      );

    const results = await Promise.all([
      getTransactionByHash('abc123'),
      getTransactionReceipt('abc123'),
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(mockTx);
    expect(results[1]).toEqual(mockReceipt);
  });

  it('should handle Promise.allSettled when tx succeeds but receipt returns null', async () => {
    const mockTx = {
      hash: 'def456',
      txType: 2,
      from: 'sender',
      to: 'recipient',
      amount: '1000',
    };

    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: mockTx,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            error: {
              code: -32000,
              message: 'Receipt not found',
            },
          }),
          { status: 200 }
        )
      );

    const results = await Promise.allSettled([
      getTransactionByHash('def456'),
      getTransactionReceipt('def456'),
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('fulfilled');
    expect(results[0].value).toEqual(mockTx);
    // getTransactionReceipt catches errors and returns null instead of throwing
    expect(results[1].status).toBe('fulfilled');
    expect(results[1].value).toBeNull();
  });

  it('should handle Promise.allSettled when tx fails but receipt succeeds', async () => {
    const mockReceipt = {
      blockHeight: 75,
      transactionIndex: 3,
      success: false,
      errorMessage: 'Execution failed',
    };

    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            error: {
              code: -32000,
              message: 'Transaction not found',
            },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: mockReceipt,
          }),
          { status: 200 }
        )
      );

    const results = await Promise.allSettled([
      getTransactionByHash('xyz789'),
      getTransactionReceipt('xyz789'),
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('fulfilled');
    expect(results[1].value).toEqual(mockReceipt);
  });

  it('should handle tx failing but receipt returning null in Promise.allSettled', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            error: { code: -32000, message: 'TX not found' },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            error: { code: -32000, message: 'Receipt not found' },
          }),
          { status: 200 }
        )
      );

    const results = await Promise.allSettled([
      getTransactionByHash('missing'),
      getTransactionReceipt('missing'),
    ]);

    expect(results).toHaveLength(2);
    // getTransactionByHash throws errors directly
    expect(results[0].status).toBe('rejected');
    // getTransactionReceipt catches errors and returns null
    expect(results[1].status).toBe('fulfilled');
    expect(results[1].value).toBeNull();
  });

  it('should handle null tx result but successful receipt', async () => {
    const mockReceipt = {
      blockHeight: 42,
      transactionIndex: 2,
      success: true,
    };

    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: null,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: mockReceipt,
          }),
          { status: 200 }
        )
      );

    const results = await Promise.allSettled([
      getTransactionByHash('notfound'),
      getTransactionReceipt('notfound'),
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('fulfilled');
    expect(results[0].value).toBeNull();
    expect(results[1].status).toBe('fulfilled');
    expect(results[1].value).toEqual(mockReceipt);
  });

  it('should verify fetch is called exactly twice for parallel requests', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { hash: 'tx1', txType: 1 },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { blockHeight: 100, success: true },
          }),
          { status: 200 }
        )
      );

    await Promise.all([
      getTransactionByHash('txhash'),
      getTransactionReceipt('txhash'),
    ]);

    // Should be called twice: once for tx, once for receipt
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
