// Only reproducible intermediate directories. Never source recordings or exports.
import { lstat, rm } from "node:fs/promises";
const root = new URL("../.intro-build/", import.meta.url);
for (const directory of ["clips", "screen", "render", "showcase/clips", "showcase/screen", "ending/screen", "ending/render", "before-editorial/screen", "before-editorial/render", "before-framing/screen", "before-framing/render"]) {
  const path = new URL(`${directory}/`, root);
  const stat = await lstat(path).catch(() => null);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) continue;
  await rm(path, { recursive: true });
  console.log(`Removed generated .intro-build/${directory}`);
}
