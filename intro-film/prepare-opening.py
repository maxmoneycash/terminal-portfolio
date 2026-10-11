#!/usr/bin/env python3
"""Prepare the supplied banknote motion layer without its black/UI tail."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from cut_reels import find_source
source = find_source('ScreenRecording_10-11-2025 12.mov')
out = ROOT / '.intro-build' / 'banknote-motion.mp4'
out.parent.mkdir(exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', source, '-t', '3.2', '-an',
    '-vf', 'fps=30,scale=884:616,setsar=1', '-c:v', 'libx264', '-crf', '18',
    '-preset', 'slow', '-movflags', '+faststart', str(out)], check=True)
sha = hashlib.sha256(out.read_bytes()).hexdigest()
name = f'intro-art/banknote-motion-{sha[:8]}.mp4'
target = ROOT / 'public' / name
out.replace(target)
(ROOT / 'src/intro/openingMedia.json').write_text(json.dumps({'src': name, 'duration': 3.2, 'frames': 112}, indent=2) + '\n')
p = ROOT / 'scripts/release-media.json'
manifest = json.loads(p.read_text())
manifest['files'] = {k: v for k, v in manifest['files'].items() if not k.startswith('intro-art/banknote-motion-')}
manifest['files'][name] = {'sha256': sha, 'bytes': target.stat().st_size}
p.write_text(json.dumps(manifest, indent=2) + '\n')
print(name)
