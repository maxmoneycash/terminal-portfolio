# Intro editing

The intro stays 28.5 seconds, with 21 windows. The opening leads with
Aptos vs MegaETH, Sol2Move, Block Machine, and NipahScan. Globe and Temper
appear later. Alternate takes remain available in the Demo Reel.
`highlights.json` records a
five-second select for each project and the short moment used in the intro.
`start` and `intro` are seconds into the input file; `duration` is the select's
length. `crop`, when present, is `[x, y, width, height]` in source pixels.

Most inputs are the cropped, content-hashed clips in `public/videos/reels`.
Temper uses a new five-second extract from 13:59–14:04 of the original
14-minute recording. Its source pattern, timestamp and filter are saved in
the manifest; the extract is kept under `sources` so builds do not require
the original recording. It is a build input, not a browser download.

Review selects before rendering:

```sh
python3 scripts/intro/review_highlights.py
open .intro-build/highlights/index.html
```

The gallery shows the complete five-second selections and the portion each
window plays. Change `intro` to position the action after the camera arrives;
change `start` when the surrounding five-second selection also needs to move.
Keep the entire window span inside the selection. The generator checks this.

`make_screen.py` controls window order and positioning; `scene.py` controls
the camera. The camera keeps most of its distance between windows, with
gentle following and more desktop visible. Screen detail takes priority over
camera effects: motion blur, bloom, colour fringing, exposure pumping, and
added grain are off. Both final videos retain the full 1080p render size at
CRF 18; do not downsample the phone version to 720p.

`build.sh` regenerates screen frames, renders both orientations
and encodes them. Keep the machine on AC power. A full render can take hours
on a busy machine. Do not resume old render frames after changing the selects:
the screen content and its lighting have changed.

`recordings.json` accounts for all 25 original recordings requested for the
portfolio. Twenty-one are represented in the Demo Reel; DeepSurge, Cash Clicker, and the
leverage slider were removed at the user's request, and the remaining
1.46-second recording shows a file picker followed by an upload-size error.
Four previously omitted recordings are restored through the named jobs in
`scripts/cut_reels.py`. Three Block Machine sources share one reel; alternate
takes remain available there even when the intro uses another take.
