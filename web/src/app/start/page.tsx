import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StartView } from "@/components/onboarding/start-view";
import { NETWORK_INFO } from "@/config/network";

export const metadata: Metadata = { title: "Get started" };

export default function StartPage() {
  // The tour is the demo wallet and free starter kit, which exist only on testnet.
  if (!NETWORK_INFO.demoEnabled) redirect("/");
  return <StartView />;
}
