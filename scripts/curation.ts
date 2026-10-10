import type { Repository } from "./github.js";

export interface CuratedRepo {
  readonly name: string;
  /** Overrides the GitHub description, which is empty or too terse on several repositories. */
  readonly blurb?: string;
}

export interface CuratedGroup {
  readonly title: string;
  readonly repos: readonly CuratedRepo[];
}

export interface ResolvedGroup {
  readonly title: string;
  readonly projects: readonly ResolvedProject[];
}

export interface ResolvedProject {
  readonly repository: Repository;
  readonly blurb: string;
}

export const SELECTED_WORK: readonly CuratedGroup[] = [
  {
    title: "Systems",
    repos: [
      { name: "nlc" },
      { name: "CLPF" },
      { name: "malloc_for_myOS" },
      { name: "CloudFUSEStream", blurb: "Network filesystem over FUSE: mount, manage and sync cloud files." },
      { name: "How-to-write-a-Linux-syscall-in-C", blurb: "Step-by-step guide to adding a system call to the Linux kernel." },
    ],
  },
  {
    title: "Emulation and games",
    repos: [
      {
        name: "raycaster",
        blurb: "Software raycaster in Rust with sectors, doors and lighting. Native and WebAssembly front-ends.",
      },
      { name: "GameBoy_Emulator" },
      { name: "nes_rust_emulator", blurb: "NES emulator written in Rust." },
      { name: "NESCARGOT" },
    ],
  },
  {
    title: "Tooling and AI",
    repos: [
      { name: "claude-project-kit" },
      {
        name: "chinese_notebook",
        blurb: "Client-side Markdown notebook for learning Chinese, with a WebAssembly CC-CEDICT dictionary.",
      },
      {
        name: "my-infra",
        blurb: "Infrastructure as code for aurelienb.com: Docker Compose, Nginx, submodules, Tailscale.",
      },
    ],
  },
  {
    title: "Web",
    repos: [
      { name: "portfolio", blurb: "Personal portfolio at aurelienb.com. Next.js 16, React 19, Tailwind CSS." },
      { name: "miku-teto-ui", blurb: "3D Miku and Teto showcase. Next.js, Three.js, GSAP." },
    ],
  },
];

/**
 * Joins the curated list with live repository data. A curated repository that is missing or not public
 * fails the build, so a private repository name can never reach a public asset by mistake.
 */
export function resolveCuratedWork(
  groups: readonly CuratedGroup[],
  repositories: readonly Repository[],
): ResolvedGroup[] {
  const byName = new Map(repositories.map((repository) => [repository.name, repository]));

  return groups.map((group) => ({
    title: group.title,
    projects: group.repos.map(({ name, blurb }) => {
      const repository = byName.get(name);
      if (repository === undefined || repository.isPrivate) {
        throw new Error(`Curated repository "${name}" is missing or not public`);
      }
      return { repository, blurb: blurb ?? repository.description ?? "" };
    }),
  }));
}
