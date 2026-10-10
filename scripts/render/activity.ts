import type { ContributionDay } from "../github.js";
import type { Palette } from "../theme.js";
import { mix } from "./color.js";
import { num, svgDocument } from "./svg.js";

export interface ActivityOptions {
  readonly palette: Palette;
  readonly days: readonly ContributionDay[];
}

export interface ActivityStats {
  readonly total: number;
  readonly busiestDay: number;
  readonly longestStreak: number;
}

const WIDTH = 960;
const DAYS_PER_WEEK = 7;
/** Oblique projection: weeks run along x, weekdays recede in depth (Sunday at the back). */
const WEEK_PITCH = 15;
const TILE_WIDTH = 12;
const TILE_SKEW_X = 4;
const TILE_DEPTH_Y = 7;
const ROW_PITCH = 12;
const ROW_SHIFT_X = 3;
const MAX_BAR_HEIGHT = 56;
const MIN_BAR_HEIGHT = 4;
const HEIGHT_EXPONENT = 0.8;
const LEVELS = 4;
const HEADER_Y = 56;
const SKYLINE_TOP = 84;
const FOOTER_GAP = 36;
const FOOTER_BAND = 28;
const WAVE_SECONDS_PER_WEEK = 0.018;
const FRONT_FACE_SHADOW = 0.25;
const SIDE_FACE_SHADOW = 0.5;
const BLACK = "#000000";

export function computeStats(days: readonly ContributionDay[]): ActivityStats {
  let total = 0;
  let busiestDay = 0;
  let longestStreak = 0;
  let streak = 0;
  for (const { contributionCount } of days) {
    total += contributionCount;
    busiestDay = Math.max(busiestDay, contributionCount);
    streak = contributionCount > 0 ? streak + 1 : 0;
    longestStreak = Math.max(longestStreak, streak);
  }
  return { total, busiestDay, longestStreak };
}

/** 0 for no contributions, otherwise 1..LEVELS relative to the busiest day. */
export function intensityLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.max(1, Math.ceil((count / max) * LEVELS));
}

interface Bar {
  readonly week: number;
  readonly weekday: number;
  readonly count: number;
}

function toBars(days: readonly ContributionDay[]): Bar[] {
  const bars: Bar[] = [];
  let week = -1;
  let previousWeekday = DAYS_PER_WEEK;
  for (const { date, contributionCount } of days) {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday <= previousWeekday) week += 1;
    previousWeekday = weekday;
    bars.push({ week, weekday, count: contributionCount });
  }
  return bars;
}

function polygon(points: readonly (readonly [number, number])[], fill: string): string {
  const list = points.map(([x, y]) => `${num(x)},${num(y)}`).join(" ");
  return `<polygon points="${list}" fill="${fill}"/>`;
}

export function renderActivity({ palette, days }: ActivityOptions): string {
  const stats = computeStats(days);
  const bars = toBars(days);
  const weekCount = bars.reduce((max, bar) => Math.max(max, bar.week + 1), 0);
  const spanX = Math.max(0, weekCount - 1) * WEEK_PITCH + (DAYS_PER_WEEK - 1) * ROW_SHIFT_X + TILE_WIDTH + TILE_SKEW_X;
  const originX = (WIDTH - spanX) / 2;
  const backRowY = SKYLINE_TOP + MAX_BAR_HEIGHT + TILE_DEPTH_Y;
  const frontRowY = backRowY + (DAYS_PER_WEEK - 1) * ROW_PITCH;
  const footerY = frontRowY + FOOTER_GAP;
  const height = footerY + FOOTER_BAND;
  const emptyTop = mix(palette.background, palette.line, 0.7);

  const shapes = [...bars]
    .sort((a, b) => a.weekday - b.weekday || a.week - b.week)
    .map((bar) => {
      const x = originX + bar.week * WEEK_PITCH + bar.weekday * ROW_SHIFT_X;
      const y = backRowY + bar.weekday * ROW_PITCH;
      const level = intensityLevel(bar.count, stats.busiestDay);
      const lift = level === 0 ? 0 : MIN_BAR_HEIGHT + (bar.count / stats.busiestDay) ** HEIGHT_EXPONENT * MAX_BAR_HEIGHT;
      const top = level === 0 ? emptyTop : mix(palette.line, palette.signal, 0.25 + (0.75 * level) / LEVELS);
      const topY = y - lift;
      const topFace = polygon(
        [
          [x, topY],
          [x + TILE_WIDTH, topY],
          [x + TILE_WIDTH + TILE_SKEW_X, topY - TILE_DEPTH_Y],
          [x + TILE_SKEW_X, topY - TILE_DEPTH_Y],
        ],
        top,
      );
      if (level === 0) return topFace;
      const frontFace = polygon(
        [
          [x, topY],
          [x + TILE_WIDTH, topY],
          [x + TILE_WIDTH, y],
          [x, y],
        ],
        mix(top, BLACK, FRONT_FACE_SHADOW),
      );
      const sideFace = polygon(
        [
          [x + TILE_WIDTH, topY],
          [x + TILE_WIDTH + TILE_SKEW_X, topY - TILE_DEPTH_Y],
          [x + TILE_WIDTH + TILE_SKEW_X, y - TILE_DEPTH_Y],
          [x + TILE_WIDTH, y],
        ],
        mix(top, BLACK, SIDE_FACE_SHADOW),
      );
      const delay = num(bar.week * WAVE_SECONDS_PER_WEEK);
      return `<g class="bar" style="animation-delay:${delay}s;transform-origin:${num(x + TILE_WIDTH / 2)}px ${num(y)}px">${frontFace}${sideFace}${topFace}</g>`;
    })
    .join("");

  const streakUnit = stats.longestStreak === 1 ? "day" : "days";
  const summary = `${String(stats.total)} contributions · longest streak ${String(stats.longestStreak)} ${streakUnit} · busiest day ${String(stats.busiestDay)}`;
  const css = [
    `.bar{animation:rise .7s cubic-bezier(.16,1,.3,1) both}`,
    `@keyframes rise{from{transform:scaleY(0)}}`,
    `@media (prefers-reduced-motion:reduce){.bar{animation:none}}`,
  ].join("");

  const body = [
    `<text class="mono" x="48" y="${String(HEADER_Y)}" font-size="11" letter-spacing="2" fill="${palette.signal}">ACTIVITY · LAST 12 MONTHS</text>`,
    shapes,
    `<text class="mono" x="48" y="${num(footerY)}" font-size="12" fill="${palette.muted}">${summary}</text>`,
  ].join("");

  return svgDocument({
    width: WIDTH,
    height,
    title: "Contribution skyline",
    description: `Skyline of the last twelve months of contributions, one bar per day. ${summary}.`,
    palette,
    css,
    body,
  });
}
