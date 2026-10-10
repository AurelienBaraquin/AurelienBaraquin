import type { LanguageShare, Repository } from "../github.js";
import type { Palette } from "../theme.js";
import { escapeXml, num, svgDocument } from "./svg.js";

export interface TerminalOptions {
  readonly palette: Palette;
  readonly name: string;
  readonly login: string;
  readonly repositories: readonly Repository[];
  readonly totalContributions: number;
  readonly languages: readonly LanguageShare[];
}

export interface TerminalLine {
  readonly kind: "command" | "output";
  readonly text: string;
}

const WIDTH = 960;
const FONT_SIZE = 14;
const CHAR_WIDTH = FONT_SIZE * 0.6;
const LINE_HEIGHT = 26;
const TEXT_X = 48;
const FIRST_BASELINE = 112;
const BOTTOM_PADDING = 40;
const TOP_LANGUAGES = 4;
const COMMAND_SECONDS_PER_CHAR = 0.045;
const OUTPUT_SECONDS_PER_CHAR = 0.012;
const MIN_LINE_SECONDS = 0.2;
const PAUSE_SECONDS = 0.35;
/** Extra steps so the cover always slides past the end of the text, whatever the fallback font width. */
const OVERSHOOT_CHARS = 8;
const PROMPT = "$ ";

function formatShare(share: number): string {
  return `${String(Math.round(share * 100))}%`;
}

function latestPush(repositories: readonly Repository[]): string {
  const dates = repositories.flatMap((repository) => (repository.pushedAt === null ? [] : [repository.pushedAt]));
  const latest = dates.reduce((a, b) => (a > b ? a : b), "");
  return latest === "" ? "never" : latest.slice(0, 10);
}

export function buildTerminalLines(options: TerminalOptions): TerminalLine[] {
  const { name, login, repositories, totalContributions, languages } = options;
  const publicCount = repositories.filter((repository) => !repository.isPrivate).length;
  const stack = languages
    .slice(0, TOP_LANGUAGES)
    .map((language) => `${language.name} ${formatShare(language.share)}`)
    .join(" · ");

  return [
    { kind: "command", text: "whoami" },
    { kind: "output", text: `${name} · github.com/${login}` },
    { kind: "command", text: "ls ~/repos | wc -l" },
    { kind: "output", text: `${String(repositories.length)} repositories, ${String(publicCount)} public` },
    { kind: "command", text: 'git log --since="1 year ago" | grep -c commit' },
    { kind: "output", text: `${String(totalContributions)} contributions in the last year` },
    { kind: "command", text: `lang --top ${String(TOP_LANGUAGES)}` },
    { kind: "output", text: stack === "" ? "no language data" : stack },
    { kind: "command", text: "git log -1 --format=%cd --date=short" },
    { kind: "output", text: `last push ${latestPush(repositories)}` },
  ];
}

interface TimedLine {
  readonly line: TerminalLine;
  readonly steps: number;
  readonly seconds: number;
  readonly delay: number;
}

function schedule(lines: readonly TerminalLine[]): { readonly timed: TimedLine[]; readonly end: number } {
  const timed: TimedLine[] = [];
  let clock = 0.4;
  for (const line of lines) {
    const characters = (line.kind === "command" ? PROMPT.length : 0) + line.text.length;
    const rate = line.kind === "command" ? COMMAND_SECONDS_PER_CHAR : OUTPUT_SECONDS_PER_CHAR;
    const seconds = Math.max(MIN_LINE_SECONDS, characters * rate);
    timed.push({ line, steps: characters + OVERSHOOT_CHARS, seconds, delay: clock });
    clock += seconds + (line.kind === "command" ? PAUSE_SECONDS : 0.1);
  }
  return { timed, end: clock };
}

function renderLine({ line, steps, seconds, delay }: TimedLine, index: number, palette: Palette): string {
  const y = FIRST_BASELINE + index * LINE_HEIGHT;
  const isCommand = line.kind === "command";
  const text = isCommand
    ? `<tspan fill="${palette.signal}">${PROMPT}</tspan><tspan fill="${palette.text}">${escapeXml(line.text)}</tspan>`
    : `<tspan fill="${palette.muted}">${escapeXml(line.text)}</tspan>`;
  const distance = steps * CHAR_WIDTH;
  const animation = `animation:type ${num(seconds)}s steps(${String(steps)},end) ${num(delay)}s forwards`;
  return [
    `<text class="mono" xml:space="preserve" x="${String(TEXT_X)}" y="${String(y)}" font-size="${String(FONT_SIZE)}">${text}</text>`,
    `<rect class="cover" x="${String(TEXT_X - 2)}" y="${String(y - FONT_SIZE - 2)}" width="${num(WIDTH - TEXT_X)}" height="${String(LINE_HEIGHT - 2)}" fill="${palette.surface}" style="--dx:${num(distance)}px;${animation}"/>`,
  ].join("");
}

export function renderTerminal(options: TerminalOptions): string {
  const { palette } = options;
  const lines = buildTerminalLines(options);
  const { timed, end } = schedule(lines);
  const promptY = FIRST_BASELINE + lines.length * LINE_HEIGHT;
  const height = promptY + BOTTOM_PADDING;
  const cursorX = TEXT_X + PROMPT.length * CHAR_WIDTH;

  const css = [
    `@keyframes type{to{transform:translateX(var(--dx))}}`,
    `@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}`,
    `.cursor{opacity:0;animation:blink 1.1s steps(1,end) ${num(end)}s infinite}`,
    `@media (prefers-reduced-motion:reduce){.cover{display:none}.cursor{animation:none;opacity:1}}`,
  ].join("");

  const body = [
    `<rect x="16" y="16" width="${String(WIDTH - 32)}" height="${String(height - 32)}" rx="10" fill="${palette.surface}" stroke="${palette.line}"/>`,
    `<circle cx="42" cy="42" r="5" fill="${palette.line}"/><circle cx="60" cy="42" r="5" fill="${palette.line}"/><circle cx="78" cy="42" r="5" fill="${palette.signal}"/>`,
    `<text class="mono" x="${String(WIDTH / 2)}" y="46" font-size="11" text-anchor="middle" fill="${palette.muted}">${escapeXml(options.login)}@signal: ~</text>`,
    `<clipPath id="panel"><rect x="17" y="17" width="${String(WIDTH - 34)}" height="${String(height - 34)}" rx="9"/></clipPath>`,
    `<g clip-path="url(#panel)">${timed.map((entry, index) => renderLine(entry, index, palette)).join("")}</g>`,
    `<text class="mono" xml:space="preserve" x="${String(TEXT_X)}" y="${String(promptY)}" font-size="${String(FONT_SIZE)}" fill="${palette.signal}">${PROMPT}</text>`,
    `<rect class="cursor" x="${num(cursorX)}" y="${String(promptY - FONT_SIZE + 2)}" width="${num(CHAR_WIDTH)}" height="${String(FONT_SIZE)}" fill="${palette.signal}"/>`,
  ].join("");

  return svgDocument({
    width: WIDTH,
    height,
    title: `${options.name} — terminal`,
    description: lines.map((line) => line.text).join(". "),
    palette,
    css,
    body,
  });
}
