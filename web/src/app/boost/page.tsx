import type { Metadata } from "next";
import { BoostView } from "@/components/boost/boost-view";

export const metadata: Metadata = { title: "Boost my veBTC" };

export default function BoostPage() {
  return <BoostView />;
}
