import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { renderLeaderboard } from "../render/leaderboard.js";
import { PALETTES, THEME_NAMES } from "../theme.js";
import { encodePng, parsePpm } from "./png.js";
import { processIssues, type GameDependencies, type GameIssue, type WalkerResult } from "./process.js";
import { initialState, parsePose, parseState, type GameState, type MoveCommand, type Pose } from "./state.js";

/** Actions sets GITHUB_API_URL itself; the fallback is the public API. */
const DEFAULT_API_ROOT = "https://api.github.com";
const REPOSITORY_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const WALKER_TIMEOUT_MS = 60_000;
const ISSUES_PAGE_SIZE = 100;
const DEFAULT_GAME_DIR = "game-data";
const DEFAULT_WALKER = "game/walker/target/release/walker";

const run = promisify(execFile);

const issueSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  user: z.object({ login: z.string() }).nullable(),
  pull_request: z.unknown().optional(),
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`${name} is not set`);
  return value;
}

function createGithub(token: string, repository: string) {
  const apiRoot = process.env["GITHUB_API_URL"] ?? DEFAULT_API_ROOT;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  const call = async (path: string, init: RequestInit): Promise<unknown> => {
    const response = await fetch(`${apiRoot}/repos/${repository}${path}`, { ...init, headers });
    if (!response.ok) throw new Error(`GitHub API ${init.method ?? "GET"} ${path} failed: HTTP ${String(response.status)}`);
    return response.json();
  };

  return {
    async listIssues(): Promise<GameIssue[]> {
      const raw = await call(`/issues?state=open&sort=created&direction=asc&per_page=${String(ISSUES_PAGE_SIZE)}`, {});
      return z
        .array(issueSchema)
        .parse(raw)
        .flatMap((entry) =>
          entry.pull_request !== undefined || entry.user === null
            ? []
            : [{ number: entry.number, title: entry.title, author: entry.user.login }],
        );
    },
    async respond(issue: GameIssue, message: string): Promise<void> {
      await call(`/issues/${String(issue.number)}`, {
        method: "PATCH",
        body: JSON.stringify({ state: "closed", state_reason: "completed" }),
      });
      await call(`/issues/${String(issue.number)}/comments`, { method: "POST", body: JSON.stringify({ body: message }) });
    },
  };
}

async function runWalker(binary: string, pose: Pose, command: MoveCommand | "none"): Promise<WalkerResult> {
  const workDir = mkdtempSync(join(tmpdir(), "walker-"));
  try {
    const output = join(workDir, "frame.ppm");
    const args = [String(pose.x), String(pose.y), String(pose.angle), command, output];
    const { stdout } = await run(binary, args, { timeout: WALKER_TIMEOUT_MS });
    return { pose: parsePose(JSON.parse(stdout)), ppm: readFileSync(output) };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function writeGameFiles(dir: string, state: GameState, ppm: Uint8Array): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "state.json"), `${JSON.stringify(state, null, 2)}\n`);
  writeFileSync(join(dir, "frame.png"), encodePng(parsePpm(ppm)));
  for (const theme of THEME_NAMES) {
    writeFileSync(join(dir, `leaderboard-${theme}.svg`), renderLeaderboard({ palette: PALETTES[theme], state }));
  }
}

function loadState(dir: string): GameState {
  const path = join(dir, "state.json");
  return existsSync(path) ? parseState(JSON.parse(readFileSync(path, "utf8"))) : initialState();
}

async function main(): Promise<void> {
  const repository = requireEnv("GITHUB_REPOSITORY");
  if (!REPOSITORY_PATTERN.test(repository)) throw new Error("GITHUB_REPOSITORY has an unexpected format");
  const github = createGithub(requireEnv("GITHUB_TOKEN"), repository);
  const dir = process.env["GAME_DIR"] ?? DEFAULT_GAME_DIR;
  const binary = process.env["WALKER_BIN"] ?? DEFAULT_WALKER;

  const state = loadState(dir);
  if (!existsSync(join(dir, "frame.png"))) {
    writeGameFiles(dir, state, (await runWalker(binary, state.pose, "none")).ppm);
  }

  const deps: GameDependencies = {
    listIssues: () => github.listIssues(),
    runWalker: (pose, command) => runWalker(binary, pose, command),
    persist: (next, ppm) => {
      writeGameFiles(dir, next, ppm);
      return Promise.resolve();
    },
    respond: (issue, message) => github.respond(issue, message),
    now: () => new Date(),
    logError: (error) => {
      process.stderr.write(`Move failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    },
  };

  const final = await processIssues(state, deps);
  process.stdout.write(`Game state: ${String(final.totalMoves)} steps by ${String(Object.keys(final.players).length)} explorers\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Game run failed"}\n`);
  process.exitCode = 1;
});
