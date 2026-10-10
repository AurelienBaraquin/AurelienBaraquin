import { describe, expect, it } from "vitest";
import type { FetchFn } from "./github.js";
import { checkTargets, STATUS_TARGETS, type StatusTarget } from "./status.js";

const TARGETS: readonly StatusTarget[] = [{ name: "site", url: "https://example.com/path" }];

function steppingClock(step: number): () => number {
  let now = 1000;
  return () => {
    const value = now;
    now += step;
    return value;
  };
}

describe("checkTargets", () => {
  it("reports an OK response with its latency", async () => {
    const fakeFetch: FetchFn = () => Promise.resolve(new Response("ok", { status: 200 }));

    const [result] = await checkTargets(TARGETS, fakeFetch, steppingClock(142));

    expect(result).toEqual({
      name: "site",
      host: "example.com",
      ok: true,
      status: 200,
      latencyMs: 142,
      failure: null,
    });
  });

  it("reports an HTTP error as down with its status", async () => {
    const fakeFetch: FetchFn = () => Promise.resolve(new Response("nope", { status: 503 }));

    const [result] = await checkTargets(TARGETS, fakeFetch, steppingClock(10));

    expect(result?.ok).toBe(false);
    expect(result?.status).toBe(503);
    expect(result?.failure).toBe("error");
  });

  it("distinguishes a timeout from an unreachable host", async () => {
    const timeout: FetchFn = () => Promise.reject(new DOMException("timed out", "TimeoutError"));
    const refused: FetchFn = () => Promise.reject(new TypeError("fetch failed"));

    const [timedOut] = await checkTargets(TARGETS, timeout);
    const [unreachable] = await checkTargets(TARGETS, refused);

    expect(timedOut?.failure).toBe("timeout");
    expect(unreachable?.failure).toBe("unreachable");
    expect(unreachable?.latencyMs).toBeNull();
  });

  it("never throws when a site is down, so a build always completes", async () => {
    const refused: FetchFn = () => Promise.reject(new TypeError("fetch failed"));

    await expect(checkTargets(STATUS_TARGETS, refused)).resolves.toHaveLength(STATUS_TARGETS.length);
  });

  it("advertises showcase sites only, never admin panels", () => {
    const hosts = STATUS_TARGETS.map((target) => new URL(target.url).host);

    expect(hosts.some((host) => /portainer|vikunja|ntfy/.test(host))).toBe(false);
  });
});
