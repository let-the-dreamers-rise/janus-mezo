import { describe, expect, it } from "vitest";
import { memoryStore, type KeyStore } from "@/lib/demo/key-store";
import { INTRO_SLIDES, clampSlide, hasSeenIntro, markIntroSeen } from "./intro";

const blocked: KeyStore = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("SecurityError");
  },
  removeItem: () => undefined,
};

describe("intro", () => {
  it("has four to five short slides, the last one about trying it", () => {
    expect(INTRO_SLIDES.length).toBeGreaterThanOrEqual(4);
    expect(INTRO_SLIDES.length).toBeLessThanOrEqual(5);
    for (const slide of INTRO_SLIDES) {
      expect(slide.body.split(" ").length).toBeLessThanOrEqual(40);
    }
    expect(INTRO_SLIDES[INTRO_SLIDES.length - 1]?.eyebrow).toBe("Try it");
  });

  it("keeps the slide index in range", () => {
    expect(clampSlide(-1)).toBe(0);
    expect(clampSlide(2)).toBe(2);
    expect(clampSlide(99)).toBe(INTRO_SLIDES.length - 1);
  });

  it("shows once per browser", () => {
    const store = memoryStore();
    expect(hasSeenIntro(store)).toBe(false);
    markIntroSeen(store);
    expect(hasSeenIntro(store)).toBe(true);
  });

  it("stays quiet where storage is blocked, rather than showing on every page", () => {
    expect(hasSeenIntro(blocked)).toBe(true);
    expect(() => markIntroSeen(blocked)).not.toThrow();
    expect(hasSeenIntro(undefined)).toBe(true);
  });
});
