// Big videos stay out of git. The intro films and other large demos live on the
// repo's `intro-films` release and land in public/ before each build, so Vercel
// serves them as static files. Every file is checked against its manifest
// (intro-film/published.json, scripts/release-media.json); a mismatch fails the build.
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const manifest = JSON.parse(await readFile(new URL("../intro-film/published.json", import.meta.url), "utf8"));
const component = await readFile(new URL("../src/xp/IntroVideo.tsx", import.meta.url), "utf8");
const out = new URL("../public/videos/intro/", import.meta.url);

const referenced = [...component.matchAll(/"\/videos\/intro\/([^"/]+\.mp4)"/g)].map(match => match[1]);
const unlisted = referenced.filter(name => !manifest.files[name]);
if (!referenced.length || unlisted.length) {
  throw new Error(`IntroVideo.tsx plays films missing from intro-film/published.json: ${unlisted.join(", ") || "none found"}`);
}

async function matches(file, expected) {
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of createReadStream(file)) { hash.update(chunk); bytes += chunk.length; }
  } catch { return false; }
  return bytes === expected.bytes && hash.digest("hex") === expected.sha256;
}

async function download(name, expected, dir = out, source = manifest) {
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

await mkdir(out, { recursive: true });
for (const name of referenced) {
  const expected = manifest.files[name];
  if (await matches(new URL(name, out), expected)) {
    console.log(`${name}: already present`);
    continue;
  }
  await download(name, expected);
  console.log(`${name}: fetched ${(expected.bytes / 1e6).toFixed(1)} MB from the ${manifest.release} release`);
}

// Other large demos (the Demo Reel and My Projects), by path under public/.
const media = JSON.parse(await readFile(new URL("./release-media.json", import.meta.url), "utf8"));
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
