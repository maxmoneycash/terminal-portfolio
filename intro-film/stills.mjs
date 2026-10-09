// Render review stills without re-bundling for every frame.
// Usage: node stills.mjs <landscape|portrait> <outDir> <frame> [frame...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [orient, outDir, ...frames] = process.argv.slice(2);
const id = orient === "portrait" ? "IntroPortrait" : "IntroLandscape";
const scale = orient === "portrait" ? 2 : 1.5;

// One reused bundle directory: each bundle copies the ~0.5 GB public folder.
const serveUrl = await bundle({
  entryPoint: path.join(here, "src/index.ts"),
  publicDir: path.join(here, "../.intro-build/film/public"),
  outDir: path.join(here, "../.intro-build/film/bundle"),
});
const composition = await selectComposition({ serveUrl, id });
for (const f of frames) {
  const output = path.join(outDir, `${orient[0].toUpperCase()}_${String(f).padStart(4, "0")}.png`);
  await renderStill({ composition, serveUrl, output, frame: Number(f), scale, timeoutInMilliseconds: 180000 });
  console.log(output);
}
