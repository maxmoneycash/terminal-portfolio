# Intro editing

The intro is 28.5 seconds: twelve chapters of large XP windows, followed by
an animated login directly into the live desktop. All 24 approved Demo Reel
entries appear, across 27 views. Aptos vs MegaETH, Sol2Move, Block Machine,
and NipahScan lead; Temper and the validator globe appear near the end.

`showcase.json` is the edit. Each shot names an **original recording**, its
start time, a source-pixel crop, and optional orientation-specific layouts.
`reel` maps additional views to their Demo Reel entry. The compositor checks
that every current entry is represented and rejects missing or unexpected
entries. Cash Clicker, DeepSurge, and the leverage-slider recording are absent.

The sources are discovered in `~/Screenshots`, the iCloud Screenshots folder,
or `~/Downloads`. They are build inputs, never copied into the website. Keep
crops within the approved app: several originals also contain terminals,
server addresses, browser sidebars, or other private desktop content. The
commits.sh view includes only its statistics panel. Original recordings with
personal data remain subject to the user's approval for those recordings.

Desktop views use large overlapping windows. Phone views stack app overviews
and detail panels; `portraitCrop` selects a meaningful panel rather than
shrinking an entire tall recording into a small second window. Window content
keeps its source aspect ratio. The camera holds a nearly fixed position until
the login, with depth of field, motion blur, bloom, grain, and colour fringing
disabled. The site also suspends its optional CRT overlay during playback.
Both final cuts are 1080p, H.264 CRF 16, 30 fps.

Preview individual compositions:

```sh
python3 scripts/intro/make_showcase.py --at 1.5,3.55,5.6
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  --python scripts/intro/scene.py -- --showcase --orient portrait \
  --stills 46,107,169 --out .intro-build/showcase/review --samples 16
```

`npm run intro:build` creates compressed JPEG source caches and separate
screen sequences for each orientation, renders, validates both MP4s, and
only then updates the content-hashed public assets. It waits for AC power
between render batches and checks disk headroom. A matching edit resumes
existing frames; changed inputs discard generated render frames. Successful
builds remove disposable caches unless `KEEP_INTRO_INTERMEDIATES=1` is set.
`npm run intro:clean` also removes these generated directories without touching
originals, review evidence, or public exports.

`login_ending.py` supplies the final tile click, Welcome screen, and matching
Bliss background. The site hands off to its live desktop on video completion;
it does not show a second login prompt. Explicit Log Off still opens XP login.

`make_screen.py` retains shared XP drawing helpers and the previous single-view
edit. `highlights.json` documents that older edit's five-second selects;
`showcase.json` is authoritative for the current intro.

`recordings.json` accounts for the supplied files. All usable, approved
recordings remain available through the Demo Reel. The 1.46-second file-picker
and upload-error recording has no usable app interaction.
