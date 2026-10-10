import { crc32, deflateSync } from "node:zlib";

export interface RgbImage {
  readonly width: number;
  readonly height: number;
  /** Tightly packed 8-bit RGB, row by row. */
  readonly pixels: Uint8Array;
}

const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PPM_HEADER = /^P6\s+(\d+)\s+(\d+)\s+255\s/;
const CHANNELS = 3;
const COLOR_TYPE_RGB = 2;
const BIT_DEPTH = 8;
const MAX_DIMENSION = 4096;

/** Parses a binary PPM (P6, 8-bit), the format the raycaster tools write. */
export function parsePpm(data: Uint8Array): RgbImage {
  const headerText = Buffer.from(data.subarray(0, 32)).toString("latin1");
  const match = PPM_HEADER.exec(headerText);
  if (match?.[1] === undefined || match[2] === undefined) {
    throw new Error("Not a binary 8-bit PPM (P6) file");
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(`Unsupported PPM dimensions ${String(width)}x${String(height)}`);
  }
  const pixels = data.subarray(match[0].length);
  if (pixels.length !== width * height * CHANNELS) {
    throw new Error("PPM pixel data does not match its declared dimensions");
  }
  return { width, height, pixels };
}

function chunk(type: string, body: Uint8Array): Buffer {
  const typeAndBody = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndBody));
  return Buffer.concat([length, typeAndBody, checksum]);
}

export function encodePng({ width, height, pixels }: RgbImage): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = BIT_DEPTH;
  header[9] = COLOR_TYPE_RGB;

  const rowBytes = width * CHANNELS;
  const raw = Buffer.alloc(height * (rowBytes + 1));
  for (let row = 0; row < height; row += 1) {
    const target = row * (rowBytes + 1);
    raw[target] = 0;
    raw.set(pixels.subarray(row * rowBytes, (row + 1) * rowBytes), target + 1);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}
