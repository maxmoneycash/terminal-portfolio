#!/usr/bin/env python3
"""Extract recorded handwriting with its real stroke order and retime it.

Two streaming decode passes keep memory bounded. The opaque RGB ink atlas
stores 15-bit arrival time plus word identity in R/G and ink coverage in B (no premultiplication
loss). Pen samples and layout live in src/lib/signatureRecording.json.

Usage: python3 scripts/signature/from_video.py path/to/recording.mov
"""
from __future__ import annotations
import argparse
import hashlib
import json
import subprocess
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
DURATION = json.loads((ROOT / 'intro-film/score.json').read_text())['calligraphy']['frames'] / 30
MARGIN_X = 300


def decode(path, width, height):
    proc = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', str(path), '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], stdout=subprocess.PIPE)
    try:
        while buf := proc.stdout.read(width * height):
            if len(buf) != width * height:
                raise ValueError('Incomplete video frame')
            yield np.frombuffer(buf, np.uint8).reshape(height, width)[:, MARGIN_X:].copy()
    finally:
        proc.stdout.close()
        if proc.wait() != 0:
            raise RuntimeError('ffmpeg could not decode the recording')


def retime(times, active, duration, pause=0.2):
    """Keep stroke rhythm while shortening pen-up gaps, then scale to duration."""
    clock = np.zeros(len(times))
    for a, b in zip(active[:-1], active[1:]):
        gap = times[b] - times[a]
        clock[a:b + 1] = clock[a] + np.linspace(0, min(gap, pause), b - a + 1)
    speed = clock[active[-1]] / duration
    if speed <= 0:
        raise ValueError('Recording contains no timed writing')
    return clock / speed, speed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('video', type=Path)
    args = parser.parse_args()
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_streams', '-show_frames', '-show_entries', 'stream=width,height:frame=pts_time', '-of', 'json', str(args.video)]))
    width, height = info['streams'][0]['width'], info['streams'][0]['height']
    times = np.array([float(f['pts_time']) for f in info['frames']])
    first, last = [], deque(maxlen=5)
    count = 0
    for frame in decode(args.video, width, height):
        if len(first) < 3: first.append(frame)
        last.append(frame)
        count += 1
    if count != len(times): raise ValueError('Frame timestamps do not match decoded video')
    paper = np.median(first, axis=0).astype(np.float32)
    final = np.clip((paper - np.median(last, axis=0)) / np.maximum(paper, 1), 0, 1)
    ink = final > 0.08
    labels, n = ndimage.label(ink)
    sizes = np.bincount(labels.ravel())
    ink &= sizes[labels] >= 25
    yy, xx = np.nonzero(ink)
    if not len(xx): raise ValueError('No signature found')
    y0, y1 = max(0, yy.min() - 12), min(height, yy.max() + 13)
    x0, x1 = max(0, xx.min() - 12), min(width - MARGIN_X, xx.max() + 13)
    paper, final, ink = [a[y0:y1, x0:x1] for a in (paper, final, ink)]
    arrive = np.full(ink.shape, -1, np.int32)
    threshold = np.maximum(final * 0.5, 0.04)
    for i, frame in enumerate(decode(args.video, width, height)):
        alpha = np.clip((paper - frame[y0:y1, x0:x1]) / np.maximum(paper, 1), 0, 1)
        fresh = ink & (arrive < 0) & (alpha >= threshold)
        arrive[fresh] = i
    ink &= arrive >= 0
    counts = np.bincount(arrive[ink], minlength=len(times))
    active = np.flatnonzero(counts > 0)
    when, speed = retime(times, active, DURATION)
    levels = np.where(ink, 1 + np.round(when[np.maximum(arrive, 0)] / DURATION * 32766), 0).astype(np.uint16)
    word = (times[np.maximum(arrive, 0)] >= 8.0).astype(np.uint16)
    # The first flourish crosses the second M. Those pixels already exist when
    # the M is written; preserve them in both words when stacking the name.
    second = ink & (word == 1)
    crossings = ndimage.binary_closing(second, structure=np.ones((9, 1))) & ink & (word == 0)
    nearest = ndimage.distance_transform_edt(~second, return_distances=False, return_indices=True)
    crossing_ids = np.flatnonzero(crossings)
    crossing_times = levels[tuple(nearest[:, crossings])]
    overlaps = [[int(i), int(t)] for i, t in zip(crossing_ids, crossing_times)]
    levels |= word << 15
    cover = np.round(np.where(ink, final, 0) * 255).astype(np.uint8)
    atlas = np.dstack([levels >> 8, levels & 255, cover]).astype(np.uint8)
    out = ROOT / 'public/signature'; out.mkdir(exist_ok=True)
    temp = out / 'recording.png'; Image.fromarray(atlas).save(temp, optimize=True)
    digest = hashlib.sha256(temp.read_bytes()).hexdigest()[:12]
    image = out / f'ink-{digest}.png'; temp.replace(image)
    # Ignore tiny compression changes when tracking the nib. Keep the strongest
    # cluster so later antialiasing changes cannot pull it back to older letters.
    pen = []
    for f in np.flatnonzero(counts >= 5):
        mask = arrive == f
        labels, n = ndimage.label(ndimage.binary_dilation(mask, iterations=2))
        weights = np.bincount(labels[mask])
        if len(weights) < 2: continue
        weights[0] = 0
        ys, xs = np.nonzero(mask & (labels == weights.argmax()))
        pen.append([float(when[f]), float(xs.mean()), float(ys.mean()), int(times[f] >= 8.0)])
    pen = np.array(pen)
    # Smooth only local nib motion; a long jump is a pen lift.
    breaks = np.flatnonzero((np.diff(pen[:, 0]) > 0.08) | (np.hypot(*np.diff(pen[:, 1:3], axis=0).T) > 70)) + 1
    segments = np.split(np.arange(len(pen)), breaks)
    for part in segments:
        if len(part) > 4:
            pen[part, 1:3] = ndimage.gaussian_filter1d(pen[part, 1:3], 0.8, axis=0, mode='nearest')
    h, w = ink.shape
    # The recording's word boundary lies between the first name and second M.
    split = 1010 - MARGIN_X - x0
    data = dict(width=w, height=h, duration=DURATION, split=int(split), atlas='/signature/' + image.name,
                bounds=[0, 0, w, h], sourceSha256=hashlib.sha256(args.video.read_bytes()).hexdigest(),
                pen=[[round(float(v), 4 if k == 0 else 2) for k, v in enumerate(p)] for p in pen],
                breaks=breaks.tolist(), overlaps=overlaps)
    bounds = []
    for which in (0, 1):
        rows, cols = np.nonzero(ink & (word == which))
        bounds.append([int(cols.min()), int(rows.min()), int(cols.max()+1), int(rows.max()+1)])
    data['wordBounds'] = bounds
    (ROOT / 'src/lib/signatureRecording.json').write_text(json.dumps(data, separators=(',', ':')) + '\n')
    print(f'{times[active[-1]] - times[active[0]]:.2f}s writing -> {DURATION:.2f}s; {speed:.2f}x; {w}x{h}; {len(pen)} pen samples; atlas {image.stat().st_size} bytes', flush=True)

if __name__ == '__main__': main()
