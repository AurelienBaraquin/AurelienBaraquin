import { z } from "zod";

const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";
const REPOS_PAGE_SIZE = 100;
const LANGUAGES_PER_REPO = 10;

const languageEdgeSchema = z.object({
  size: z.number().int().nonnegative(),
  node: z.object({ name: z.string(), color: z.string().nullable() }),
});

const repositorySchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  isPrivate: z.boolean(),
  isFork: z.boolean(),
  isArchived: z.boolean(),
  stargazerCount: z.number().int().nonnegative(),
  pushedAt: z.string().nullable(),
  homepageUrl: z.string().nullable(),
  primaryLanguage: z.object({ name: z.string() }).nullable(),
  languages: z.object({ edges: z.array(languageEdgeSchema) }),
});

const contributionDaySchema = z.object({
  date: z.string(),
  contributionCount: z.number().int().nonnegative(),
});

const responseSchema = z.object({
  data: z.object({
    user: z.object({
      repositories: z.object({
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
        nodes: z.array(repositorySchema),
      }),
      contributionsCollection: z.object({
        contributionCalendar: z.object({
          totalContributions: z.number().int().nonnegative(),
          weeks: z.array(z.object({ contributionDays: z.array(contributionDaySchema) })),
        }),
      }),
    }),
  }),
});

export type Repository = z.infer<typeof repositorySchema>;
export type ContributionDay = z.infer<typeof contributionDaySchema>;

export interface ProfileData {
  readonly repositories: readonly Repository[];
  readonly totalContributions: number;
  readonly contributionDays: readonly ContributionDay[];
}

export interface LanguageShare {
  readonly name: string;
  readonly color: string | null;
  readonly bytes: number;
  readonly share: number;
}

const QUERY = `
query($login: String!, $first: Int!, $after: String, $languages: Int!) {
  user(login: $login) {
    repositories(first: $first, after: $after, ownerAffiliations: OWNER, orderBy: {field: PUSHED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name description isPrivate isFork isArchived stargazerCount pushedAt homepageUrl
        primaryLanguage { name }
        languages(first: $languages, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

export type FetchFn = typeof fetch;

async function fetchPage(
  fetchImpl: FetchFn,
  token: string,
  login: string,
  after: string | null,
): Promise<z.infer<typeof responseSchema>["data"]["user"]> {
  const response = await fetchImpl(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: QUERY,
      variables: { login, first: REPOS_PAGE_SIZE, after, languages: LANGUAGES_PER_REPO },
    }),
  });
  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed: HTTP ${String(response.status)}`);
  }
  const body: unknown = await response.json();
  return responseSchema.parse(body).data.user;
}

export async function fetchProfileData(
  token: string,
  login: string,
  fetchImpl: FetchFn = fetch,
): Promise<ProfileData> {
  const repositories: Repository[] = [];
  let after: string | null = null;
  let user = await fetchPage(fetchImpl, token, login, after);
  const calendar = user.contributionsCollection.contributionCalendar;

  for (;;) {
    repositories.push(...user.repositories.nodes);
    const { hasNextPage, endCursor } = user.repositories.pageInfo;
    if (!hasNextPage) break;
    after = endCursor;
    user = await fetchPage(fetchImpl, token, login, after);
  }

  return {
    repositories,
    totalContributions: calendar.totalContributions,
    contributionDays: calendar.weeks.flatMap((week) => week.contributionDays),
  };
}

export function aggregateLanguages(repositories: readonly Repository[]): LanguageShare[] {
  const totals = new Map<string, { color: string | null; bytes: number }>();

  for (const repository of repositories) {
    if (repository.isFork) continue;
    for (const { size, node } of repository.languages.edges) {
      const current = totals.get(node.name);
      totals.set(node.name, {
        color: current?.color ?? node.color,
        bytes: (current?.bytes ?? 0) + size,
      });
    }
  }

  const grandTotal = [...totals.values()].reduce((sum, entry) => sum + entry.bytes, 0);
  if (grandTotal === 0) return [];

  return [...totals.entries()]
    .map(([name, { color, bytes }]) => ({ name, color, bytes, share: bytes / grandTotal }))
    .sort((a, b) => b.bytes - a.bytes);
}
