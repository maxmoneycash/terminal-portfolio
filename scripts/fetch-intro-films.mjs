// Big videos stay out of git. The intro films and other large demos live on the
// repo's `intro-films` release and land in public/ before each build, so Vercel
// serves them as static files. Every file is checked against its manifest
// (scripts/release-media.json); a mismatch fails the build.
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const intro = JSON.parse(await readFile(new URL("../src/data/intro-media.json", import.meta.url), "utf8"));
const media = JSON.parse(await readFile(new URL("./release-media.json", import.meta.url), "utf8"));
const referenced = [...Object.values(intro.clips).flatMap(clip => [clip.src, clip.mobile]), intro.soundtrack];
if (!Object.keys(intro.clips).length || referenced.some(path => !media.files[path.slice(1)])) {
  throw new Error("Responsive intro assets must all be pinned in release-media.json");
}

async function matches(file, expected) {
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of createReadStream(file)) { hash.update(chunk); bytes += chunk.length; }
  } catch { return false; }
  return bytes === expected.bytes && hash.digest("hex") === expected.sha256;
}

async function download(name, expected, dir, source) {
  const file = name.split("/").pop();
  const url = `https://github.com/${source.repo}/releases/download/${source.release}/${file}`;
  const partial = new URL(`${file}.partial`, dir);
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(180_000) });
      if (!response.ok) throw new Error(`${url} returned ${response.status}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
      if (!(await matches(partial, expected))) throw new Error(`${name} does not match its published hash`);
      await rename(partial, new URL(file, dir));
      return;
    } catch (error) {
      await rm(partial, { force: true });
      if (attempt === 3) throw error;
      console.warn(`${name}: attempt ${attempt} failed (${error.message}); retrying`);
    }
  }
}

// Intro shots and large project demos, by path under public/.
for (const [path, expected] of Object.entries(media.files)) {
  const target = new URL(`../public/${path}`, import.meta.url);
  const dir = new URL("./", target);
  await mkdir(dir, { recursive: true });
  if (await matches(target, expected)) {
    console.log(`${path}: already present`);
    continue;
  }
  await download(path, expected, dir, media);
  console.log(`${path}: fetched ${(expected.bytes / 1e6).toFixed(1)} MB from the ${media.release} release`);
}
