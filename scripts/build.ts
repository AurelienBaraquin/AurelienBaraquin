import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildAssets, LOGIN } from "./assets.js";
import { fetchProfileData } from "./github.js";
import { checkTargets, STATUS_TARGETS } from "./status.js";

const ASSETS_DIR = "assets";

async function main(): Promise<void> {
  const token = process.env["PROFILE_TOKEN"];
  if (token === undefined || token === "") {
    throw new Error("PROFILE_TOKEN is not set: private repositories cannot be aggregated without it");
  }

  const [data, status] = await Promise.all([fetchProfileData(token, LOGIN), checkTargets(STATUS_TARGETS)]);
  const files = buildAssets({ data, status, now: new Date() });

  rmSync(ASSETS_DIR, { recursive: true, force: true });
  for (const [path, content] of files) {
    const target = join(ASSETS_DIR, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  process.stdout.write(`Wrote ${String(files.size)} assets to ${ASSETS_DIR}/\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Build failed"}\n`);
  process.exitCode = 1;
});
