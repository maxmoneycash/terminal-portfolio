#!/usr/bin/env bash
# Original recordings -> compressed screen textures -> filmed XP -> validated MP4.
# Only disposable frames live in .intro-build. Keep the Mac on AC power.
set -euo pipefail
cd "$(dirname "$0")/../.."
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"

headroom() {
  local free_gib
  free_gib=$(df -k . | awk 'NR==2{printf "%d", $4/1048576}')
  if [ "$free_gib" -lt "$1" ]; then
    echo "Only ${free_gib} GiB free; need $1 GiB to continue safely." >&2
    exit 1
  fi
}
ac_power() {
  while ! pmset -g batt | grep -q 'AC Power'; do
    echo "Waiting for AC power"
    sleep 30
  done
}
ac_power
# A signature prevents mixing old frames with newly edited content. Rerunning
# the same build resumes; changing the edit discards only generated renders.
signature=$(shasum -a 256 scripts/intro/{showcase.json,make_showcase.py,make_screen.py,scene.py,login_ending.py} | shasum -a 256 | awk '{print $1}')
mkdir -p .intro-build/showcase
if [ "$(cat .intro-build/showcase/render-signature 2>/dev/null || true)" != "$signature" ]; then
  rm -rf .intro-build/render .intro-build/showcase/screen
  printf '%s\n' "$signature" > .intro-build/showcase/render-signature
fi
if [ "$(cat .intro-build/showcase/screen-ready 2>/dev/null || true)" != "$signature" ] || [ ! -f .intro-build/showcase/screen/portrait/0783.jpg ] || [ ! -f .intro-build/showcase/screen/landscape/0783.jpg ]; then
  headroom 12
  python3 -u scripts/intro/make_showcase.py --jobs 2
  printf '%s\n' "$signature" > .intro-build/showcase/screen-ready
fi
python3 -u scripts/intro/login_ending.py
for orient in portrait landscape; do
  mkdir -p ".intro-build/render/$orient"
  for start in $(seq 1 90 721); do
    ac_power
    headroom 5
    end=$((start + 89)); [ "$end" -gt 783 ] && end=783
    # Blender skips valid existing frames; remove failed placeholders first.
    find ".intro-build/render/$orient" -name '*.png' -size 0 -delete
    echo "$orient frames ${start}-${end}"
    caffeinate -i -s "$BLENDER" -b --factory-startup --python scripts/intro/scene.py -- \
      --showcase --orient "$orient" --samples 16 --start "$start" --end "$end" \
      --out "$PWD/.intro-build/render/$orient" >> ".intro-build/render_$orient.log" 2>&1
  done
  ac_power
  headroom 5
  caffeinate -i -s "$BLENDER" -b --factory-startup --python scripts/intro/scene.py -- \
    --showcase --orient "$orient" --samples 16 --login-ending --start 784 \
    --out "$PWD/.intro-build/render/$orient" >> ".intro-build/render_$orient.log" 2>&1
done
python3 -u scripts/intro/encode.py
if [ "${KEEP_INTRO_INTERMEDIATES:-0}" != "1" ]; then
  node scripts/clean-intro.mjs
fi
