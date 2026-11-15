import type { Metadata } from "next";
import { TransparencyView } from "@/components/transparency/transparency-view";

export const metadata: Metadata = { title: "Transparency" };

export default function TransparencyPage() {
  return <TransparencyView />;
}
