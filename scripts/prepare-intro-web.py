#!/usr/bin/env python3
"""Publish compact, uncropped shots for the intro's responsive browser composition."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib, json, re, shutil, subprocess

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / '.intro-build/film/public'
OUT = ROOT / 'public/videos/intro-shots'
STAGE = ROOT / '.intro-build/film/web'
SCENES = ROOT / 'intro-film/src/scenes'
MANIFEST = ROOT / 'scripts/release-media.json'


def run(*args):
    subprocess.run(args, check=True)


def publish(path, prefix, suffix=None):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    name = f'{prefix}-{digest[:8]}{suffix or path.suffix}'
    target = OUT / name
    shutil.copy2(path, target)
    return '/videos/intro-shots/' + name, {'sha256': digest, 'bytes': target.stat().st_size}


def clip(item):
    name, info = item
    source = BUILD / 'clips' / f'{name}.mp4'
    refs, pins = {}, {}
    for quality, width, height, crf, rate in [('src', 1920, 1440, '23', '4000k'), ('mobile', 960, 1280, '24', '1800k')]:
        target = STAGE / f'{name}-{quality}.mp4'
        run('ffmpeg', '-v', 'error', '-xerror', '-y', '-i', str(source), '-an',
            '-vf', f'scale=w=min(iw\\,{width}):h=min(ih\\,{height}):force_original_aspect_ratio=decrease:force_divisible_by=2',
            '-c:v', 'libx264', '-threads', '2', '-preset', 'medium', '-crf', crf,
            '-maxrate', rate, '-bufsize', str(int(rate[:-1])*2)+'k', '-pix_fmt', 'yuv420p', '-g', '30',
            '-movflags', '+faststart', str(target))
        url, pin = publish(target, f'{name}-{quality}')
        refs[quality] = url
        pins[url.lstrip('/')] = pin
    poster = STAGE / f'{name}.jpg'
    run('ffmpeg', '-v', 'error', '-y', '-i', str(source), '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', str(poster))
    refs['poster'], _ = publish(poster, name)
    print(f'{name}: ready', flush=True)
    return name, refs, pins


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    STAGE.mkdir(parents=True, exist_ok=True)
    text = '\n'.join(p.read_text() for p in SCENES.glob('*.tsx'))
    names = set(re.findall(r"[a-z0-9][a-z0-9-]*", text))
    clips = json.loads((ROOT / 'intro-film/clips.json').read_text())['clips']
    stills = json.loads((ROOT / 'intro-film/stills.json').read_text())['stills']
    if not {'commits-sh-workspace', 'tdeck-hero', 'roman-earth', 'nipahscan'}.issubset(names):
        raise ValueError('Required responsive scenes were not found; refusing to publish')
    media = json.loads(MANIFEST.read_text())
    media['files'] = {k:v for k,v in media['files'].items() if not k.startswith('videos/intro-shots/')}
    data = {'clips': {}, 'stills': {}}
    with ThreadPoolExecutor(max_workers=2) as pool:
        for name, refs, pins in pool.map(clip, [(name, info) for name, info in clips.items() if name in names]):
            data['clips'][name] = refs
            media['files'].update(pins)
    for name in stills:
        if name in names:
            data['stills'][name], _ = publish(BUILD / 'stills' / f'{name}.jpg', name)
    score = json.loads((ROOT / 'intro-film/score.json').read_text())
    seconds = sum(section['bars'] for section in score['sections']) * 4 * score['framesPerBeat'] / 30
    audio = STAGE / 'score.m4a'
    run('ffmpeg', '-v', 'error', '-y', '-i', str(BUILD / 'music/soundtrack.wav'), '-t', str(seconds),
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(audio))
    data['soundtrack'], pin = publish(audio, 'score')
    media['files'][data['soundtrack'].lstrip('/')] = pin
    # Both existing Bliss loops have the same length.
    duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
        str(ROOT / 'public/xp/video/bliss-loop-landscape.mp4')]))
    data['wallpaperFrames'] = round(duration * 30)
    (ROOT / 'src/data/intro-media.json').write_text(json.dumps(data, indent=2)+'\n')
    MANIFEST.write_text(json.dumps(media, indent=2)+'\n')
    print(f"Published {len(data['clips'])} shots, {len(data['stills'])} stills; {seconds:.1f}s score", flush=True)


if __name__ == '__main__':
    main()
