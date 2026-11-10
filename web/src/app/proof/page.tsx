import type { Metadata } from "next";
import { ProofView } from "@/components/proof/proof-view";

export const metadata: Metadata = { title: "Proof" };

export default function ProofPage() {
  return <ProofView />;
}
