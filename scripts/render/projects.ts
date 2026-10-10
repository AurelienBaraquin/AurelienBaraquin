import type { ResolvedProject } from "../curation.js";
import type { Repository } from "../github.js";
import type { Palette } from "../theme.js";
import { escapeXml, num, svgDocument } from "./svg.js";

const FOOTER_CHAR_WIDTH = 11 * 0.6;

export interface ProjectCardOptions {
  readonly palette: Palette;
  readonly project: ResolvedProject;
  /** Reference time, passed in so rendering stays deterministic. */
  readonly now: Date;
}

const WIDTH = 440;
const HEIGHT = 136;
const PADDING = 24;
const BLURB_CHARS = 56;
const BLURB_LINES = 2;
const RECENT_DAYS = 30;
const MS_PER_DAY = 86_400_000;

/** Greedy word wrap; the last allowed line ends with an ellipsis when text is cut. */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = "";
  const words = text.split(/\s+/).filter((word) => word !== "");

  for (const [index, word] of words.entries()) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (lines.length === maxLines - 1) {
      const rest = words.slice(index).join(" ");
      const truncated = `${current === "" ? "" : `${current} `}${rest}`;
      lines.push(`${truncated.slice(0, maxChars - 1).trimEnd()}…`);
      return lines;
    }
    lines.push(current);
    current = word;
  }
  if (current !== "") lines.push(current);
  return lines;
}

function languageColor(repository: Repository, palette: Palette): string {
  const name = repository.primaryLanguage?.name;
  const edge = repository.languages.edges.find((candidate) => candidate.node.name === name);
  return edge?.node.color ?? palette.muted;
}

function isRecent(pushedAt: string | null, now: Date): boolean {
  if (pushedAt === null) return false;
  return now.getTime() - new Date(pushedAt).getTime() <= RECENT_DAYS * MS_PER_DAY;
}

export function renderProjectCard({ palette, project, now }: ProjectCardOptions): string {
  const { repository, blurb } = project;
  const accent = languageColor(repository, palette);
  const recent = isRecent(repository.pushedAt, now);
  const pushed = repository.pushedAt === null ? "never" : repository.pushedAt.slice(0, 7);
  const stars = repository.stargazerCount > 0 ? `★ ${String(repository.stargazerCount)}   ` : "";
  const footerY = HEIGHT - 24;
  const footerText = `${stars}pushed ${pushed}`;
  const activityX = WIDTH - PADDING - footerText.length * FOOTER_CHAR_WIDTH - 12;

  const blurbLines = wrapText(blurb, BLURB_CHARS, BLURB_LINES)
    .map(
      (line, index) =>
        `<text class="serif" x="${String(PADDING)}" y="${String(66 + index * 20)}" font-size="14" fill="${palette.muted}">${escapeXml(line)}</text>`,
    )
    .join("");

  const language =
    repository.primaryLanguage === null
      ? ""
      : `<circle cx="${String(PADDING + 4)}" cy="${String(footerY - 4)}" r="4" fill="${accent}"/><text class="mono" x="${String(PADDING + 16)}" y="${String(footerY)}" font-size="11" fill="${palette.muted}">${escapeXml(repository.primaryLanguage.name)}</text>`;

  const activity = recent
    ? `<circle class="ring" cx="${num(activityX)}" cy="${String(footerY - 4)}" r="3" fill="none" stroke="${palette.signal}"/><circle cx="${num(activityX)}" cy="${String(footerY - 4)}" r="3" fill="${palette.signal}"/>`
    : "";

  const css = [
    `.ring{transform-box:fill-box;transform-origin:center;animation:pulse 2.2s ease-out infinite}`,
    `@keyframes pulse{from{opacity:.9;transform:scale(1)}to{opacity:0;transform:scale(3)}}`,
    `@media (prefers-reduced-motion:reduce){.ring{animation:none;opacity:0}}`,
  ].join("");

  const body = [
    `<rect x="0.5" y="0.5" width="${String(WIDTH - 1)}" height="${String(HEIGHT - 1)}" rx="10" fill="${palette.surface}" stroke="${palette.line}"/>`,
    `<rect x="0.5" y="22" width="3" height="28" fill="${accent}"/>`,
    `<text class="mono" x="${String(PADDING)}" y="42" font-size="15" font-weight="700" fill="${palette.text}">${escapeXml(repository.name)}</text>`,
    blurbLines,
    language,
    activity,
    `<text class="mono" x="${String(WIDTH - PADDING)}" y="${String(footerY)}" font-size="11" text-anchor="end" fill="${palette.muted}">${escapeXml(footerText)}</text>`,
  ].join("");

  return svgDocument({
    width: WIDTH,
    height: HEIGHT,
    title: repository.name,
    description: `${blurb} ${repository.primaryLanguage?.name ?? ""}`.trim(),
    palette,
    css,
    body,
  });
}
