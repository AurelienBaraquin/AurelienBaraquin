import { describe, expect, it } from "vitest";
import { aggregateLanguages, fetchProfileData, type FetchFn, type Repository } from "./github.js";

function repo(overrides: Partial<Repository> & Pick<Repository, "name">): Repository {
  return {
    description: null,
    isPrivate: false,
    isFork: false,
    isArchived: false,
    stargazerCount: 0,
    pushedAt: null,
    homepageUrl: null,
    primaryLanguage: null,
    languages: { edges: [] },
    ...overrides,
  };
}

function language(name: string, size: number, color: string | null = "#000000") {
  return { size, node: { name, color } };
}

function page(nodes: Repository[], hasNextPage: boolean, endCursor: string | null) {
  return {
    data: {
      user: {
        repositories: { pageInfo: { hasNextPage, endCursor }, nodes },
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: 3,
            weeks: [{ contributionDays: [{ date: "2026-10-09", contributionCount: 3 }] }],
          },
        },
      },
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("aggregateLanguages", () => {
  it("sums bytes across repositories, private ones included, and sorts descending", () => {
    const result = aggregateLanguages([
      repo({ name: "a", isPrivate: true, languages: { edges: [language("C", 600), language("Rust", 100)] } }),
      repo({ name: "b", languages: { edges: [language("Rust", 300)] } }),
    ]);

    expect(result.map((entry) => entry.name)).toEqual(["C", "Rust"]);
    expect(result[0]?.share).toBeCloseTo(0.6);
    expect(result[1]?.bytes).toBe(400);
  });

  it("ignores forks because their code is not mine", () => {
    const result = aggregateLanguages([
      repo({ name: "fork", isFork: true, languages: { edges: [language("C++", 9999)] } }),
      repo({ name: "own", languages: { edges: [language("Zig", 10)] } }),
    ]);

    expect(result.map((entry) => entry.name)).toEqual(["Zig"]);
  });

  it("returns an empty list when there is no language data", () => {
    expect(aggregateLanguages([repo({ name: "empty" })])).toEqual([]);
  });
});

describe("fetchProfileData", () => {
  it("follows pagination and flattens the contribution calendar", async () => {
    const responses = [page([repo({ name: "one" })], true, "cursor-1"), page([repo({ name: "two" })], false, null)];
    const calls: string[] = [];
    const fakeFetch: FetchFn = (_input, init) => {
      calls.push(typeof init?.body === "string" ? init.body : "");
      const next = responses.shift();
      if (next === undefined) throw new Error("unexpected extra request");
      return Promise.resolve(jsonResponse(next));
    };

    const data = await fetchProfileData("token", "someone", fakeFetch);

    expect(data.repositories.map((entry) => entry.name)).toEqual(["one", "two"]);
    expect(data.totalContributions).toBe(3);
    expect(data.contributionDays).toEqual([{ date: "2026-10-09", contributionCount: 3 }]);
    expect(calls[1]).toContain('"after":"cursor-1"');
  });

  it("throws on a non-OK HTTP status", async () => {
    const fakeFetch: FetchFn = () => Promise.resolve(jsonResponse({}, 401));

    await expect(fetchProfileData("bad", "someone", fakeFetch)).rejects.toThrow("HTTP 401");
  });

  it("rejects a payload that does not match the expected shape", async () => {
    const fakeFetch: FetchFn = () => Promise.resolve(jsonResponse({ data: { user: null } }));

    await expect(fetchProfileData("token", "someone", fakeFetch)).rejects.toThrow();
  });
});
