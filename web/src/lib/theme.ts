export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "janus-theme";

export function parseThemeChoice(value: unknown): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === "system") return systemPrefersDark ? "dark" : "light";
  return choice;
}

/// Runs before first paint so the page never flashes the wrong theme. Storage can be
/// unavailable (private windows, blocked site data), so every access is guarded.
export const THEME_SCRIPT = `(function(){try{var c=null;try{c=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}var d=c==="dark"||(c!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})();`;
