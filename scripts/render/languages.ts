import type { LanguageShare } from "../github.js";
import type { Palette } from "../theme.js";
import { escapeXml, num, svgDocument } from "./svg.js";

export interface LanguagesOptions {
  readonly palette: Palette;
  readonly languages: readonly LanguageShare[];
  readonly repositoryCount: number;
}

const WIDTH = 960;
const MARGIN = 48;
const BAR_Y = 96;
const BAR_HEIGHT = 24;
const BAR_GAP = 3;
const MIN_SEGMENT_WIDTH = 3;
const TILE_COLUMNS = 4;
const TILE_ROWS = 2;
const TILE_COUNT = TILE_COLUMNS * TILE_ROWS;
const TILE_GAP = 12;
const TILE_HEIGHT = 80;
const TILES_Y = 150;
const MIN_OTHER_SHARE = 0.005;
const CAPTION_BAND = 56;
const HEIGHT = TILES_Y + TILE_ROWS * (TILE_HEIGHT + TILE_GAP) - TILE_GAP + CAPTION_BAND;

export function formatPercent(share: number): string {
  const percent = share * 100;
  return `${percent >= 10 ? String(Math.round(percent)) : percent.toFixed(1)}%`;
}

function colorOf(language: LanguageShare, palette: Palette): string {
  return language.color ?? palette.muted;
}

function renderBar(palette: Palette, shown: readonly LanguageShare[], otherShare: number): string {
  const segments: { readonly color: string; readonly share: number; readonly label: string }[] = shown.map(
    (language) => ({ color: colorOf(language, palette), share: language.share, label: language.name }),
  );
  if (otherShare >= MIN_OTHER_SHARE) {
    segments.push({ color: palette.line, share: otherShare, label: "other" });
  }

  const innerWidth = WIDTH - 2 * MARGIN;
  const available = innerWidth - BAR_GAP * (segments.length - 1);
  let cursor = MARGIN;
  return segments
    .map((segment, index) => {
      const width = Math.max(MIN_SEGMENT_WIDTH, segment.share * available);
      const rect = `<rect class="seg" style="animation-delay:${num(index * 0.07)}s" x="${num(cursor)}" y="${String(BAR_Y)}" width="${num(width)}" height="${String(BAR_HEIGHT)}" rx="3" fill="${segment.color}"><title>${escapeXml(segment.label)} ${formatPercent(segment.share)}</title></rect>`;
      cursor += width + BAR_GAP;
      return rect;
    })
    .join("");
}

function renderTile(palette: Palette, language: LanguageShare, index: number): string {
  const tileWidth = (WIDTH - 2 * MARGIN - (TILE_COLUMNS - 1) * TILE_GAP) / TILE_COLUMNS;
  const x = MARGIN + (index % TILE_COLUMNS) * (tileWidth + TILE_GAP);
  const y = TILES_Y + Math.floor(index / TILE_COLUMNS) * (TILE_HEIGHT + TILE_GAP);
  const meterWidth = tileWidth - 32;
  const color = colorOf(language, palette);
  return [
    `<rect x="${num(x)}" y="${num(y)}" width="${num(tileWidth)}" height="${String(TILE_HEIGHT)}" rx="8" fill="${palette.surface}" stroke="${palette.line}"/>`,
    `<rect x="${num(x + 16)}" y="${num(y + 18)}" width="8" height="8" fill="${color}"/>`,
    `<text class="mono" x="${num(x + 32)}" y="${num(y + 26)}" font-size="12" fill="${palette.muted}">${escapeXml(language.name)}</text>`,
    `<text class="serif" x="${num(x + 16)}" y="${num(y + 58)}" font-size="28" font-weight="600" fill="${palette.text}">${formatPercent(language.share)}</text>`,
    `<rect x="${num(x + 16)}" y="${num(y + TILE_HEIGHT - 10)}" width="${num(meterWidth)}" height="2" fill="${palette.line}"/>`,
    `<rect x="${num(x + 16)}" y="${num(y + TILE_HEIGHT - 10)}" width="${num(Math.max(2, meterWidth * language.share))}" height="2" fill="${color}"/>`,
  ].join("");
}

export function renderLanguages({ palette, languages, repositoryCount }: LanguagesOptions): string {
  const shown = languages.slice(0, TILE_COUNT);
  const otherShare = languages.slice(TILE_COUNT).reduce((sum, language) => sum + language.share, 0);
  const caption = `${String(repositoryCount)} repositories, private ones included. Only the aggregate is shown, never a name.`;

  const css = [
    `.seg{transform-box:fill-box;transform-origin:left center;animation:grow .9s cubic-bezier(.16,1,.3,1) both}`,
    `@keyframes grow{from{transform:scaleX(0)}}`,
    `@media (prefers-reduced-motion:reduce){.seg{animation:none}}`,
  ].join("");

  const body = [
    `<text class="mono" x="${String(MARGIN)}" y="64" font-size="11" letter-spacing="2" fill="${palette.signal}">STACK · WHAT I ACTUALLY WRITE</text>`,
    shown.length === 0
      ? `<text class="mono" x="${String(MARGIN)}" y="${String(BAR_Y + 16)}" font-size="13" fill="${palette.muted}">No language data yet.</text>`
      : renderBar(palette, shown, otherShare),
    shown.map((language, index) => renderTile(palette, language, index)).join(""),
    `<text class="mono" x="${String(MARGIN)}" y="${String(HEIGHT - 20)}" font-size="11" fill="${palette.muted}">${escapeXml(caption)}</text>`,
  ].join("");

  return svgDocument({
    width: WIDTH,
    height: HEIGHT,
    title: "Language mix",
    description: `${caption} ${shown.map((language) => `${language.name} ${formatPercent(language.share)}`).join(", ")}.`,
    palette,
    css,
    body,
  });
}
