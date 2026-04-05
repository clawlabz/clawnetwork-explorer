# Node Rewards Calculator — 实现方案

**Date**: 2026-03-31  
**Project**: `clawnetwork-explorer`  
**目标**: 在 Explorer 中新增节点收益计算器页面，提供公式说明、实时网络数据、可交互计算器和节点地址查询功能。

---

## 一、这个想法合理吗？

**完全合理，行业标配。**

| 对比链 | 收益计算器 | 功能 |
|--------|-----------|------|
| **Cosmos** | https://wallet.keplr.app | APR 估算 + 验证者比较 |
| **Polkadot** | https://staking.polkadot.network | 输入金额，输出预期年化 |
| **Solana** | https://solanabeach.io/validators | 验证者列表 + 每日收益 |
| **Ethereum** | https://www.stakingrewards.com | 地址输入 → 历史收益 |
| **BNB Chain** | https://www.bnbchain.org/en/validators | 验证者 APY 对比表 |

**业界通用做法**：  
1. 首页 / Tokenomics 页 — 静态公式解释  
2. Explorer 的 Validators/Miners 列表 — 实时数据 + 每节点预期收益列  
3. 独立计算器页 — 输入节点数量或地址，实时计算  

**可行性评估**：  
- ✅ RPC 已有 `claw_getValidators`、`claw_getMiners`、`claw_getMinerInfo`  
- ✅ Explorer 已有 `/validators` 页面，代码架构完善  
- ✅ 奖励公式完全确定性，前端可直接实现  
- ✅ 不需要后端新接口（RPC 数据足够）  

---

## 二、核心公式（来自链上代码）

### 2.1 每块奖励（`reward_per_block`）

**升级前（block < 2,000，Legacy 阶段）**：
```
block ∈ [0, 10,512,000)     → 10 CLAW/块  (Year 1)
block ∈ [10.5M, 21M)        →  8 CLAW/块  (Year 2)
block ∈ [21M, 31.5M)        →  6 CLAW/块  (Year 3)
block ∈ [31.5M, 42M)        →  4 CLAW/块  (Year 4)
block ∈ [42M, 105M)         →  2 CLAW/块  (Year 5-10)
block ≥ 105M                →  1 CLAW/块  (Year 11+)
```

**升级后（block ≥ 2,000，新几何衰减）**：
```
Period = (height - 2000) / 21,024,000

Period 0 (0-2年)   →  8 CLAW/块
Period 1 (2-4年)   →  4 CLAW/块
Period 2 (4-6年)   →  2 CLAW/块
Period 3 (6-8年)   →  1 CLAW/块
Period 4 (8-10年)  →  0.5 CLAW/块
Period 5+ (10年+)  →  0.25 CLAW/块（最低）
```

### 2.2 奖励分配比例

```
每块总奖励（R）
├── 验证者池 = R × 65%   按权重比例分给所有活跃验证者
└── 矿工池   = R × 35%   按 reputation_bps 比例分给所有活跃矿工
```

**验证者权重公式**（来自 `consensus` 模块）：
```
validator_weight = stake × 0.4 + agent_score × 0.6
                   (前2000块冷启动期: stake×0.7 + score×0.3)
```

**矿工权重公式**：
```
miner_weight = tier_weight × reputation_bps
            （目前 tier_weight = 1，只有 Online 档位）
```

**矿工 reputation 等级**：
```
Newcomer    (注册 < 7天,   < 201,600块):  reputation = 2,000 bps (20%)
Established (注册 7-30天, 201,600-864,000块): reputation = 5,000 bps (50%)
Veteran     (注册 > 30天, > 864,000块):   reputation = 10,000 bps (100%)
```

### 2.3 单个矿工收益公式

```
my_share = mining_pool_reward × my_weight / total_weight

其中:
  mining_pool_reward = R × 35%
  my_weight = tier_weight(=1) × my_reputation_bps
  total_weight = Σ(所有活跃矿工的 weight)

每日收益 = my_share × 28,800  (28,800块/天 = 86,400秒 ÷ 3秒)
每小时收益 = my_share × 1,200
每年收益（估算）= my_share × 10,512,000
```

### 2.4 手续费分配（矿工不参与）
```
交易手续费
├── 50% → 出块验证者（proposer）
├── 20% → 生态基金
└── 30% → 销毁（deflationary burn）
```

---

## 三、页面设计

### 路由：`/rewards`

新增一个独立页面，放在 Explorer 内：`/rewards`

