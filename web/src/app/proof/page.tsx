import { redirect } from "next/navigation";

/// The evidence page became /transparency once Janus launched on mainnet.
export default function ProofPage() {
  redirect("/transparency/");
}
