const HEX_PATTERN = /^#([0-9a-f]{6})$/i;

type Rgb = readonly [number, number, number];

function parseHex(hex: string): Rgb {
  const match = HEX_PATTERN.exec(hex);
  if (match?.[1] === undefined) {
    throw new Error(`Expected a #rrggbb colour, received "${hex}"`);
  }
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function toHex([red, green, blue]: Rgb): string {
  const channel = (value: number): string => Math.round(value).toString(16).padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

/** Linear mix of two #rrggbb colours: `ratio` 0 returns `from`, 1 returns `to`. */
export function mix(from: string, to: string, ratio: number): string {
  const t = Math.min(1, Math.max(0, ratio));
  const [fromRed, fromGreen, fromBlue] = parseHex(from);
  const [toRed, toGreen, toBlue] = parseHex(to);
  return toHex([
    fromRed + (toRed - fromRed) * t,
    fromGreen + (toGreen - fromGreen) * t,
    fromBlue + (toBlue - fromBlue) * t,
  ]);
}
