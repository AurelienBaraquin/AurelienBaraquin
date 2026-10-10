import { describe, expect, it } from "vitest";
import type { ContributionDay } from "../github.js";
import { PALETTES } from "../theme.js";
import { computeStats, intensityLevel, renderActivity } from "./activity.js";

/** Builds consecutive days starting on Sunday 2026-01-04. */
function daysFrom(counts: readonly number[]): ContributionDay[] {
  const start = Date.UTC(2026, 0, 4);
  return counts.map((contributionCount, index) => ({
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    contributionCount,
  }));
}

describe("computeStats", () => {
  it("totals contributions and finds the busiest day", () => {
    const stats = computeStats(daysFrom([0, 3, 0, 5, 1]));

    expect(stats.total).toBe(9);
    expect(stats.busiestDay).toBe(5);
  });

  it("finds the longest run of active days", () => {
    expect(computeStats(daysFrom([1, 1, 0, 2, 2, 2, 0, 1])).longestStreak).toBe(3);
  });

  it("handles an empty history", () => {
    expect(computeStats([])).toEqual({ total: 0, busiestDay: 0, longestStreak: 0 });
  });
});

describe("intensityLevel", () => {
  it("maps counts to levels relative to the busiest day", () => {
    expect(intensityLevel(0, 10)).toBe(0);
    expect(intensityLevel(1, 10)).toBe(1);
    expect(intensityLevel(10, 10)).toBe(4);
  });

  it("never divides by a zero maximum", () => {
    expect(intensityLevel(5, 0)).toBe(0);
  });
});

describe("renderActivity", () => {
  const counts = [0, 2, 0, 5, 1, 0, 0, 3, 0, 0, 4, 0, 0, 0, 9];

  it("draws one top face per day and side faces only for active days", () => {
    const svg = renderActivity({ palette: PALETTES.dark, days: daysFrom(counts) });
    const active = counts.filter((count) => count > 0).length;

    expect(svg.match(/<polygon/g)?.length).toBe(counts.length + active * 2);
    expect(svg.match(/class="bar"/g)?.length).toBe(active);
  });

  it("states the real totals in text for readers who skip the picture", () => {
    const svg = renderActivity({ palette: PALETTES.light, days: daysFrom(counts) });

    expect(svg).toContain("24 contributions · longest streak 2 days · busiest day 9");
  });

  it("pluralises the streak", () => {
    const svg = renderActivity({ palette: PALETTES.light, days: daysFrom([1, 1, 1]) });

    expect(svg).toContain("longest streak 3 days");
  });

  it("renders an empty year without crashing", () => {
    const svg = renderActivity({ palette: PALETTES.dark, days: [] });

    expect(svg).toContain("0 contributions");
  });

  it("disables the wave under reduced motion and stays self-contained", () => {
    const svg = renderActivity({ palette: PALETTES.dark, days: daysFrom(counts) });

    expect(svg).toContain("prefers-reduced-motion:reduce){.bar{animation:none}");
    expect(svg).not.toMatch(/<script|href=|url\(http|@import/);
  });

  it("animates transform only: combining it with opacity left bars invisible in Chromium", () => {
    const svg = renderActivity({ palette: PALETTES.light, days: daysFrom(counts) });

    expect(svg).toContain("@keyframes rise{from{transform:scaleY(0)}}");
    expect(svg).not.toMatch(/@keyframes rise\{[^}]*opacity/);
  });

  it("stays under the size budget for a full year", () => {
    const year = daysFrom(Array.from({ length: 371 }, (_, index) => (index % 3 === 0 ? (index % 11) + 1 : 0)));
    const svg = renderActivity({ palette: PALETTES.dark, days: year });

    expect(Buffer.byteLength(svg)).toBeLessThan(150_000);
  });
});
