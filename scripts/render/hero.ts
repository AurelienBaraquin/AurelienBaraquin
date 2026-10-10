import type { LanguageShare } from "../github.js";
import type { Palette } from "../theme.js";
import { mix } from "./color.js";
import { castFrame, type GridMap, type Hit, type Pose } from "./raycast.js";
import { escapeXml, num, svgDocument } from "./svg.js";

export interface HeroOptions {
  readonly palette: Palette;
  readonly languages: readonly LanguageShare[];
  readonly name: string;
  readonly tagline: string;
}

const WIDTH = 960;
const HEIGHT = 320;
const VIEW_X = 440;
const VIEW_WIDTH = WIDTH - VIEW_X;
const COLUMNS = 65;
const FIELD_OF_VIEW = (66 * Math.PI) / 180;
const CYCLE_SECONDS = 8;
const LEGEND_SIZE = 4;
const BORDER_CELL = "1";
/** The 13px monospace tagline must stay inside the 392px text panel. */
const MAX_TAGLINE_LENGTH = 40;

/** Digits are wall types: 1 is the outer border, 2-5 take the colour of the top languages. */
const MAP: GridMap = [
  "111111111111",
  "1..........1",
  "1.22.33.44.1",
  "1.22.33.44.1",
  "1..........1",
  "1.55.22.33.1",
  "1.55.22.33.1",
  "1..........1",
  "111111111111",
];

const degrees = (value: number): number => (value * Math.PI) / 180;

const WALK: readonly Pose[] = [
  { x: 1.5, y: 1.5, angle: degrees(8) },
  { x: 2.7, y: 1.5, angle: degrees(14) },
  { x: 3.9, y: 1.5, angle: degrees(20) },
  { x: 5.1, y: 1.5, angle: degrees(12) },
  { x: 6.3, y: 1.5, angle: degrees(0) },
  { x: 7.5, y: 1.5, angle: degrees(-10) },
  { x: 8.7, y: 1.5, angle: degrees(-18) },
  { x: 9.5, y: 1.6, angle: degrees(-8) },
];

function wallColors(palette: Palette, languages: readonly LanguageShare[]): ReadonlyMap<string, string> {
  const colors = new Map<string, string>([[BORDER_CELL, palette.line]]);
  for (let index = 0; index < LEGEND_SIZE; index += 1) {
    colors.set(String(index + 2), languages[index]?.color ?? palette.signal);
  }
  return colors;
}

function shade(hit: Hit): number {
  const falloff = Math.min(1, Math.max(0.18, 1.15 - hit.distance * 0.1));
  return hit.side === "y" ? falloff * 0.78 : falloff;
}

function renderFrame(index: number, hits: readonly Hit[], palette: Palette, walls: ReadonlyMap<string, string>): string {
  const columnWidth = VIEW_WIDTH / COLUMNS;
  const rects = hits.map((hit, column) => {
    const wallHeight = Math.min(HEIGHT, HEIGHT / Math.max(hit.distance, 0.01));
    const base = walls.get(hit.cell) ?? palette.line;
    const fill = mix(palette.background, base, shade(hit));
    return `<rect x="${num(VIEW_X + column * columnWidth)}" y="${num((HEIGHT - wallHeight) / 2)}" width="${num(columnWidth + 0.4)}" height="${num(wallHeight)}" fill="${fill}"/>`;
  });
  return `<g class="f f${String(index)}">${rects.join("")}</g>`;
}

function renderLegend(palette: Palette, languages: readonly LanguageShare[]): string {
  return Array.from({ length: LEGEND_SIZE }, (_, index) => {
    const language = languages[index];
    const x = 48 + index * 96;
    const color = language?.color ?? palette.signal;
    const label = language?.name ?? "—";
    return `<rect x="${num(x)}" y="272" width="8" height="8" fill="${color}"/><text class="mono" x="${num(x + 14)}" y="280" font-size="11" fill="${palette.muted}">${escapeXml(label)}</text>`;
  }).join("");
}

export function renderHero({ palette, languages, name, tagline }: HeroOptions): string {
  if (tagline.length > MAX_TAGLINE_LENGTH) {
    throw new Error(`Hero tagline is ${String(tagline.length)} characters, the text panel fits ${String(MAX_TAGLINE_LENGTH)}`);
  }
  const walls = wallColors(palette, languages);
  const frames = WALK.map((pose, index) =>
    renderFrame(index, castFrame(MAP, pose, COLUMNS, FIELD_OF_VIEW), palette, walls),
  );
  const step = CYCLE_SECONDS / WALK.length;
  const delays = WALK.map((_, index) => `.f${String(index)}{animation-delay:${num(index * step)}s}`).join("");
  const css = [
    `.f{opacity:0;animation:walk ${String(CYCLE_SECONDS)}s steps(1,end) infinite}`,
    delays,
    `@keyframes walk{0%{opacity:1}${num(100 / WALK.length)}%{opacity:0}100%{opacity:0}}`,
    `@media (prefers-reduced-motion:reduce){.f{animation:none}.f0{opacity:1}}`,
  ].join("");

  const body = [
    `<rect x="${String(VIEW_X)}" y="0" width="${String(VIEW_WIDTH)}" height="${String(HEIGHT / 2)}" fill="${palette.surface}"/>`,
    `<rect x="${String(VIEW_X)}" y="${String(HEIGHT / 2)}" width="${String(VIEW_WIDTH)}" height="${String(HEIGHT / 2)}" fill="${mix(palette.background, palette.line, 0.35)}"/>`,
    frames.join(""),
    `<rect x="${String(VIEW_X)}" y="0" width="1" height="${String(HEIGHT)}" fill="${palette.line}"/>`,
    `<text class="mono" x="48" y="64" font-size="11" letter-spacing="2" fill="${palette.signal}">RAYCAST · ${String(COLUMNS)} RAYS · COLOURED BY MY LANGUAGES</text>`,
    `<text class="serif" x="48" y="140" font-size="46" font-weight="600" fill="${palette.text}">${escapeXml(name)}</text>`,
    `<text class="mono" x="48" y="184" font-size="13" fill="${palette.muted}">${escapeXml(tagline)}</text>`,
    renderLegend(palette, languages),
  ].join("");

  return svgDocument({
    width: WIDTH,
    height: HEIGHT,
    title: name,
    description: `${tagline}. Animated first-person walk through a corridor drawn by a raycaster, walls coloured by the languages I write most.`,
    palette,
    css,
    body,
  });
}
