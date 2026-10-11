#!/usr/bin/env python3
"""Publish the supplied Lilyshark films, without cropping or cutting the shorts.

Originals stay in Downloads. Hashed MP4s go on the existing media release;
posters and the generated catalogue are checked in with the site.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parent.parent
DOWNLOADS = Path.home() / "Downloads"
OUT = ROOT / "public/videos/reels"
POSTERS = OUT / "posters"
STAGE = ROOT / ".intro-build/lilyshark"
SHORTS = [
    ("01-private-messages", "Private messages", "What Lilyshark can see in a Meshtastic packet."),
    ("02-max-range", "Radio range", "A visual explanation of range, terrain, and line of sight."),
    ("03-meshtastic-vs-meshcore", "Meshtastic vs MeshCore", "How two mesh protocols handle the same radio hardware."),
    ("04-who-repeats-first", "Who repeats first?", "Following a message as it travels through a mesh."),
    ("05-below-the-noise", "Below the noise", "Visualizing how LoRa decodes a faint signal."),
    ("06-sound-of-lora", "The sound of LoRa", "A slowed-down packet makes the chirps audible."),
    ("07-not-encrypted", "What is not encrypted?", "A closer look at a packet's visible header."),
    ("08-airtime", "Airtime", "Seeing the tradeoff between airtime and signal sensitivity."),
    ("09-height-beats-power", "Height beats power", "A visual comparison of antenna height and transmit power."),
    ("10-what-is-lilyshark", "What is Lilyshark?", "A tour of the packet viewer on the LILYGO T-Deck."),
]


def run(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def publish(path, name):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    target = OUT / f"{name}-{digest[:8]}.mp4"
    path.replace(target)
    return target, {"sha256": digest, "bytes": target.stat().st_size}


def prepare(item):
    slug, title, summary = item
    full = slug == "launch"
    source = DOWNLOADS / ("lilyshark-launch-v2.mp4" if full else f"lilyshark-shorts/{slug}.mp4")
    name = f"lilyshark-{slug}"
    tmp = STAGE / f"{name}.mp4"
    if full:
        run("-i", str(source), "-c", "copy", "-movflags", "+faststart", str(tmp))
    else:
        run("-i", str(source), "-vf", "scale=720:-2:flags=lanczos,fps=30", "-c:v", "libx264",
            "-threads", "2", "-preset", "medium", "-crf", "22", "-maxrate", "1800k", "-bufsize", "3600k",
            "-pix_fmt", "yuv420p", "-g", "60", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(tmp))
    video, entry = publish(tmp, name)
    info = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)]))
    stream = next(s for s in info["streams"] if s["codec_type"] == "video")
    poster = POSTERS / f"{video.stem}.jpg"
    run("-ss", "12" if full else "2", "-i", str(video), "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "3", str(poster))
    data = dict(id=name, title=f"Lilyshark: {title}", date="Film" if full else "Short film", summary=summary,
        sourceFilename=source.name, poster=f"/videos/reels/posters/{poster.name}", link="https://lilyshark.com/",
        durationSeconds=float(info["format"]["duration"]), sizeBytes=entry["bytes"], hasAudio=True,
        width=stream["width"], height=stream["height"], sources=[dict(src=f"/videos/reels/{video.name}", type="video/mp4", quality="HD" if full else "720p")])
    media = {f"videos/reels/{video.name}": entry}
    if full:
        tmp = STAGE / "preview.mp4"
        run("-ss", "10.5", "-t", "18.667", "-i", str(source), "-an", "-vf", "scale=1280:-2:flags=lanczos,fps=30",
            "-c:v", "libx264", "-threads", "2", "-preset", "medium", "-crf", "23", "-maxrate", "2000k", "-bufsize", "4000k",
            "-pix_fmt", "yuv420p", "-g", "60", "-movflags", "+faststart", str(tmp))
        preview, preview_entry = publish(tmp, "lilyshark-preview")
        data["previewSrc"] = f"/videos/reels/{preview.name}"
        media[f"videos/reels/{preview.name}"] = preview_entry
    print(f"{name}: {data['durationSeconds']:.2f}s, {entry['bytes'] / 1e6:.1f} MB", flush=True)
    return data, media


def main():
    for folder in [OUT, POSTERS, STAGE]: folder.mkdir(parents=True, exist_ok=True)
    items = [("launch", "The launch film", "The complete 90-second film: a handheld packet analyzer, from radio signals to decoded bytes."), *SHORTS]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(prepare, items))
    catalog = ROOT / "src/data/lilyshark-videos.json"
    camera = [v for v in json.loads(catalog.read_text()) if v["id"].startswith("lilyshark-camera-")] if catalog.exists() else []
    catalog.write_text(json.dumps([data for data, _ in results] + camera, indent=2) + "\n")
    path = ROOT / "scripts/release-media.json"
    manifest = json.loads(path.read_text())
    manifest["files"] = {key: value for key, value in manifest["files"].items() if not key.startswith("videos/reels/lilyshark-") or key.startswith("videos/reels/lilyshark-camera-")}
    for _, media in results: manifest["files"].update(media)
    path.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__": main()
