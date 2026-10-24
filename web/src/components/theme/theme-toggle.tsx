"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { resolved, setChoice } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <Button variant="ghost" size="icon" onClick={() => setChoice(next)} aria-label={`Switch to ${next} theme`}>
      {resolved === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