#### 3.1 页面结构

```
┌─────────────────────────────────────────────────────┐
│  网络收益概览 (Live Stats Bar)                        │
│  区块高度: 12,847 | 当前奖励: 8 CLAW/块 | 活跃验证者: 4 │
│  活跃矿工: 23 | 矿工池/块: 2.8 CLAW | Period: 0      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  奖励机制说明                                         │
│  [奖励分配图解] 65% 验证者 | 35% 矿工                  │
│  [衰减时间表格]                                        │
│  [矿工 Reputation 等级表]                             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  交互式计算器                                         │
│  Tab: [矿工计算] [验证者计算]                          │
│                                                     │
│  矿工计算:                                            │
│  活跃矿工总数: [____23____]  (可从链上自动填入)         │
│  我的 Reputation: [○ Newcomer ○ Established ● Veteran] │
│  当前奖励 Period: [自动填入 Period 0 = 8 CLAW]         │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ 预期收益                                          ││
│  │ 每块: 0.1217 CLAW                                ││
│  │ 每小时: 146.1 CLAW                                ││
│  │ 每天: 3,505 CLAW                                  ││
│  │ 每月: 105,156 CLAW                                ││
│  │ 每年: 1,283,200 CLAW (约)                         ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  节点地址查询                                         │
│  输入地址: [________________________] [查询]          │
│                                                     │
│  查询结果:                                            │
│  节点类型: Miner                                     │
│  名称: MyNode                                        │
│  状态: 🟢 Active                                     │
│  Reputation: Veteran (10,000 bps)                   │
│  注册时间: Block #1,234                              │
│  上次心跳: Block #12,843 (4块前, ~12秒前)             │
│                                                     │
│  预期收益（基于当前网络状态）:                          │
│  每块: 0.1217 CLAW | 每天: 3,505 CLAW               │
│  占矿工池份额: 4.35%                                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  当前活跃矿工列表                                     │
│  排名 | 地址 | 名称 | Reputation | 权重占比 | 预期日收益 │
└─────────────────────────────────────────────────────┘
```

---

## 四、技术实现

### 4.1 新增 RPC 函数（`src/lib/rpc.ts`）

现有接口已足够，无需新增节点侧 RPC。只需确认：
- `getMiners(activeOnly, limit)` → `claw_getMiners` ✅ 已有
- `getMinerInfo(address)` → `claw_getMinerInfo` ✅ 已有  
- `getValidators()` → `claw_getValidators` ✅ 已有
- `getBlockNumber()` → `claw_blockNumber` ✅ 已有

### 4.2 新增奖励计算工具库（`src/lib/rewards.ts`）

```typescript
// 纯函数，与链上 Rust 逻辑完全对应
export const BLOCKS_PER_YEAR = 10_512_000;
export const BLOCKS_PER_DAY = 28_800;
export const MINING_UPGRADE_HEIGHT = 2_000;
export const HALVING_PERIOD = 2 * BLOCKS_PER_YEAR;
export const VALIDATOR_BPS = 6_500;
export const MINING_BPS = 3_500;

export function rewardPerBlock(height: number): bigint { ... }
export function miningPoolPerBlock(height: number): bigint { ... }
export function calcMinerShare(params: {
  height: number;
  myReputationBps: number;
  totalWeight: number;
}): bigint { ... }
export function reputationFromAge(registeredAt: number, currentHeight: number): {
  tier: 'newcomer' | 'established' | 'veteran';
  bps: number;
} { ... }
```

### 4.3 新增页面和组件

```
src/app/rewards/
  └── page.tsx               ← 服务端：fetch 初始 live data

src/components/rewards/
  ├── RewardsPage.tsx         ← 主组件（客户端，持有状态）
  ├── NetworkStatsBar.tsx     ← 实时网络概览条
  ├── RewardMechanismDocs.tsx ← 公式说明 + 表格（静态）
  ├── MinerCalculator.tsx     ← 矿工收益计算器（交互式）
  ├── ValidatorCalculator.tsx ← 验证者收益计算器（交互式）
  ├── NodeLookup.tsx          ← 地址查询 + 结果展示
  └── MinerLeaderboard.tsx    ← 活跃矿工列表 + 预期日收益
```

### 4.4 数据刷新策略

- 页面加载时 fetch 一次链上数据（block height, miners, validators）
- 每 30 秒自动刷新 NetworkStatsBar（不刷新整页）
- 计算器输入变化时实时重新计算（纯前端，无网络请求）
- NodeLookup 点击查询才请求

