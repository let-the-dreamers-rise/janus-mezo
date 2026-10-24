"use client";

import { useEffect, useState } from "react";
import { getAddress, isAddress, type Address } from "viem";

/// A read-only address from ?as=0x..., so anyone can see the app as a given account without
/// a wallet. Nothing can be signed in this mode.
export function useWatchAddress(): Address | undefined {
  const [address, setAddress] = useState<Address>();
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("as");
    setAddress(value && isAddress(value) ? getAddress(value) : undefined);
  }, []);
  return address;
}
