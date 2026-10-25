import { BuiltOnMezo } from "@/components/home/built-on-mezo";
import { Hero } from "@/components/home/hero";
import { MarketPulse } from "@/components/home/market-pulse";
import { Planned } from "@/components/home/planned";
import { RoundSteps } from "@/components/home/round-steps";
import { TwoFaces } from "@/components/home/two-faces";

export default function HomePage() {
  return (
    <>
      <Hero />
      <MarketPulse />
      <TwoFaces />
      <RoundSteps />
      <BuiltOnMezo />
      <Planned />
    </>
  );
}
