import { topPlayers, type GameState } from "../game/state.js";
import type { Palette } from "../theme.js";
import { escapeXml, num, svgDocument } from "./svg.js";

export interface LeaderboardOptions {
  readonly palette: Palette;
  readonly state: GameState;
}

const WIDTH = 480;
const MARGIN = 32;
const TOP_LIMIT = 5;
const RECENT_SHOWN = 5;
const TOP_ROW_PITCH = 30;
const RECENT_ROW_PITCH = 22;
const BAR_HEIGHT = 3;
const HEADER_Y = 40;
const STATS_Y = 70;
const TOP_LABEL_Y = 110;
const TOP_ROWS_Y = 134;
const BOTTOM_PADDING = 28;

function pluralise(count: number, unit: string): string {
  return `${String(count)} ${unit}${count === 1 ? "" : "s"}`;
}

function renderTop(palette: Palette, state: GameState): { markup: string; bottom: number } {
  const players = topPlayers(state, TOP_LIMIT);
  if (players.length === 0) {
    const y = TOP_ROWS_Y;
    return {
      markup: `<text class="mono" x="${String(MARGIN)}" y="${String(y)}" font-size="12" fill="${palette.muted}">No one has walked yet. Be the first.</text>`,
      bottom: y,
    };
  }
  const best = Math.max(...players.map((player) => player.moves));
  const inner = WIDTH - 2 * MARGIN;
  const markup = players
    .map((player, index) => {
      const y = TOP_ROWS_Y + index * TOP_ROW_PITCH;
      const barWidth = Math.max(2, (player.moves / best) * inner);
      return [
        `<text class="mono" x="${String(MARGIN)}" y="${String(y)}" font-size="12" fill="${palette.text}">${escapeXml(player.login)}</text>`,
        `<text class="mono" x="${String(WIDTH - MARGIN)}" y="${String(y)}" font-size="12" text-anchor="end" fill="${palette.signal}">${String(player.moves)}</text>`,
        `<rect x="${String(MARGIN)}" y="${String(y + 8)}" width="${String(inner)}" height="${String(BAR_HEIGHT)}" fill="${palette.line}"/>`,
        `<rect x="${String(MARGIN)}" y="${String(y + 8)}" width="${num(barWidth)}" height="${String(BAR_HEIGHT)}" fill="${palette.signal}"/>`,
      ].join("");
    })
    .join("");
  return { markup, bottom: TOP_ROWS_Y + (players.length - 1) * TOP_ROW_PITCH + 8 + BAR_HEIGHT };
}

function formatTime(iso: string): string {
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`;
}

export function renderLeaderboard({ palette, state }: LeaderboardOptions): string {
  const explorers = Object.keys(state.players).length;
  const stats = `${pluralise(state.totalMoves, "step")} · ${pluralise(explorers, "explorer")}`;
  const top = renderTop(palette, state);

  const recentLabelY = top.bottom + 44;
  const recent = state.recent.slice(0, RECENT_SHOWN);
  const recentMarkup = recent
    .map((entry, index) => {
      const y = recentLabelY + 24 + index * RECENT_ROW_PITCH;
      return [
        `<text class="mono" x="${String(MARGIN)}" y="${String(y)}" font-size="11" fill="${palette.muted}">${escapeXml(`${entry.login} · ${entry.command}`)}</text>`,
        `<text class="mono" x="${String(WIDTH - MARGIN)}" y="${String(y)}" font-size="11" text-anchor="end" fill="${palette.muted}">${escapeXml(formatTime(entry.at))} UTC</text>`,
      ].join("");
    })
    .join("");
  const height = recentLabelY + 24 + Math.max(0, recent.length - 1) * RECENT_ROW_PITCH + BOTTOM_PADDING;

  const body = [
    `<text class="mono" x="${String(MARGIN)}" y="${String(HEADER_Y)}" font-size="11" letter-spacing="2" fill="${palette.signal}">WALK THE CORRIDOR</text>`,
    `<text class="serif" x="${String(MARGIN)}" y="${String(STATS_Y)}" font-size="20" font-weight="600" fill="${palette.text}">${escapeXml(stats)}</text>`,
    `<text class="mono" x="${String(MARGIN)}" y="${String(TOP_LABEL_Y)}" font-size="10" letter-spacing="2" fill="${palette.muted}">TOP EXPLORERS</text>`,
    top.markup,
    `<text class="mono" x="${String(MARGIN)}" y="${String(recentLabelY)}" font-size="10" letter-spacing="2" fill="${palette.muted}">LATEST STEPS</text>`,
    recentMarkup,
  ].join("");

  return svgDocument({
    width: WIDTH,
    height,
    title: "Walk the corridor leaderboard",
    description: `${stats}. Top explorers: ${
      topPlayers(state, TOP_LIMIT)
        .map((player) => `${player.login} ${String(player.moves)}`)
        .join(", ") || "none yet"
    }.`,
    palette,
    body,
  });
}