---

## 五、Reputation 等级分配详细说明

| 等级 | 条件 | Reputation | 说明 |
|------|------|-----------|------|
| **Newcomer** | 注册后 < 7天（< 201,600块） | 2,000 bps (20%) | 刚加入，低权重 |
| **Established** | 注册后 7-30天 | 5,000 bps (50%) | 运行稳定，中等权重 |
| **Veteran** | 注册后 > 30天（> 864,000块） | 10,000 bps (100%) | 长期节点，满权重 |

**注意**：这是代码中定义的参考常量，实际 reputation_bps 由链上 `MinerInfo.reputation_bps` 字段决定，可能因心跳稳定性等因素而不同（目前代码中等级=bps，直接对应）。

---

## 六、收益场景对比表（Page 内展示）

| 场景 | 活跃矿工数 | 我的Reputation | 每块收益 | 每日收益 |
|------|-----------|--------------|---------|---------|
| 唯一矿工（刚加入） | 1 | Newcomer 20% | 2.8 CLAW | 80,640 CLAW |
| 唯一矿工（老节点） | 1 | Veteran 100% | 2.8 CLAW | 80,640 CLAW |
| 10个矿工（全Veteran） | 10 | Veteran 100% | 0.28 CLAW | 8,064 CLAW |
| 10个矿工（我是Newcomer） | 10 (9V+1N) | Newcomer 20% | ~0.054 CLAW | ~1,555 CLAW |
| 100个矿工（全Veteran） | 100 | Veteran 100% | 0.028 CLAW | 806 CLAW |
| 100个矿工（我是Newcomer） | 100 (99V+1N) | Newcomer 20% | ~0.0056 CLAW | ~161 CLAW |

> 以上基于 Period 0（8 CLAW/块，矿工池 2.8 CLAW/块）。

---

## 七、需要验证的 RPC 数据格式

在实现前需确认 `claw_getMiners` 返回的字段结构：
```typescript
// 预期 MinerInfo 结构（对应链上 MinerInfo）
interface MinerInfo {
  address: string;          // hex
  tier: 'Online';
  name: string;
  registered_at: number;    // block height
  last_heartbeat: number;   // block height
  ip_prefix: number[];
  active: boolean;
  reputation_bps: number;   // 0-10000
}
```

**需要用 `claw_getMiningStats` 或手动聚合确认：**
- 是否有接口直接返回 total_weight？
- 如果没有，前端从 miner 列表计算：`total_weight = Σ miner.reputation_bps`

---

## 八、导航入口

在 Explorer Header 添加入口：  
`Explorer: [区块] [交易] [验证者] [矿工] → [节点收益] ← 新增`

或在 `/validators` 页面顶部加入快捷链接：  
`查看完整收益计算器 →`

---

## 九、开发优先级与顺序

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | `src/lib/rewards.ts` | 纯函数奖励计算，可独立测试 |
| P0 | `RewardMechanismDocs.tsx` | 静态公式 + 表格，无网络依赖 |
| P1 | `NetworkStatsBar.tsx` | 接入 RPC，显示实时数据 |
| P1 | `MinerCalculator.tsx` | 交互式计算器主体 |
| P1 | `NodeLookup.tsx` | 地址查询 |
| P2 | `MinerLeaderboard.tsx` | 矿工排行榜 |
| P2 | `ValidatorCalculator.tsx` | 验证者计算器 |
| P3 | i18n (EN/ZH) | 双语支持 |

---

## 十、不做什么（范围边界）

- ❌ 不显示历史实际收益（需要索引链上 RewardDistributed 事件，工程量大）
- ❌ 不做收益预测图表（暂时）
- ❌ 不支持"比较多个地址"（可后续扩展）
- ❌ 不修改 RPC 节点（纯前端实现）

---

## 十一、文件变更清单

| 文件 | 操作 |
|------|------|
| `src/lib/rewards.ts` | 新增 |
| `src/app/rewards/page.tsx` | 新增 |
| `src/components/rewards/*.tsx` | 新增 (6个组件) |
| `src/components/Header.tsx` | 修改（添加导航入口） |
| `src/lib/rpc.ts` | 可能微调（确认 MinerInfo 类型） |

总计约 **600-800 行**新代码，分布在 8-9 个文件。

---

**审核通过后开始开发。如有调整请在此文件上注明。**
