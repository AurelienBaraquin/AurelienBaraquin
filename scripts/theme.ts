export type ThemeName = "dark" | "light";

export interface Palette {
  readonly background: string;
  readonly surface: string;
  readonly line: string;
  readonly text: string;
  readonly muted: string;
  readonly signal: string;
  readonly positive: string;
  readonly negative: string;
}

export const PALETTES: Readonly<Record<ThemeName, Palette>> = {
  dark: {
    background: "#0b0c0e",
    surface: "#14161a",
    line: "#2a2d33",
    text: "#e8e6e1",
    muted: "#8a8780",
    signal: "#f2a93b",
    positive: "#5fd38d",
    negative: "#ef6a5b",
  },
  light: {
    background: "#f4f1ea",
    surface: "#ebe7dd",
    line: "#cfc9ba",
    text: "#15140f",
    muted: "#6b675e",
    signal: "#b86e00",
    positive: "#1f8a52",
    negative: "#c0392b",
  },
};

export const THEME_NAMES: readonly ThemeName[] = ["dark", "light"];

export const FONT_MONO = "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace";
export const FONT_SERIF = "'Iowan Old Style', 'Palatino Linotype', Georgia, serif";

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 32,
  xl: 64,
} as const;
