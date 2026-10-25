"use client";

import { BookOpen } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { INTRO_EVENT } from "@/lib/onboarding/intro";

/// Replays the first-visit tour.
export function IntroButton({ variant = "outline", size, className }: Pick<ButtonProps, "variant" | "size" | "className">) {
  return (
    <Button variant={variant} size={size} className={className} onClick={() => window.dispatchEvent(new Event(INTRO_EVENT))}>
      <BookOpen aria-hidden /> How Janus works
    </Button>
  );
}
