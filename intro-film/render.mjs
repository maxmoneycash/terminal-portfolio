// Render one orientation in short chunks with retries, then join them.
// A busy machine can kill a Chrome renderer mid-frame; a chunk retry costs
// seconds instead of restarting the whole film. Finished chunks are reused
// while the film's inputs are unchanged.
//
// Usage: node render.mjs <landscape|portrait>
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const orient = process.argv[2] === "portrait" ? "portrait" : "landscape";
const id = orient === "portrait" ? "IntroPortrait" : "IntroLandscape";
const scale = orient === "portrait" ? 2 : 1.5;
const build = path.join(here, "../.intro-build/film");
const publicDir = path.join(build, "public");
const chunkDir = path.join(build, "chunks", orient);
const master = path.join(build, "out", `intro-${orient}.mp4`);
const CHUNK = 120;
const ATTEMPTS = 4;

/** Inputs that change the picture: sources, clip manifest, stats, config. */
function fingerprint(options = picture) {
  const hash = createHash("sha256");
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(path.join(here, "src"));
  // The radio and the signature come from the site, the beat grid from score.json.
  walk(path.join(here, "../src/radio"));
  files.push(
    path.join(here, "../src/lib/signatureInk.ts"),
    path.join(here, "clips.json"),
    path.join(here, "stills.json"),
    path.join(here, "score.json"),
    path.join(here, "remotion.config.ts"),
  );
  for (const file of files.sort()) hash.update(file).update(fs.readFileSync(file));
  for (const name of fs.readdirSync(path.join(publicDir, "clips")).sort()) {
    hash.update(name).update(String(fs.statSync(path.join(publicDir, "clips", name)).size));
  }
  return hash.update(JSON.stringify(options)).digest("hex").slice(0, 16);
}

const shared = { scale, timeoutInMilliseconds: 180000 };
// Picture settings: part of the chunk fingerprint.
const picture = { scale, crf: 14, imageFormat: "jpeg", jpegQuality: 95, pixelFormat: "yuv420p" };
// Load settings only; INTRO_CONCURRENCY=1 helps when the machine is swapping.
const video = {
  ...shared,
  ...picture,
  concurrency: Number(process.env.INTRO_CONCURRENCY ?? 2),
  offthreadVideoCacheSizeInBytes: 128 * 1024 * 1024,
};

// One Chrome for every chunk: Remotion's launch timeout is a fixed 25 s,
// which a busy machine can miss, so launching is retried and a crashed
// browser is replaced before the chunk retries.
let browser = null;
async function getBrowser() {
  if (browser) return browser;
  for (let attempt = 1; ; attempt += 1) {
    try {
      browser = await openBrowser("chrome");
      return browser;
    } catch (error) {
      if (attempt >= ATTEMPTS) throw error;
      console.log(`browser launch attempt ${attempt} failed; retrying`);
    }
  }
}

async function withRetries(label, task) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task(await getBrowser());
    } catch (error) {
      if (attempt >= ATTEMPTS) throw error;
      console.log(`${label}: attempt ${attempt} failed (${String(error.message).split("\n")[0]}); retrying`);
      await browser?.close({ silent: true }).catch(() => {});
      browser = null;
    }
  }
}

const stamp = fingerprint();
const stampFile = path.join(chunkDir, "fingerprint");
if (fs.existsSync(stampFile) && fs.readFileSync(stampFile, "utf8") !== stamp) {
  fs.rmSync(chunkDir, { recursive: true, force: true });
}
fs.mkdirSync(chunkDir, { recursive: true });
fs.writeFileSync(stampFile, stamp);

const serveUrl = await bundle({
  entryPoint: path.join(here, "src/index.ts"),
  publicDir,
  outDir: path.join(build, "bundle"),
});
const composition = await selectComposition({ serveUrl, id });
const total = composition.durationInFrames;

const parts = [];
for (let start = 0; start < total; start += CHUNK) {
  const end = Math.min(total, start + CHUNK) - 1;
  const out = path.join(chunkDir, `${String(start).padStart(5, "0")}.mp4`);
  parts.push(out);
  if (fs.existsSync(`${out}.ok`)) continue;
  await withRetries(`frames ${start}-${end}`, (puppeteerInstance) =>
    renderMedia({ ...video, puppeteerInstance, composition, serveUrl, codec: "h264", muted: true, frameRange: [start, end], outputLocation: out }),
  );
  fs.writeFileSync(`${out}.ok`, "");
  console.log(`${orient}: frames ${start}-${end} of ${total}`);
}

// Sound cues are timed identically in both orientations: render once, share.
const audio = path.join(build, "chunks", `audio-${fingerprint({})}.wav`);
if (!fs.existsSync(`${audio}.ok`)) {
  await withRetries("audio", (puppeteerInstance) => renderMedia({ ...shared, puppeteerInstance, composition, serveUrl, codec: "wav", inputProps: { audioOnly: true }, outputLocation: audio }));
  fs.writeFileSync(`${audio}.ok`, "");
}

// Chrome sometimes never acknowledges close on a loaded machine; don't wait on it.
await Promise.race([browser?.close({ silent: true }), new Promise((resolve) => setTimeout(resolve, 5000))]);

const list = path.join(chunkDir, "parts.txt");
fs.writeFileSync(list, parts.map((part) => `file '${part}'`).join("\n") + "\n");
fs.mkdirSync(path.dirname(master), { recursive: true });
execFileSync("ffmpeg", [
  "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-i", audio,
  "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
  "-movflags", "+faststart", master,
]);
const frames = execFileSync("ffprobe", [
  "-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", master,
]).toString().trim();
if (Number(frames) !== total) throw new Error(`${master}: ${frames} frames, expected ${total}`);
console.log(`${orient}: ${master} (${total} frames)`);
process.exit(0);
