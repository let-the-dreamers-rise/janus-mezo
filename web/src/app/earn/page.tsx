import type { Metadata } from "next";
import { EarnView } from "@/components/earn/earn-view";

export const metadata: Metadata = { title: "Put my veMEZO to work" };

export default function EarnPage() {
  return <EarnView />;
}
