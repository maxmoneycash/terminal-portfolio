#!/usr/bin/env bash
# Rebuilds the MaxXP intro end to end: screen frames -> Blender renders -> web
# encode. About 45 minutes on an M1 Max; keep the Mac plugged in, lid open.
# Edit TIMELINE in make_screen.py to change which clips appear and when.
#
# The two orientations render one after the other: EEVEE uses ~2 GB each, and
# on a busy Mac that lands in swap, which shares the disk with the ~3 GB of
# PNG frames. Renders resume where they stopped if interrupted.
set -euo pipefail
cd "$(dirname "$0")/../.."
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"

free_gib=$(df -k . | awk 'NR==2{printf "%d", $4/1048576}')
if [ "$free_gib" -lt 8 ]; then
  echo "Only ${free_gib} GiB free; the build needs ~4 GiB of frames plus swap headroom." >&2
  exit 1
fi

rm -rf .intro-build/screen .intro-build/render
python3 scripts/intro/make_screen.py
for orient in portrait landscape; do
  caffeinate -i -s "$BLENDER" -b --factory-startup --python scripts/intro/scene.py -- \
    --orient "$orient" --out "$PWD/.intro-build/render/$orient" > ".intro-build/render_$orient.log" 2>&1
done
python3 scripts/intro/encode.py
