#!/usr/bin/env python3
"""Publish Max's selected finished edit, preserving every cut and the audio mix.

Do not substitute excerpts from the raw camera take. The approved demo is
Downloads/Meshtastic_LilyShark_summary_v2.mov; originals stay untouched.
"""
from pathlib import Path
import hashlib, json, subprocess

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path.home() / 'Downloads/Meshtastic_LilyShark_summary_v2.mov'
OUT = ROOT / 'public/videos/reels'
STAGE = ROOT / '.intro-build/lilyshark-camera'


def run(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)


def main():
    STAGE.mkdir(parents=True, exist_ok=True)
    (OUT / 'posters').mkdir(parents=True, exist_ok=True)
    catalog = ROOT / 'src/data/lilyshark-videos.json'
    videos = [v for v in json.loads(catalog.read_text()) if not v['id'].startswith('lilyshark-camera-')]
    manifest = ROOT / 'scripts/release-media.json'
    media = json.loads(manifest.read_text())
    media['files'] = {k:v for k,v in media['files'].items() if not k.startswith('videos/reels/lilyshark-camera-')}
    name = 'lilyshark-camera-summary'
    target = STAGE / (name + '.mp4')
    # Only compress for web delivery: no crop, retiming, cuts, or audio processing.
    run('-i', str(SOURCE), '-map', '0:v:0', '-map', '0:a:0',
        '-c:v', 'libx264', '-threads', '4', '-crf', '20', '-preset', 'medium',
        '-maxrate', '5000k', '-bufsize', '10000k', '-pix_fmt', 'yuv420p', '-g', '60',
        '-c:a', 'copy', '-movflags', '+faststart', str(target))
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    video = OUT / f'{name}-{digest[:8]}.mp4'
    target.replace(video)
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(video)]))
    stream = next(s for s in info['streams'] if s['codec_type'] == 'video')
    poster = OUT / 'posters' / f'{video.stem}.jpg'
    run('-ss', '12', '-i', str(video), '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '3', str(poster))
    url = '/videos/reels/' + video.name
    media['files'][url[1:]] = dict(sha256=digest, bytes=video.stat().st_size)
    videos.append(dict(id=name, title='Lilyshark: Meshtastic demo', date='On camera',
        summary='Max demonstrates the handheld radio analyzer, from Meshtastic packets to the spectrum scan.',
        sourceFilename=SOURCE.name, poster='/videos/reels/posters/' + poster.name, link='https://lilyshark.com/',
        durationSeconds=float(info['format']['duration']), sizeBytes=video.stat().st_size, hasAudio=True,
        width=stream['width'], height=stream['height'], sources=[dict(src=url, type='video/mp4', quality='1080p')]))
    print(f'{name}: {info["format"]["duration"]}s, complete edited demo', flush=True)
    catalog.write_text(json.dumps(videos, indent=2) + '\n')
    manifest.write_text(json.dumps(media, indent=2) + '\n')


if __name__ == '__main__': main()
