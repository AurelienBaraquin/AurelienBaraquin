import { describe, expect, it } from "vitest";
import {
  applyCommand,
  decide,
  initialState,
  isValidLogin,
  MOVE_COOLDOWN_SECONDS,
  parseCommand,
  parseState,
  RECENT_LIMIT,
  RESET_COOLDOWN_SECONDS,
  START_POSE,
  topPlayers,
} from "./state.js";

const NOW = new Date("2026-10-10T12:00:00Z");
const later = (seconds: number): Date => new Date(NOW.getTime() + seconds * 1000);
const POSE = { x: 5, y: 3, angle: 1.2 };

describe("parseCommand", () => {
  it("accepts exactly the allow-listed commands", () => {
    expect(parseCommand("walk:forward")).toBe("forward");
    expect(parseCommand("  walk:reset \n")).toBe("reset");
  });

  it.each([
    "walk:forward; rm -rf /",
    "walk:forward\nwalk:back",
    "WALK:forward",
    "walk:",
    "walk:up",
    "$(whoami)",
    "walk:forward walk:back",
    "",
  ])("rejects %j", (title) => {
    expect(parseCommand(title)).toBeNull();
  });
});

describe("isValidLogin", () => {
  it("accepts real GitHub logins", () => {
    expect(isValidLogin("AurelienBaraquin")).toBe(true);
    expect(isValidLogin("a-b-c")).toBe(true);
  });

  it.each(["", "-a", "a-", "a--b", "a_b", "__proto__", "a b", "a".repeat(40), "<script>"])("rejects %j", (login) => {
    expect(isValidLogin(login)).toBe(false);
  });
});

describe("decide", () => {
  const base = initialState();

  it("accepts a valid command from a new player", () => {
    expect(decide(base, { login: "alice", title: "walk:left", now: NOW })).toEqual({ kind: "accepted", command: "left" });
  });

  it("rejects an unknown command with a helpful reason", () => {
    const decision = decide(base, { login: "alice", title: "hello", now: NOW });

    expect(decision.kind).toBe("rejected");
  });

  it("rejects an invalid login before anything else", () => {
    const decision = decide(base, { login: "__proto__", title: "walk:left", now: NOW });

    expect(decision).toEqual({ kind: "rejected", reason: "This account name cannot be used." });
  });

  it("enforces the move cooldown per player and reports the remaining wait", () => {
    const moved = applyCommand(base, { login: "alice", command: "forward", pose: POSE, now: NOW });

    const soon = decide(moved, { login: "alice", title: "walk:back", now: later(5) });
    const other = decide(moved, { login: "bob", title: "walk:back", now: later(5) });
    const after = decide(moved, { login: "alice", title: "walk:back", now: later(MOVE_COOLDOWN_SECONDS) });

    expect(soon).toEqual({ kind: "rejected", reason: "Slow down: you can back again in 15s." });
    expect(other.kind).toBe("accepted");
    expect(after.kind).toBe("accepted");
  });

  it("uses a separate, much longer cooldown for reset", () => {
    const reset = applyCommand(base, { login: "alice", command: "reset", pose: POSE, now: NOW });

    expect(decide(reset, { login: "alice", title: "walk:reset", now: later(600) }).kind).toBe("rejected");
    expect(decide(reset, { login: "alice", title: "walk:reset", now: later(RESET_COOLDOWN_SECONDS) }).kind).toBe("accepted");
    expect(decide(reset, { login: "alice", title: "walk:forward", now: later(1) }).kind).toBe("accepted");
  });

  it("caps the wait when a stored timestamp is in the future", () => {
    const moved = applyCommand(base, { login: "alice", command: "forward", pose: POSE, now: later(10_000) });
    const decision = decide(moved, { login: "alice", title: "walk:left", now: NOW });

    expect(decision).toEqual({ kind: "rejected", reason: `Slow down: you can left again in ${String(MOVE_COOLDOWN_SECONDS)}s.` });
  });
});

describe("applyCommand", () => {
  it("returns a new state and never mutates the previous one", () => {
    const before = initialState();
    const snapshot = JSON.stringify(before);

    const after = applyCommand(before, { login: "alice", command: "forward", pose: POSE, now: NOW });

    expect(JSON.stringify(before)).toBe(snapshot);
    expect(after.pose).toEqual(POSE);
    expect(after.totalMoves).toBe(1);
    expect(after.players["alice"]?.moves).toBe(1);
  });

  it("restores the starting pose on reset and counts it as a move", () => {
    const moved = applyCommand(initialState(), { login: "alice", command: "forward", pose: POSE, now: NOW });
    const reset = applyCommand(moved, { login: "bob", command: "reset", pose: POSE, now: later(30) });

    expect(reset.pose).toEqual(START_POSE);
    expect(reset.totalMoves).toBe(2);
  });

  it("keeps only the most recent entries, newest first", () => {
    let state = initialState();
    for (let index = 0; index < RECENT_LIMIT + 3; index += 1) {
      state = applyCommand(state, { login: `p${String(index)}`, command: "left", pose: POSE, now: later(index) });
    }

    expect(state.recent).toHaveLength(RECENT_LIMIT);
    expect(state.recent[0]?.login).toBe(`p${String(RECENT_LIMIT + 2)}`);
  });
});

describe("topPlayers", () => {
  it("sorts by moves then name and honours the limit", () => {
    let state = initialState();
    for (const login of ["bob", "alice", "alice", "carol", "alice", "bob"]) {
      state = applyCommand(state, { login, command: "left", pose: POSE, now: NOW });
    }

    expect(topPlayers(state, 2)).toEqual([
      { login: "alice", moves: 3 },
      { login: "bob", moves: 2 },
    ]);
  });
});

describe("parseState", () => {
  it("round-trips a valid state", () => {
    const state = applyCommand(initialState(), { login: "alice", command: "forward", pose: POSE, now: NOW });

    expect(parseState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it("rejects a corrupted or tampered file", () => {
    expect(() => parseState({ version: 2 })).toThrow();
    expect(() => parseState({ ...initialState(), pose: { x: "1", y: 2, angle: 3 } })).toThrow();
  });
});
