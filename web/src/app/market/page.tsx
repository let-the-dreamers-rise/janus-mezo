import type { Metadata } from "next";
import { MarketView } from "@/components/market/market-view";

export const metadata: Metadata = { title: "The market" };

export default function MarketPage() {
  return <MarketView />;
}
