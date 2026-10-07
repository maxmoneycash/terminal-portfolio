#!/usr/bin/env python3
"""Replace only the last 2.4 seconds of the intro: tile click → Welcome → Bliss.

python3 scripts/intro/login_ending.py                 # small texture sequence
Blender scene.py --login-ending --start 784 ...       # render each orientation
python3 scripts/intro/login_ending.py --encode        # splice into existing cuts

Full rebuilds use the same textures and camera in build.sh. No source recordings
are decoded here. Encoding validates both cuts before replacing published assets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageOps

from make_screen import BUILD, ROOT, GUI, FPS, FRAMES, W, H, LW, LH, S, px, font, TAHOMA, login_image, smoothstep

ENDING = Path(BUILD) / "ending"
FIRST = 784  # t = 26.1; preserve every frame before the login tile is clicked
TARGETS = {"portrait": (1080, 1920, 870), "landscape": (1920, 1080, 790)}


def bliss(orient: str, size: tuple[int, int]) -> Image.Image:
    name = "bliss-mobile.webp" if orient == "portrait" else "bliss-desktop.webp"
    image = ImageOps.fit(Image.open(Path(GUI) / "bgs" / name).convert("RGB"), size, Image.Resampling.LANCZOS)
    # Match the live wallpaper's quiet top/bottom colour grade.
    data = np.asarray(image, dtype=np.float32)
    y = np.linspace(0, 1, size[1])[:, None, None]
    alpha = np.where(y < .44, .05 * (1 - y / .44), .08 * (y - .44) / .56)
    colour = np.where(y < .44, np.array([14, 94, 173]), np.array([4, 38, 7]))
    return Image.fromarray(np.uint8(np.clip(data * (1 - alpha) + colour * alpha, 0, 255)))


def welcome() -> Image.Image:
    xs, ys = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    distance = np.sqrt(((xs - .5 * W) / (1.2 * W)) ** 2 + ((ys - .48 * H) / (.8 * H)) ** 2)
    colours = [(110, 162, 232), (63, 116, 207), (34, 80, 159), (26, 63, 134)]
    rgb = np.stack([np.interp(distance, [0, .42, .72, 1], [c[i] for c in colours]) for i in range(3)], axis=-1)
    image = Image.fromarray(rgb.astype(np.uint8), "RGB")
    draw = ImageDraw.Draw(image)
    for a, b in [(0, 88), (LH - 88, LH)]:
        draw.rectangle((0, px(a), W, px(b)), fill=(20, 53, 111))
    draw.text((W / 2 + px(1), H / 2 + px(2)), "Welcome", font=font("Trebuchet MS Italic.ttf", 40), fill=(42, 79, 150), anchor="mm")
    draw.text((W / 2, H / 2), "Welcome", font=font("Trebuchet MS Italic.ttf", 40), fill="white", anchor="mm")
    return image


def textures():
    login, greeting = login_image(), welcome()
    cursor = Image.open(Path(GUI) / "cursors" / "arrow.png").convert("RGBA").resize((px(32), px(32)), Image.Resampling.NEAREST)
    for orient, (width, height, visible_h) in TARGETS.items():
        folder = ENDING / "screen" / orient
        folder.mkdir(parents=True, exist_ok=True)
        # Blender's sequence loader needs a frame numbered 0001, even when
        # rendering a later range. It never renders this placeholder.
        login.save(folder / "0001.jpg", quality=96, subsampling=0)
        crop_w, crop_h = px(visible_h * width / height), px(visible_h)
        paper = bliss(orient, (crop_w, crop_h))
        desktop = Image.new("RGB", (W, H), (70, 135, 207))
        desktop.paste(paper, ((W - crop_w) // 2, (H - crop_h) // 2))
        bliss(orient, (width, height)).save(ENDING / f"desktop-{orient}.png")
        for frame in range(FIRST, FRAMES + 1):
            t = (frame - 1) / FPS
            image = login.copy()
            if t < 26.97:
                draw = ImageDraw.Draw(image)
                if t >= 26.55:
                    draw.rounded_rectangle((px(765), px(405), px(1180), px(492)), radius=px(8), outline=(231, 243, 255), width=px(2))
                u = smoothstep(26.12, 26.55, t)
                scale = .89 if 26.62 <= t < 26.74 else 1
                pointer = cursor.resize((round(cursor.width * scale), round(cursor.height * scale)), Image.Resampling.NEAREST)
                image.paste(pointer, (px(1080 - 150 * u), px(570 - 110 * u)), pointer)
            image = Image.blend(image, greeting, smoothstep(26.76, 27.04, t))
            image = Image.blend(image, desktop, smoothstep(27.65, 28.14, t))
            image.save(folder / f"{frame:04d}.jpg", quality=96, subsampling=0)
        print(f"{orient}: {FRAMES - FIRST + 1} ending textures", flush=True)


def encode():
    component = Path(ROOT) / "src/xp/IntroVideo.tsx"
    src = component.read_text()
    output = Path(ROOT) / "public/videos/intro"
    prepared = []
    for orient, (width, height, _) in TARGETS.items():
        source = re.search(rf'"(/videos/intro/intro-{orient}-[^"/]+\.mp4)"', src).group(1)
        frames = ENDING / "render" / orient
        for frame in range(FIRST, FRAMES + 1):
            with Image.open(frames / f"{frame:04d}.png") as image:
                image.load()
                if image.size != (width, height):
                    raise ValueError(f"wrong frame dimensions: {orient}/{frame}")
        video = ENDING / f"intro-{orient}.mp4"
        # Re-encode at CRF 16 to protect the existing sharp app footage. Only
        # 72 frames need Blender; every earlier frame keeps its exact timing.
        subprocess.run([
            "ffmpeg", "-v", "error", "-y", "-i", str(Path(ROOT) / "public" / source.lstrip("/")),
            "-framerate", str(FPS), "-start_number", str(FIRST), "-i", str(frames / "%04d.png"),
            "-filter_complex", f"[0:v]trim=end_frame={FIRST - 1},setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0,format=yuv420p[v]",
            "-map", "[v]", "-c:v", "libx264", "-threads", "4", "-preset", "slow", "-crf", "16", "-profile:v", "high", "-g", "60", "-movflags", "+faststart", "-an", str(video),
        ], check=True)
        probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(video)]))["streams"][0]
        if int(probe["nb_frames"]) != FRAMES or (probe["width"], probe["height"]) != (width, height):
            raise ValueError(f"invalid encoded cut: {orient}")
        digest = hashlib.sha1(video.read_bytes()).hexdigest()[:8]
        poster = ENDING / f"intro-{orient}.jpg"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-frames:v", "1", "-q:v", "4", str(poster)], check=True)
        prepared.append((orient, digest, video, poster))
    for orient, digest, video, poster in prepared:
        for path in [video, poster]:
            destination = output / f"intro-{orient}-{digest}{path.suffix}"
            os.replace(path, destination)
            src = re.sub(rf'"/videos/intro/intro-{orient}-[^"/]+\{path.suffix}"', f'"/videos/intro/{destination.name}"', src)
        print(f"{orient}: 28.5s, 855 frames, {digest}", flush=True)
    component.write_text(src)
    for orient, digest, *_ in prepared:
        for old in output.glob(f"intro-{orient}-*"):
            if f"-{digest}." not in old.name:
                old.unlink()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--encode", action="store_true")
    args = parser.parse_args()
    encode() if args.encode else textures()
