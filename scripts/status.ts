import type { FetchFn } from "./github.js";

export interface StatusTarget {
  readonly name: string;
  readonly url: string;
}

export type ProbeFailure = "timeout" | "unreachable" | "error";

export interface StatusResult {
  readonly name: string;
  readonly host: string;
  readonly ok: boolean;
  readonly status: number | null;
  readonly latencyMs: number | null;
  readonly failure: ProbeFailure | null;
}

const PROBE_TIMEOUT_MS = 8000;

/** Public showcase sites only: admin panels listed in my-infra are deliberately not advertised here. */
export const STATUS_TARGETS: readonly StatusTarget[] = [
  { name: "portfolio", url: "https://aurelienb.com" },
  { name: "pixel quest", url: "https://aurelienb.com/pixel-quest" },
  { name: "miku", url: "https://miku.aurelienb.com" },
  { name: "manifeste", url: "https://manifeste.aurelienb.com" },
];

async function probe(
  target: StatusTarget,
  fetchImpl: FetchFn,
  clock: () => number,
): Promise<StatusResult> {
  const host = new URL(target.url).host;
  const started = clock();
  try {
    const response = await fetchImpl(target.url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const latencyMs = Math.round(clock() - started);
    await response.body?.cancel();
    return {
      name: target.name,
      host,
      ok: response.ok,
      status: response.status,
      latencyMs,
      failure: response.ok ? null : "error",
    };
  } catch (error: unknown) {
    const failure: ProbeFailure = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "unreachable";
    return { name: target.name, host, ok: false, status: null, latencyMs: null, failure };
  }
}

/** A site being down is data, not a build failure: every outcome is returned as a result. */
export function checkTargets(
  targets: readonly StatusTarget[],
  fetchImpl: FetchFn = fetch,
  clock: () => number = () => performance.now(),
): Promise<StatusResult[]> {
  return Promise.all(targets.map((target) => probe(target, fetchImpl, clock)));
}
