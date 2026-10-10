import type { StatusResult } from "../status.js";
import type { Palette } from "../theme.js";
import { escapeXml, num, svgDocument } from "./svg.js";

export interface StatusOptions {
  readonly palette: Palette;
  readonly results: readonly StatusResult[];
  readonly checkedAt: Date;
}

const WIDTH = 960;
const MARGIN = 48;
const CELL_GAP = 12;
const CELL_Y = 68;
const CELL_HEIGHT = 80;
const CELL_PADDING = 20;
const SMALL_CHAR_WIDTH = 11 * 0.6;
const CAPTION_GAP = 28;
const BOTTOM_PADDING = 24;

export function describeResult(result: StatusResult): string {
  if (result.ok && result.latencyMs !== null) return `up · ${String(result.latencyMs)} ms`;
  if (result.status !== null) return `down · HTTP ${String(result.status)}`;
  return `down · ${result.failure ?? "error"}`;
}

function formatTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function assertFits(text: string, cellWidth: number): void {
  const available = cellWidth - 2 * CELL_PADDING;
  if (text.length * SMALL_CHAR_WIDTH > available) {
    throw new Error(`Status text "${text}" does not fit a ${num(cellWidth)}px cell`);
  }
}

function renderCell(palette: Palette, result: StatusResult, index: number, cellWidth: number): string {
  const state = describeResult(result);
  assertFits(result.host, cellWidth);
  assertFits(state, cellWidth);
  const x = MARGIN + index * (cellWidth + CELL_GAP);
  const color = result.ok ? palette.positive : palette.negative;
  const dotX = x + 20;
  const dotY = CELL_Y + 22;
  const ring = result.ok
    ? `<circle class="ring" cx="${num(dotX)}" cy="${num(dotY)}" r="4" fill="none" stroke="${color}"/>`
    : "";
  return [
    `<rect x="${num(x)}" y="${String(CELL_Y)}" width="${num(cellWidth)}" height="${String(CELL_HEIGHT)}" rx="8" fill="${palette.surface}" stroke="${palette.line}"/>`,
    ring,
    `<circle cx="${num(dotX)}" cy="${num(dotY)}" r="4" fill="${color}"/>`,
    `<text class="mono" x="${num(x + 34)}" y="${num(dotY + 4)}" font-size="13" font-weight="700" fill="${palette.text}">${escapeXml(result.name)}</text>`,
    `<text class="mono" x="${num(x + CELL_PADDING)}" y="${num(CELL_Y + 48)}" font-size="11" fill="${palette.muted}">${escapeXml(result.host)}</text>`,
    `<text class="mono" x="${num(x + CELL_PADDING)}" y="${num(CELL_Y + 66)}" font-size="11" fill="${color}">${escapeXml(state)}</text>`,
  ].join("");
}

export function renderStatus({ palette, results, checkedAt }: StatusOptions): string {
  const count = Math.max(1, results.length);
  const cellWidth = (WIDTH - 2 * MARGIN - (count - 1) * CELL_GAP) / count;
  const captionY = CELL_Y + CELL_HEIGHT + CAPTION_GAP;
  const height = captionY + BOTTOM_PADDING;
  const upCount = results.filter((result) => result.ok).length;
  const summary = `${String(upCount)} of ${String(results.length)} sites up at ${formatTimestamp(checkedAt)}`;

  const css = [
    `.ring{transform-box:fill-box;transform-origin:center;animation:ping 2.4s ease-out infinite}`,
    `@keyframes ping{from{opacity:.9;transform:scale(1)}to{opacity:0;transform:scale(3.2)}}`,
    `@media (prefers-reduced-motion:reduce){.ring{animation:none;opacity:0}}`,
  ].join("");

  const body = [
    `<text class="mono" x="${String(MARGIN)}" y="44" font-size="11" letter-spacing="2" fill="${palette.signal}">STATUS · SELF-HOSTED</text>`,
    results.map((result, index) => renderCell(palette, result, index, cellWidth)).join(""),
    `<text class="mono" x="${String(MARGIN)}" y="${num(captionY)}" font-size="11" fill="${palette.muted}">${escapeXml(`${summary} · snapshot taken when this profile was last rebuilt, not a live feed`)}</text>`,
  ].join("");

  return svgDocument({
    width: WIDTH,
    height,
    title: "Site status",
    description: `${summary}. ${results.map((result) => `${result.name}: ${describeResult(result)}`).join(". ")}.`,
    palette,
    css,
    body,
  });
}
