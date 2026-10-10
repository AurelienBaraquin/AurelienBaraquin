import { describe, expect, it } from "vitest";
import {
  COMMAND_PREFIX,
  MAX_ISSUES_PER_RUN,
  processIssues,
  type GameDependencies,
  type GameIssue,
  type WalkerResult,
} from "./process.js";
import { initialState, START_POSE, type GameState, type MoveCommand, type Pose } from "./state.js";

const NOW = new Date("2026-10-10T12:00:00Z");
const FRAME = Uint8Array.from([1, 2, 3]);

type WalkerFn = (pose: Pose, command: MoveCommand | "none") => WalkerResult;

interface Harness {
  readonly deps: GameDependencies;
  readonly events: string[];
  readonly responses: { issue: number; message: string }[];
  readonly walkerCalls: { pose: Pose; command: MoveCommand | "none" }[];
  readonly persisted: GameState[];
  readonly errors: unknown[];
}

function harness(issues: readonly GameIssue[], walker?: WalkerFn): Harness {
  const events: string[] = [];
  const responses: Harness["responses"] = [];
  const walkerCalls: Harness["walkerCalls"] = [];
  const persisted: GameState[] = [];
  const errors: unknown[] = [];
  const defaultWalker: WalkerFn = (pose) => ({ pose: { ...pose, x: pose.x + 0.6 }, ppm: FRAME });
  const deps: GameDependencies = {
    listIssues: () => Promise.resolve(issues),
    runWalker: (pose, command) => {
      walkerCalls.push({ pose, command });
      return Promise.resolve((walker ?? defaultWalker)(pose, command));
    },
    persist: (state) => {
      events.push("persist");
      persisted.push(state);
      return Promise.resolve();
    },
    respond: (issue, message) => {
      events.push("respond");
      responses.push({ issue: issue.number, message });
      return Promise.resolve();
    },
    now: () => NOW,
    logError: (error) => {
      errors.push(error);
    },
  };
  return { deps, events, responses, walkerCalls, persisted, errors };
}

const issue = (number: number, author: string, title: string): GameIssue => ({ number, author, title });

describe("processIssues", () => {
  it("applies an accepted move through the engine and answers the player", async () => {
    const { deps, responses, walkerCalls } = harness([issue(1, "alice", "walk:forward")]);

    const state = await processIssues(initialState(), deps);

    expect(walkerCalls).toEqual([{ pose: { ...START_POSE }, command: "forward" }]);
    expect(state.pose.x).toBeCloseTo(START_POSE.x + 0.6);
    expect(state.players["alice"]?.moves).toBe(1);
    expect(responses[0]?.message).toContain("**forward**");
  });

  it("persists every accepted move before answering, so a later failure cannot lose it", async () => {
    const { deps, events, persisted } = harness([issue(1, "alice", "walk:forward"), issue(2, "bob", "walk:left")]);

    await processIssues(initialState(), deps);

    expect(events).toEqual(["persist", "respond", "persist", "respond"]);
    expect(persisted.map((state) => state.totalMoves)).toEqual([1, 2]);
  });

  it("runs each move from the position left by the previous one", async () => {
    const { deps, walkerCalls } = harness([issue(1, "alice", "walk:forward"), issue(2, "bob", "walk:forward")]);

    await processIssues(initialState(), deps);

    expect(walkerCalls[1]?.pose.x).toBeCloseTo(START_POSE.x + 0.6);
  });

  it("restarts from the starting pose on reset without moving the camera by itself", async () => {
    const moved = { ...initialState(), pose: { x: 3, y: 3, angle: 90 } };
    const { deps, walkerCalls } = harness([issue(1, "alice", "walk:reset")]);

    await processIssues(moved, deps);

    expect(walkerCalls).toEqual([{ pose: { ...START_POSE }, command: "none" }]);
  });

  it("rejects bad titles and cooldown hits without touching the engine, and still answers", async () => {
    const { deps, responses, walkerCalls, persisted } = harness([
      issue(1, "alice", "walk:forward"),
      issue(2, "alice", "walk:back"),
      issue(3, "bob", "walk:; rm -rf /"),
    ]);

    const state = await processIssues(initialState(), deps);

    expect(walkerCalls).toHaveLength(1);
    expect(persisted).toHaveLength(1);
    expect(state.totalMoves).toBe(1);
    expect(responses.map((response) => response.issue)).toEqual([1, 2, 3]);
    expect(responses[1]?.message).toContain("Slow down");
    expect(responses[2]?.message).toContain("Unknown command");
  });

  it("leaves unrelated issues completely alone", async () => {
    const { deps, responses, persisted } = harness([issue(1, "alice", "Bug: the page is slow")]);

    const state = await processIssues(initialState(), deps);

    expect(responses).toEqual([]);
    expect(persisted).toEqual([]);
    expect(state).toEqual(initialState());
  });

  it("keeps the previous state, logs the error and keeps going when the engine fails on one move", async () => {
    let call = 0;
    const { deps, responses, errors } = harness(
      [issue(1, "alice", "walk:forward"), issue(2, "bob", "walk:left")],
      (pose) => {
        call += 1;
        if (call === 1) throw new Error("engine crashed");
        return { pose, ppm: FRAME };
      },
    );

    const state = await processIssues(initialState(), deps);

    expect(state.players["alice"]).toBeUndefined();
    expect(state.players["bob"]?.moves).toBe(1);
    expect(responses[0]?.message).toContain("was not applied");
    expect(errors).toHaveLength(1);
  });

  it("does not count a move whose persistence failed", async () => {
    const { deps, responses, errors } = harness([issue(1, "alice", "walk:forward")]);
    const failing: GameDependencies = { ...deps, persist: () => Promise.reject(new Error("disk full")) };

    const state = await processIssues(initialState(), failing);

    expect(state.totalMoves).toBe(0);
    expect(errors).toHaveLength(1);
    expect(responses[0]?.message).toContain("was not applied");
  });

  it("caps the work done in a single run", async () => {
    const many = Array.from({ length: MAX_ISSUES_PER_RUN + 10 }, (_, index) =>
      issue(index + 1, `player${String(index)}`, `${COMMAND_PREFIX}left`),
    );
    const { deps, responses } = harness(many);

    await processIssues(initialState(), deps);

    expect(responses).toHaveLength(MAX_ISSUES_PER_RUN);
  });
});
