import { describe, expect, it } from "vitest";
import { applyCommand, initialState, type GameState } from "../game/state.js";
import { PALETTES } from "../theme.js";
import { renderLeaderboard } from "./leaderboard.js";

const POSE = { x: 5, y: 3, angle: 1 };

function play(logins: readonly string[]): GameState {
  let state = initialState();
  logins.forEach((login, index) => {
    state = applyCommand(state, { login, command: "forward", pose: POSE, now: new Date(Date.UTC(2026, 9, 10, 12, index)) });
  });
  return state;
}

describe("renderLeaderboard", () => {
  it("invites the first visitor when nobody has played", () => {
    const svg = renderLeaderboard({ palette: PALETTES.dark, state: initialState() });

    expect(svg).toContain("No one has walked yet. Be the first.");
    expect(svg).toContain("0 steps · 0 explorers");
  });

  it("ranks explorers by steps and pluralises correctly", () => {
    const svg = renderLeaderboard({ palette: PALETTES.light, state: play(["bob", "alice", "alice"]) });

    expect(svg).toContain("3 steps · 2 explorers");
    expect(svg.indexOf(">alice<")).toBeLessThan(svg.indexOf(">bob<"));
  });

  it("uses singular wording for a single step by a single explorer", () => {
    expect(renderLeaderboard({ palette: PALETTES.dark, state: play(["solo"]) })).toContain("1 step · 1 explorer");
  });

  it("lists only the five most recent steps, newest first, in UTC", () => {
    const svg = renderLeaderboard({
      palette: PALETTES.dark,
      state: play(["p1", "p2", "p3", "p4", "p5", "p6", "p7"]),
    });

    expect(svg).toContain("p7 · forward");
    expect(svg).toContain("10-10 12:06 UTC");
    expect(svg).not.toContain("p1 · forward");
  });

  it("escapes anything that reaches the markup and stays self-contained", () => {
    const state = applyCommand(initialState(), { login: "<b>x</b>", command: "left", pose: POSE, now: new Date() });
    const svg = renderLeaderboard({ palette: PALETTES.dark, state });

    expect(svg).not.toContain("<b>x</b>");
    expect(svg).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(svg).not.toMatch(/<script|href=|url\(http|@import/);
  });
});
