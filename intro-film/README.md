# MaxXP intro film

The site's intro: XP boots, logs in, and the projects play out through XP
itself — a nine-minute Claude Code session timelapsed to eight seconds,
Lilyshark announced as new hardware, the gadgets.sh catalog, real
terminal sessions in command windows, commits.sh rising out of the tray, yank
cloning a site from an MSN Messenger toast, an Internet Explorer address bar,
a Confirm File Replace dialog, Orbital Works' Roman telescope as a screen
saver, a My Pictures slideshow of app screenshots, the Solitaire victory
cascade, Task Manager's "Commit Charge" — until every window closes on the
live desktop. It is styled
after an XP-themed music video; no footage from that video is used.

Everything is drawn as real DOM (Luna chrome in `src/xp.css`) and rendered
with Remotion, so the UI stays sharp at any camera zoom. The logical canvas is
XP's 96-DPI size (1280×720 landscape, 540×960 portrait); renders scale it to
1920×1080 and 1080×1920.

```sh
npm run intro:setup     # once: install Remotion in intro-film/
npm run intro:prepare   # cut clips, wallpaper loop, sounds, commits.sh stats
npm run intro:render    # both orientations (~8 min each)
npm run intro:publish   # web encode, validate, swap hashed assets into the site
```

`npm run intro:build` runs all four and then `intro:clean`.

The MP4s stay out of git. `intro:publish` records their SHA-256 in
`published.json`; `npm run intro:upload` puts them on the repo's `intro-films`
release (run it before pushing), and `npm run build` fetches and verifies them
into `public/videos/intro/`. `npm run intro:fetch` does the same for local dev.

- **Clips.** `clips.json` lists each recording, start time and source-pixel
  crop. `prepare.py` finds the originals in `~/Screenshots`, the iCloud
  Screenshots folder, or `~/Downloads`, and cuts them into
  `.intro-build/film/public/clips` (never into the website). Keep crops inside
  the app: several recordings also contain terminals, server addresses, or
  other windows. Review every frame of a changed window before publishing.
  `recordings.json` accounts for every supplied recording.
- **Timelapse.** A clip with `"speed"` in `clips.json` is sped up by dropping
  frames (no blending), so every frame stays legible; `duration` is source time.
- **Screenshots.** `stills.json` lists each screenshot (exact filename, crop,
  and the repository its code lives in). Only projects with authored code on
  this machine belong in the film; reconstructions of other companies' UIs
  don't. Match filenames exactly: macOS names differ only by AM/PM.
- **Wallpaper.** The film uses the live desktop's animated Bliss loop.
  `public/xp/gui/bgs/bliss-desktop.webp` has a Microsoft logo baked in; don't
  use it here.
- **Scenes.** `src/Film.tsx` sets the order and lengths; each scene is one file
  in `src/scenes/`. Sounds are the site's XP sounds, cued with `<Sfx>` next to
  the event they belong to.
- **Review.** `node stills.mjs landscape <dir> <frame…>` renders stills from
  one reused bundle; `npm run studio` opens Remotion Studio.

The site plays the film muted when it opens automatically (`?forceBoot=true`)
and with sound when the visitor clicks Watch intro.

Remotion is free for individuals and companies of up to three people; larger
teams need a company license.
