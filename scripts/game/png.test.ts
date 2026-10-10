import { crc32, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { encodePng, parsePpm, type RgbImage } from "./png.js";

function ppm(width: number, height: number, pixels: number[]): Uint8Array {
  return Buffer.concat([Buffer.from(`P6\n${String(width)} ${String(height)}\n255\n`, "ascii"), Buffer.from(pixels)]);
}

/** Minimal decoder: validates structure, checksums and returns the unfiltered rows. */
function decode(png: Buffer): { width: number; height: number; rows: Buffer[] } {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  let offset = 8;
  let width = 0;
  let height = 0;
  const data: Buffer[] = [];
  const types: string[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const body = png.subarray(offset + 8, offset + 8 + length);
    expect(png.readUInt32BE(offset + 8 + length)).toBe(crc32(png.subarray(offset + 4, offset + 8 + length)));
    types.push(type);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
    }
    if (type === "IDAT") data.push(body);
    offset += 12 + length;
  }
  expect(types).toEqual(["IHDR", "IDAT", "IEND"]);
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * 3 + 1;
  const rows = Array.from({ length: height }, (_, row) => raw.subarray(row * stride + 1, (row + 1) * stride));
  return { width, height, rows };
}

describe("parsePpm", () => {
  it("reads dimensions and pixel data", () => {
    const image = parsePpm(ppm(2, 1, [1, 2, 3, 4, 5, 6]));

    expect(image.width).toBe(2);
    expect(image.height).toBe(1);
    expect([...image.pixels]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it.each([
    ["wrong magic", Buffer.from("P3\n1 1\n255\n123")],
    ["truncated pixels", ppm(2, 2, [1, 2, 3])],
    ["not an image", Buffer.from("hello world")],
    ["absurd dimensions", ppm(100_000, 1, [0])],
    ["16-bit depth", Buffer.from("P6\n1 1\n65535\n123456")],
  ])("rejects %s", (_label, data) => {
    expect(() => parsePpm(data)).toThrow();
  });
});

describe("encodePng", () => {
  it("round-trips pixels through a structurally valid PNG", () => {
    const image: RgbImage = parsePpm(ppm(2, 2, [255, 0, 0, 0, 255, 0, 0, 0, 255, 10, 20, 30]));

    const decoded = decode(encodePng(image));

    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect([...(decoded.rows[0] ?? [])]).toEqual([255, 0, 0, 0, 255, 0]);
    expect([...(decoded.rows[1] ?? [])]).toEqual([0, 0, 255, 10, 20, 30]);
  });

  it("compresses a flat image far below its raw size", () => {
    const image = parsePpm(ppm(64, 64, new Array<number>(64 * 64 * 3).fill(7)));

    expect(encodePng(image).length).toBeLessThan(500);
  });
});
