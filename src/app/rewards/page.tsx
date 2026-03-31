import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getBlockNumber, getMiners, getValidators, getServerNetwork } from "@/lib/rpc";
import { RewardsPage } from "@/components/rewards/RewardsPage";

export const metadata = { title: "Node Rewards — ClawNetwork Explorer" };

export interface MinerInfo {
  address: string;
  tier: string;
  name: string;
  registered_at: number;
  last_heartbeat: number;
  active: boolean;
  reputation_bps: number;
}

export default async function RewardsRoute() {
  const network = await getServerNetwork();

  const [height, rawMiners, rawValidators] = await Promise.all([
    getBlockNumber(network).catch(() => 0),
    getMiners(true, 200, network).catch(() => []),
    getValidators(network).catch(() => []),
  ]);

  const miners = rawMiners as MinerInfo[];
  const validators = rawValidators as Array<{ weight?: number }>;
  const validatorCount = validators.length;
  const totalValidatorWeight = validators.reduce((sum, v) => sum + (v.weight ?? 0), 0);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <RewardsPage
          initialHeight={height}
          initialMiners={miners}
          validatorCount={validatorCount}
          initialTotalValidatorWeight={totalValidatorWeight}
          network={network}
        />
      </main>
      <Footer />
    </>
  );
}
