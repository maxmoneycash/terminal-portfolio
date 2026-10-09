// Only reproducible intermediates. Never source recordings, masters, or published exports.
import { lstat, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = new URL("../.intro-build/", import.meta.url);
for (const directory of ["film/public", "film/bundle", "film/chunks", "film/publish"]) {
  const target = new URL(`${directory}/`, root);
  const stat = await lstat(target).catch(() => null);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) continue;
  await rm(target, { recursive: true });
  console.log(`Removed generated .intro-build/${directory}`);
}

// Each Remotion render copies the ~0.5 GB public folder into a temp bundle.
for (const name of await readdir(tmpdir()).catch(() => [])) {
  if (!name.startsWith("remotion-webpack-bundle-") && !name.startsWith("remotion-v4")) continue;
  await rm(path.join(tmpdir(), name), { recursive: true, force: true });
  console.log(`Removed ${name} from the temp folder`);
}
