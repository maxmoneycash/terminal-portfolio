#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const videoJobs = [
  {
    id: "screen-2025-12-09-191737",
    sourceFilename: "Screen Recording 2025-12-09 at 7.17.37 PM",
  },
  {
    id: "screen-2025-12-01-213809",
    sourceFilename: "Screen Recording 2025-12-01 at 9.38.09 PM",
  },
  {
    id: "screen-2025-12-22-011301",
    sourceFilename: "Screen Recording 2025-12-22 at 1.13.01 AM",
  },
  {
    id: "screen-2026-01-31-011109",
    sourceFilename: "Screen Recording 2026-01-31 at 1.11.09 AM",
  },
  {
    id: "screen-2026-02-24-151159",
    sourceFilename: "Screen Recording 2026-02-24 at 3.11.59 PM",
  },
  {
    id: "best-1",
    sourceFilename: "best_1",
  },
];

const videoExtensions = new Set([".mov", ".mp4", ".m4v", ".webm"]);
const ignoredDirectories = new Set([".git", "node_modules", "dist", ".vercel"]);

function normalize(value) {
  const extension = extname(value).toLowerCase();
  const stem = videoExtensions.has(extension) ? value.slice(0, -extension.length) : value;

  return stem
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function walkVideos(root) {
  const results = [];
  const entries = readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) results.push(...walkVideos(path));
      continue;
    }

    if (entry.isFile() && videoExtensions.has(extname(entry.name).toLowerCase())) {
      results.push(path);
    }
  }

  return results;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

function hasOutput(path) {
  return existsSync(path) && statSync(path).size > 0;
}

function requireBinary(name) {
  const result = spawnSync("command", ["-v", name], { shell: true, stdio: "ignore" });
  if (result.status !== 0) {
    throw new Error(`${name} is required. Install ffmpeg before optimizing portfolio videos.`);
  }
}

function encodeVideo(input, id, outputDir, posterDir) {
  const mp4Output = join(outputDir, `${id}.mp4`);
  const hlsDir = join(outputDir, "hls", id);
  const hlsOutput = join(hlsDir, "index.m3u8");
  const posterOutput = join(posterDir, `${id}.jpg`);
  const scale1080 = "fps=30,scale=min(1280\\,iw):-2:flags=lanczos";
  const scalePoster = "scale=min(1280\\,iw):-2:flags=lanczos";
  mkdirSync(hlsDir, { recursive: true });

  console.log(`\n${id}`);
  console.log(`input  ${input}`);

  if (hasOutput(hlsOutput)) {
    console.log(`hls    ${hlsOutput} (exists)`);
  } else {
    console.log(`hls    ${hlsOutput}`);
    run("ffmpeg", [
      "-y",
      "-i",
      input,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-vf",
      scale1080,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-force_key_frames",
      "expr:gte(t,n_forced*2)",
      "-g",
      "60",
      "-keyint_min",
      "60",
      "-sc_threshold",
      "0",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-hls_time",
      "2",
      "-hls_playlist_type",
      "vod",
      "-hls_segment_filename",
      join(hlsDir, "segment-%03d.ts"),
      hlsOutput,
    ]);
  }

  if (hasOutput(mp4Output)) {
    console.log(`mp4    ${mp4Output} (exists)`);
  } else {
    console.log(`mp4    ${mp4Output}`);
    run("ffmpeg", [
      "-y",
      "-i",
      input,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-vf",
      scale1080,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-shortest",
      mp4Output,
    ]);
  }

  if (hasOutput(posterOutput)) {
    console.log(`poster ${posterOutput} (exists)`);
  } else {
    console.log(`poster ${posterOutput}`);
    run("ffmpeg", [
      "-y",
      "-ss",
      "00:00:01",
      "-i",
      input,
      "-update",
      "1",
      "-frames:v",
      "1",
      "-vf",
      scalePoster,
      "-q:v",
      "4",
      posterOutput,
    ]);
  }
}

function main() {
  requireBinary("ffmpeg");

  const sourceDir = resolve(process.argv[2] ?? ".");
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }

  const outputDir = resolve("public/videos");
  const posterDir = join(outputDir, "posters");
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(posterDir, { recursive: true });

  const candidates = walkVideos(sourceDir);
  const normalizedCandidates = candidates.map((path) => ({
    path,
    name: basename(path),
    normalized: normalize(basename(path)),
  }));
  const missing = [];

  for (const job of videoJobs) {
    const hint = normalize(job.sourceFilename);
    const match = normalizedCandidates.find((candidate) => candidate.normalized.includes(hint));

    if (!match) {
      missing.push(job.sourceFilename);
      continue;
    }

    encodeVideo(match.path, job.id, outputDir, posterDir);
  }

  if (missing.length > 0) {
    console.warn("\nMissing source videos:");
    for (const item of missing) console.warn(`- ${item}`);
    process.exitCode = 1;
  }
}

main();
