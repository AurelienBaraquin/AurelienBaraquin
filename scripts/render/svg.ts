import { FONT_MONO, FONT_SERIF, type Palette } from "../theme.js";

export interface SvgDocumentOptions {
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly description: string;
  readonly palette: Palette;
  readonly css?: string;
  readonly body: string;
}

const XML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => XML_ESCAPES[character] ?? character);
}

/** Rounds to one decimal and drops a trailing ".0" to keep the SVG small. */
export function num(value: number): string {
  return String(Math.round(value * 10) / 10);
}

export function svgDocument(options: SvgDocumentOptions): string {
  const { width, height, title, description, palette, css = "", body } = options;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}" height="${num(height)}" viewBox="0 0 ${num(width)} ${num(height)}" role="img" aria-labelledby="t d">`,
    `<title id="t">${escapeXml(title)}</title>`,
    `<desc id="d">${escapeXml(description)}</desc>`,
    `<style>`,
    `.mono{font-family:${FONT_MONO}}`,
    `.serif{font-family:${FONT_SERIF}}`,
    css,
    `</style>`,
    `<rect width="${num(width)}" height="${num(height)}" fill="${palette.background}"/>`,
    body,
    `</svg>`,
  ].join("\n");
}
