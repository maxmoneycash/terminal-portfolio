# Intro editing

The intro stays 28.5 seconds, with 19 windows. `highlights.json` records a
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
the camera. `build.sh` regenerates screen frames, renders both orientations
and encodes them. Keep the machine on AC power. A full render can take hours
on a busy machine. Do not resume old render frames after changing the selects:
the screen content and its lighting have changed.
