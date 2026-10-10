import { describe, expect, it } from "vitest";
import { STATUS_TARGETS, type StatusResult } from "../status.js";
import { PALETTES } from "../theme.js";
import { describeResult, renderStatus } from "./status.js";

const UP: StatusResult = { name: "portfolio", host: "aurelienb.com", ok: true, status: 200, latencyMs: 142, failure: null };
const HTTP_DOWN: StatusResult = { name: "miku", host: "miku.example", ok: false, status: 503, latencyMs: 30, failure: "error" };
const TIMED_OUT: StatusResult = { name: "<b>x</b>", host: "slow.example", ok: false, status: null, latencyMs: null, failure: "timeout" };
const CHECKED_AT = new Date("2026-10-10T17:45:30Z");

describe("describeResult", () => {
  it("describes each outcome", () => {
    expect(describeResult(UP)).toBe("up · 142 ms");
    expect(describeResult(HTTP_DOWN)).toBe("down · HTTP 503");
    expect(describeResult(TIMED_OUT)).toBe("down · timeout");
  });
});

describe("renderStatus", () => {
  const svg = renderStatus({ palette: PALETTES.dark, results: [UP, HTTP_DOWN, TIMED_OUT], checkedAt: CHECKED_AT });

  it("summarises how many sites are up with a UTC timestamp", () => {
    expect(svg).toContain("1 of 3 sites up at 2026-10-10 17:45 UTC");
  });

  it("is honest that it is a snapshot, not a live feed", () => {
    expect(svg).toContain("not a live feed");
  });

  it("uses semantic colours and pulses only for sites that are up", () => {
    expect(svg).toContain(`fill="${PALETTES.dark.positive}"`);
    expect(svg).toContain(`fill="${PALETTES.dark.negative}"`);
    expect(svg.match(/class="ring"/g)).toHaveLength(1);
  });

  it("escapes hostile names", () => {
    expect(svg).not.toContain("<b>x</b>");
    expect(svg).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("stops the pulse under reduced motion and stays self-contained", () => {
    expect(svg).toContain("prefers-reduced-motion:reduce){.ring{animation:none;opacity:0}");
    expect(svg).not.toMatch(/<script|href=|url\(http|@import/);
  });

  it("fits the real showcase hosts and refuses text that would overflow a cell", () => {
    const longest = STATUS_TARGETS.map((target) => new URL(target.url).host);
    const real = longest.map((host) => ({ ...UP, host }));

    expect(() => renderStatus({ palette: PALETTES.dark, results: real, checkedAt: CHECKED_AT })).not.toThrow();
    expect(() =>
      renderStatus({
        palette: PALETTES.dark,
        results: [{ ...UP, host: "a-very-long-subdomain.example-company.com" }, UP, UP, UP],
        checkedAt: CHECKED_AT,
      }),
    ).toThrow("does not fit");
  });

  it("renders with no results without crashing", () => {
    expect(renderStatus({ palette: PALETTES.light, results: [], checkedAt: CHECKED_AT })).toContain("0 of 0 sites up");
  });
});
