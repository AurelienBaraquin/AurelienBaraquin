import { resolveCuratedWork, SELECTED_WORK } from "./curation.js";
import { aggregateLanguages, type ProfileData } from "./github.js";
import { renderActivity } from "./render/activity.js";
import { renderHero } from "./render/hero.js";
import { renderLanguages } from "./render/languages.js";
import { renderProjectCard } from "./render/projects.js";
import { renderStatus } from "./render/status.js";
import { renderTerminal } from "./render/terminal.js";
import type { StatusResult } from "./status.js";
import { PALETTES, THEME_NAMES } from "./theme.js";

export const LOGIN = "AurelienBaraquin";
export const DISPLAY_NAME = "Aurélien Baraquin";
export const TAGLINE = "Systems programmer · built from scratch";

export interface BuildInput {
  readonly data: ProfileData;
  readonly status: readonly StatusResult[];
  readonly now: Date;
}

/** Maps each output path (relative to the assets folder) to its SVG content. */
export function buildAssets({ data, status, now }: BuildInput): ReadonlyMap<string, string> {
  const languages = aggregateLanguages(data.repositories);
  const groups = resolveCuratedWork(SELECTED_WORK, data.repositories);
  const files = new Map<string, string>();

  for (const theme of THEME_NAMES) {
    const palette = PALETTES[theme];
    files.set(`hero-${theme}.svg`, renderHero({ palette, languages, name: DISPLAY_NAME, tagline: TAGLINE }));
    files.set(
      `terminal-${theme}.svg`,
      renderTerminal({
        palette,
        name: DISPLAY_NAME,
        login: LOGIN,
        repositories: data.repositories,
        totalContributions: data.totalContributions,
        languages,
      }),
    );
    files.set(
      `languages-${theme}.svg`,
      renderLanguages({ palette, languages, repositoryCount: data.repositories.length }),
    );
    files.set(`activity-${theme}.svg`, renderActivity({ palette, days: data.contributionDays }));
    files.set(`status-${theme}.svg`, renderStatus({ palette, results: status, checkedAt: now }));
    for (const group of groups) {
      for (const project of group.projects) {
        files.set(`cards/${project.repository.name}-${theme}.svg`, renderProjectCard({ palette, project, now }));
      }
    }
  }
  return files;
}
