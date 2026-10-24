import { describe, expect, it } from "vitest";
import { THEME_SCRIPT, THEME_STORAGE_KEY, parseThemeChoice, resolveTheme } from "./theme";

describe("theme", () => {
  it("reads only light or dark from storage and treats anything else as the system choice", () => {
    expect(parseThemeChoice("light")).toBe("light");
    expect(parseThemeChoice("dark")).toBe("dark");
    expect(parseThemeChoice("sepia")).toBe("system");
    expect(parseThemeChoice(null)).toBe("system");
  });

  it("follows the system preference unless a choice was made", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("ships a pre-paint script that reads the same storage key", () => {
    expect(THEME_SCRIPT).toContain(THEME_STORAGE_KEY);
  });
});
