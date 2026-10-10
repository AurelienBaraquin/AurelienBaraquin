import { describe, expect, it } from "vitest";
import { castFrame, type GridMap } from "./raycast.js";

const BOX: GridMap = ["11111", "1...1", "1...1", "1...1", "11111"];

describe("castFrame", () => {
  it("measures the straight-on distance to the facing wall", () => {
    const [hit] = castFrame(BOX, { x: 2.5, y: 2.5, angle: 0 }, 1, 1);

    expect(hit?.distance).toBeCloseTo(1.5);
    expect(hit?.cell).toBe("1");
    expect(hit?.side).toBe("x");
  });

  it("reports a horizontal wall as the y side", () => {
    const [hit] = castFrame(BOX, { x: 2.5, y: 2.5, angle: Math.PI / 2 }, 1, 1);

    expect(hit?.distance).toBeCloseTo(1.5);
    expect(hit?.side).toBe("y");
  });

  it("corrects fisheye so a flat wall has a uniform perpendicular distance", () => {
    const hits = castFrame(BOX, { x: 2.5, y: 2.5, angle: 0 }, 9, 1);
    const distances = hits.map((hit) => hit.distance);

    for (const distance of distances) {
      expect(distance).toBeCloseTo(1.5, 1);
    }
  });

  it("treats everything beyond the map as wall", () => {
    const [hit] = castFrame(["...", "...", "..."], { x: 1.5, y: 1.5, angle: 0 }, 1, 1);

    expect(hit?.cell).toBe("1");
    expect(hit?.distance).toBeCloseTo(1.5);
  });

  it("returns one hit per column", () => {
    expect(castFrame(BOX, { x: 2.5, y: 2.5, angle: 0 }, 12, 1)).toHaveLength(12);
  });
});
