"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useDemoWallet } from "@/hooks/use-demo-wallet";
import { useMounted } from "@/hooks/use-mounted";

/// Shown while the demo wallet is connected: where its key lives, and a way to drop it.
export function DemoWalletNote() {
  const demo = useDemoWallet();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  if (!mounted || !demo.active) return null;
  return (
    <div
      role="note"
      className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-2">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span>
          You are using a demo wallet. Its key lives only in this browser, so keep it for testnet play. It reconnects
          on your next visit.
        </span>
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="shrink-0">
            Forget demo wallet
          </Button>
        </DialogTrigger>
        <DialogContent
          title="Forget this demo wallet?"
          description="Its key is deleted from this browser. Whatever it holds stays on chain, but nobody can move it again. Trying the demo later makes a new wallet."
        >
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Keep it</Button>
            </DialogClose>
            <Button
              variant="destructive"
              loading={forgetting}
              onClick={async () => {
                setForgetting(true);
                await demo.forget();
                setForgetting(false);
                setOpen(false);
              }}
            >
              Forget it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
