#!/usr/bin/env python3
"""MaxXP intro, stage 1 of 2: the picture on the monitor.

Draws an XP desktop (Bliss, desktop icons, taskbar) where classic app windows
pop open and closed, each playing a clip from the demo reel, then logs off to
the login screen. Writes a JPEG frame sequence plus timeline.json, which
stage 2 (scene.py, run inside Blender) maps onto a filmed monitor.

  python3 scripts/intro/make_screen.py                  # full sequence
  python3 scripts/intro/make_screen.py --at 2,9.5,24    # preview frames only

Needs ffmpeg/ffprobe, numpy, and Pillow. Output goes to .intro-build/.
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import math
import os
import random
import subprocess
from concurrent.futures import ProcessPoolExecutor
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GUI = os.path.join(ROOT, "public", "xp", "gui")
BUILD = os.path.join(ROOT, ".intro-build")
FONT_DIR = "/System/Library/Fonts/Supplemental"

FPS = 30
DURATION = 28.5
FRAMES = int(round(DURATION * FPS))
S = 2.5  # texture pixels per logical XP pixel (the camera films it close up)
LW, LH = 1440, 900  # the monitor's logical resolution (a 16:10 LCD)
W, H = int(LW * S), int(LH * S)
TASKBAR = 30
BODY = (236, 233, 216)  # Luna window face colour

# ---------------------------------------------------------------------------
# The show. Windows pop open one after another (FIRST_OPEN, then every STEP
# seconds, each open for HOLD), playing the moment saved in highlights.json.
# cx/cy place the
# window's centre and cw sets the content width in logical pixels; height
# follows the clip's shape. The phone camera frames each window as it opens,
# so keep consecutive windows a short pan apart and every centre inside
# x 480-960, y 300-440, and tall windows nearer 650-680 so the wide cut can centre them too.
# ---------------------------------------------------------------------------
IE_BLOCK = "http://aptos-consensus-visualizer.vercel.app/block-machine"
IE_VELOCIRAPTR = "http://aptos-consensus-visualizer.vercel.app/"
FIRST_OPEN, STEP, HOLD = 1.30, 1.13, 1.30
with open(os.path.join(ROOT, "scripts", "intro", "highlights.json")) as fh:
    HIGHLIGHTS = json.load(fh)
SHOW = [
    dict(style="wmp", clip="aptos-vs-megaeth", cx=840, cy=360, cw=390,
         title="Aptos vs MegaETH"),
    dict(style="luna", clip="sol2move-boringvault", cx=820, cy=340, cw=390,
         title="Sol2Move"),
    dict(style="ie", clip="aptos-block-machine", cx=820, cy=350, cw=390,
         title="Aptos Block Machine - Microsoft Internet Explorer", url=IE_BLOCK),
    dict(style="wmp", clip="nipahscan", cx=840, cy=360, cw=390,
         title="NipahScan"),
    dict(style="ie", clip="aptos-hft-demo", cx=670, cy=420, cw=310,
         title="Aptos HFT Demo - Microsoft Internet Explorer", url="http://aptos-polymarket.vercel.app/"),
    dict(style="ie", clip="decibrrr-live", cx=820, cy=350, cw=390,
         title="Decibrrr - Microsoft Internet Explorer", url="http://cash.trading/"),
    dict(style="luna", clip="seam-dex", cx=820, cy=320, cw=390,
         title="Seam", menu=True),
    dict(style="luna", clip="aptos-velociraptr", cx=670, cy=410, cw=300,
         title="Aptos Velociraptr"),
    dict(style="luna", clip="aptos-load-test", cx=660, cy=410, cw=300,
         title="Aptos Load Test"),
    dict(style="luna", clip="sol2move-generated-code", cx=820, cy=350, cw=390,
         title="Sol2Move - Generated Move"),
    dict(style="ie", clip="fee-market-simulator", cx=650, cy=400, cw=360,
         title="Aptos Velociraptr - Microsoft Internet Explorer", url=IE_VELOCIRAPTR),
    dict(style="luna", clip="shelby-pulse", cx=660, cy=400, cw=300,
         title="Shelby Pulse"),
    dict(style="luna", clip="peptide-tracker", cx=660, cy=410, cw=300,
         title="Peptide Tracker"),
    dict(style="luna", clip="order-entry-ladder", cx=660, cy=400, cw=330,
         title="Order Ladder"),
    dict(style="demo", clip="decibrrr-points", cx=670, cy=420, cw=280,
         title="DECIBRRR", color=(255, 212, 0)),
    dict(style="luna", clip="wick-markets-ride", cx=800, cy=330, cw=390,
         title="Wick Markets", menu=True),
    dict(style="luna", clip="emoji-candlestick-charts", cx=650, cy=400, cw=300,
         title="Emoji Candlestick Charts"),
    dict(style="demo", clip="temper-trade", cx=670, cy=420, cw=280,
         title="TEMPER TRADE", color=(57, 255, 20)),
    dict(style="wmp", clip="aptos-validator-globe", cx=820, cy=360, cw=390,
         title="Aptos validator globe"),
    dict(style="luna", clip="maxxp-desktop", cx=660, cy=410, cw=300,
         title="MaxXP - Live Dev Stats"),
    dict(style="ie", clip="commits-sh-menubar", cx=660, cy=420, cw=330,
         title="commits.sh - Microsoft Internet Explorer", url="http://commits.sh/"),
]
TIMELINE = [
    dict(spec, clip_in=HIGHLIGHTS[spec["clip"]]["intro"],
         t0=round(FIRST_OPEN + i * STEP, 3), t1=round(FIRST_OPEN + i * STEP + HOLD, 3))
    for i, spec in enumerate(SHOW)
]
# What the camera frames with no window up: the desktop icons being
# double-clicked at the start, then the login screen after log off.
START_REGION = (0, 120, 420, 560)
LOGIN_REGION = (260, 290, 840, 280)  # logo, user tile, and the hint line
DOUBLE_CLICK = (0.95, 1.10)  # cursor double-clicks the Demo Reel icon
ICON_SELECTED = (0.95, 1.30)
LOGOFF = (25.45, 26.05)  # desktop fades to the login screen

DESKTOP_ICONS = [
    ("desktop/about.webp", "About Me"),
    ("toolbar/folder.webp", "My Documents"),
    ("desktop/resume.webp", "My Resume"),
    ("desktop/projects.webp", "My Projects"),
    ("start-menu/mediaPlayer.webp", "Demo Reel"),
    ("start-menu/cmd.webp", "Dev Stats"),
    ("desktop/contact.webp", "Contact Me"),
    ("desktop/recycle-full.png", "Recycle Bin"),
]
DEMO_REEL_ICON = 4
SCROLLER = ("   *   greetings to aptos labs   *   decibel   *   shelby   *   whop   *   content rewards   *   "
            "built by max mohammadi   *   maxmohammadi.com   *")

# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------


def px(v: float) -> int:
    """Logical XP pixels -> texture pixels (round half up, not to even)."""
    return int(math.floor(v * S + 0.5))


@lru_cache(maxsize=None)
def font(name: str, size: float) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(os.path.join(FONT_DIR, name), px(size))


TAHOMA, TAHOMA_B, TREBUCHET_B = "Tahoma.ttf", "Tahoma Bold.ttf", "Trebuchet MS Bold.ttf"


@lru_cache(maxsize=None)
def icon(rel: str, size: int) -> Image.Image:
    im = Image.open(os.path.join(GUI, rel)).convert("RGBA")
    return im.resize((px(size), px(size)), Image.LANCZOS)


def vgradient(w: int, h: int, stops: list[tuple[float, tuple[int, int, int]]]) -> Image.Image:
    ys = np.linspace(0.0, 1.0, max(h, 1))
    col = np.stack([np.interp(ys, [s for s, _ in stops], [c[i] for _, c in stops]) for i in range(3)], axis=1)
    return Image.fromarray(np.repeat(col[:, None, :], max(w, 1), axis=1).astype(np.uint8), "RGB")


def rounded_mask(w: int, h: int, r: int, corners=(True, True, True, True)) -> Image.Image:
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255, corners=corners)
    return m


def shadow_text(d: ImageDraw.ImageDraw, xy, text, fnt, fill, shadow, off=1):
    x, y = xy
    d.text((x + px(off), y + px(off)), text, font=fnt, fill=shadow)
    d.text((x, y), text, font=fnt, fill=fill)


def fit_text(text: str, fnt, max_w: int) -> str:
    if fnt.getlength(text) <= max_w:
        return text
    while text and fnt.getlength(text + "...") > max_w:
        text = text[:-1]
    return text + "..."


def pixel_text(text: str, size: int, scale: int, top, bottom=None, shadow=None) -> Image.Image:
    """Aliased Tahoma Bold blown up with nearest-neighbour: keygen-era pixel type."""
    f = ImageFont.truetype(os.path.join(FONT_DIR, TAHOMA_B), size)
    l, t, r, b = f.getbbox(text)
    w, h = r - l + 3, b - t + 3
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    d.fontmode = "1"
    d.text((1 - l, 1 - t), text, font=f, fill=255)
    m = m.resize((w * scale, h * scale), Image.NEAREST)
    out = Image.new("RGBA", m.size, (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", m.size, shadow + (255,))
        out.paste(sh, (scale, scale), m)
    grad = vgradient(m.width, m.height, [(0.0, top), (1.0, bottom or top)])
    out.paste(grad, (0, 0), m)
    return out


LUNA_TITLE = [(0.00, (9, 151, 255)), (0.08, (0, 83, 238)), (0.40, (0, 80, 238)), (0.88, (0, 102, 255)),
              (0.93, (0, 102, 255)), (0.95, (0, 91, 255)), (0.96, (0, 61, 215)), (1.00, (0, 61, 215))]


def title_button(kind: str, size: int, dark: bool = False) -> Image.Image:
    if kind == "close":
        top, bot = (232, 128, 92), (199, 60, 28)
    elif dark:
        top, bot = (86, 116, 170), (34, 55, 98)
    else:
        top, bot = (88, 152, 255), (30, 94, 222)
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    im.paste(vgradient(size, size, [(0, top), (1, bot)]), (0, 0), rounded_mask(size, size, px(3)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=px(3), outline=(255, 255, 255, 230), width=px(1))
    u = size / 21.0  # glyphs are laid out on XP's 21px button grid
    white = (255, 255, 255, 255)
    if kind == "min":
        d.rectangle([5 * u, 13 * u, 12 * u, 15.5 * u], fill=white)
    elif kind == "max":
        d.rectangle([5 * u, 5 * u, 15.5 * u, 15.5 * u], outline=white, width=max(2, int(1.3 * u)))
        d.rectangle([5 * u, 5 * u, 15.5 * u, 7.6 * u], fill=white)
    else:
        w = max(2, int(2.2 * u))
        d.line([6 * u, 6 * u, 15 * u, 15 * u], fill=white, width=w)
        d.line([15 * u, 6 * u, 6 * u, 15 * u], fill=white, width=w)
    return im


def app_icon(size: int) -> Image.Image:
    """Generic XP application glyph: a tiny window with a blue title bar."""
    s = px(size)
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([1, 2, s - 2, s - 2], fill=(255, 255, 255, 255), outline=(40, 60, 120, 255))
    d.rectangle([2, 3, s - 3, 3 + s // 4], fill=(0, 84, 227, 255))
    return im


# ---------------------------------------------------------------------------
# Window chrome. Each builder returns (static RGBA chrome, content rect in
# texture px relative to the window). Dynamic parts are drawn per frame.
# ---------------------------------------------------------------------------
TB = 30  # Luna title bar height


def luna_frame(w: int, h: int, title: str, ico: Image.Image, dark_buttons=False) -> Image.Image:
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    full = rounded_mask(w, h, px(8), corners=(True, True, False, False))
    im.paste((0, 85, 229, 255), (0, 0), full)
    im.paste(vgradient(w, px(TB), LUNA_TITLE), (0, 0), full.crop((0, 0, w, px(TB))))
    d = ImageDraw.Draw(im)
    f = px(3)
    d.rectangle([f, px(TB), w - f - 1, h - f - 1], fill=BODY)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=px(8), outline=(0, 30, 160), width=px(1),
                        corners=(True, True, False, False))
    im.paste(ico, (px(6), px(7)), ico)
    shadow_text(d, (px(27), px(6.5)), fit_text(title, font(TREBUCHET_B, 13), w - px(110)),
                font(TREBUCHET_B, 13), (255, 255, 255), (15, 16, 137))
    bs = px(21)
    for i, kind in enumerate(["close", "max", "min"]):
        b = title_button(kind, bs, dark_buttons)
        im.paste(b, (w - px(5) - bs - i * (bs + px(2)), px(5)), b)
    return im


def caret(d: ImageDraw.ImageDraw, x: float, y: float, size: float = 5, fill=(0, 0, 0)):
    """Small down-pointing triangle (Tahoma has no glyph for it)."""
    d.polygon([(x, y), (x + px(size), y), (x + px(size) / 2, y + px(size) * 0.6)], fill=fill)


def menu_bar(d: ImageDraw.ImageDraw, x0: int, y0: int, w: int, items: list[str], h: int = 20):
    f = font(TAHOMA, 11)
    x = x0 + px(6)
    for it in items:
        d.text((x, y0 + px(3.5)), it, font=f, fill=(0, 0, 0))
        x += int(f.getlength(it)) + px(14)
    d.line([x0, y0 + px(h) - 1, x0 + w, y0 + px(h) - 1], fill=(255, 255, 255))


def build_luna(win) -> tuple[Image.Image, tuple[int, int, int, int]]:
    cw, ch = px(win["cw"]), px(win["ch"])
    menu = px(20) if win.get("menu") else 0
    w, h = cw + 2 * px(3), px(TB) + menu + ch + px(3)
    im = luna_frame(w, h, win["title"], app_icon(16))
    if menu:
        menu_bar(ImageDraw.Draw(im), px(3), px(TB), cw, ["File", "Edit", "View", "Help"])
    return im, (px(3), px(TB) + menu, cw, ch)


IE_MENU, IE_TOOL, IE_ADDR, IE_STATUS = 22, 38, 26, 22


def build_ie(win):
    cw, ch = px(win["cw"]), px(win["ch"])
    top = px(TB) + px(IE_MENU) + px(IE_TOOL) + px(IE_ADDR)
    w, h = cw + 2 * px(3), top + ch + px(IE_STATUS) + px(3)
    im = luna_frame(w, h, win["title"], icon("desktop/projects.webp", 16))
    d = ImageDraw.Draw(im)
    f3 = px(3)
    menu_bar(d, f3, px(TB), cw, ["File", "Edit", "View", "Favorites", "Tools", "Help"], IE_MENU)
    flag = icon("system/windows-flag.webp", 18)  # the IE "throbber" slot
    fx = w - f3 - px(40)
    d.rectangle([fx, px(TB), w - f3 - 1, px(TB) + px(IE_MENU) - 1], fill=(255, 255, 255))
    im.paste(flag, (fx + px(11), px(TB) + px(2)), flag)
    # toolbar
    ty = px(TB) + px(IE_MENU)
    d.line([f3, ty + px(IE_TOOL) - 1, w - f3, ty + px(IE_TOOL) - 1], fill=(172, 168, 153))
    f11 = font(TAHOMA, 11)
    back, fwd, home = icon("toolbar/back.webp", 26), icon("toolbar/forward.webp", 26), icon("toolbar/home.webp", 22)
    x = f3 + px(6)
    im.paste(back, (x, ty + px(6)), back)
    d.text((x + px(30), ty + px(12)), "Back", font=f11, fill=(0, 0, 0))
    caret(d, x + px(58), ty + px(17))
    x += px(74)
    im.paste(fwd, (x, ty + px(6)), fwd)
    caret(d, x + px(30), ty + px(17))
    x += px(44)
    d.line([x, ty + px(7), x, ty + px(IE_TOOL) - px(7)], fill=(172, 168, 153))
    im.paste(home, (x + px(8), ty + px(8)), home)
    # address bar
    ay = ty + px(IE_TOOL)
    d.line([f3, ay + px(IE_ADDR) - 1, w - f3, ay + px(IE_ADDR) - 1], fill=(172, 168, 153))
    d.text((f3 + px(6), ay + px(6.5)), "Address", font=f11, fill=(90, 90, 90))
    x0, x1 = f3 + px(58), w - f3 - px(52)
    d.rectangle([x0, ay + px(3), x1, ay + px(22)], fill=(255, 255, 255), outline=(127, 157, 185), width=px(1))
    ie16 = icon("desktop/projects.webp", 16)
    im.paste(ie16, (x0 + px(3), ay + px(4.5)), ie16)
    d.text((x0 + px(23), ay + px(6.5)), fit_text(win["url"], f11, x1 - x0 - px(46)), font=f11, fill=(0, 0, 0))
    dd = [x1 - px(17), ay + px(4), x1 - px(1), ay + px(21)]
    im.paste(vgradient(dd[2] - dd[0], dd[3] - dd[1], [(0, (196, 214, 251)), (1, (154, 185, 245))]), (dd[0], dd[1]))
    caret(d, dd[0] + px(5.5), dd[1] + px(7), 6, (30, 50, 110))
    go = icon("toolbar/go.webp", 18)
    im.paste(go, (x1 + px(6), ay + px(4)), go)
    d.text((x1 + px(27), ay + px(6.5)), "Go", font=f11, fill=(0, 0, 0))
    # status bar frame; the text is dynamic
    sy = top + ch
    d.line([f3, sy, w - f3, sy], fill=(172, 168, 153))
    for sx in (w - f3 - px(170), w - f3 - px(128), w - f3 - px(104)):
        d.line([sx, sy + px(4), sx, sy + px(IE_STATUS) - px(3)], fill=(172, 168, 153))
    globe = icon("desktop/projects.webp", 14)
    im.paste(globe, (w - f3 - px(98), sy + px(4)), globe)
    d.text((w - f3 - px(80), sy + px(5)), "Internet", font=f11, fill=(0, 0, 0))
    return im, (f3, top, cw, ch)


WMP_PAD, WMP_TITLE, WMP_INFO, WMP_SEEK, WMP_CTRL = 6, 24, 18, 12, 40


def build_wmp(win):
    cw, ch = px(win["cw"]), px(win["ch"])
    p = px(WMP_PAD)
    w = cw + 2 * p
    h = p + px(WMP_TITLE) + ch + px(WMP_INFO) + px(WMP_SEEK) + px(WMP_CTRL) + p
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    im.paste(vgradient(w, h, [(0, (46, 72, 118)), (0.08, (24, 40, 74)), (0.7, (12, 22, 44)), (1, (8, 14, 30))]),
             (0, 0), rounded_mask(w, h, px(10)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=px(10), outline=(106, 137, 192), width=px(1))
    wm = icon("start-menu/mediaPlayer.webp", 16)
    im.paste(wm, (p + px(2), p + px(3)), wm)
    d.text((p + px(24), p + px(4)), "Windows Media Player", font=font(TAHOMA_B, 11), fill=(231, 238, 249))
    bs = px(17)
    for i, kind in enumerate(["close", "max", "min"]):
        b = title_button(kind, bs, dark=True)
        im.paste(b, (w - p - bs - i * (bs + px(2)), p + px(3)), b)
    cy = p + px(WMP_TITLE)
    d.rectangle([p - 1, cy - 1, p + cw, cy + ch], outline=(70, 96, 150), width=1)
    return im, (p, cy, cw, ch)


DEMO_HEAD, DEMO_FOOT, DEMO_PAD = 78, 64, 12


def build_demo(win):
    cw, ch = px(win["cw"]), px(win["ch"])
    w, h = cw + 2 * px(DEMO_PAD), px(DEMO_HEAD) + ch + px(DEMO_FOOT)
    c = win["color"]
    im = Image.new("RGBA", (w, h), (4, 4, 8, 255))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w - 1, h - 1], outline=c, width=px(2))
    d.rectangle([px(4), px(4), w - px(4) - 1, h - px(4) - 1], outline=tuple(v // 3 for v in c), width=px(1))
    cx, cy = px(DEMO_PAD), px(DEMO_HEAD)
    d.rectangle([cx - px(1) - 1, cy - px(1) - 1, cx + cw + px(1), cy + ch + px(1)], outline=c, width=px(1))
    # footer buttons
    labels = ["PLAY", "ABOUT", "EXIT"]
    bw, gap = px(64), px(10)
    bx = (w - (3 * bw + 2 * gap)) // 2
    by = cy + ch + px(10)
    for i, lab in enumerate(labels):
        x = bx + i * (bw + gap)
        d.rectangle([x, by, x + bw, by + px(20)], fill=(18, 18, 26), outline=c, width=px(1))
        t = pixel_text(lab, 9, 2, (255, 255, 255))
        im.paste(t, (x + (bw - t.width) // 2, by + (px(20) - t.height) // 2 + 1), t)
    return im, (cx, cy, cw, ch)


BUILDERS = {"luna": build_luna, "ie": build_ie, "wmp": build_wmp, "demo": build_demo}

# ---------------------------------------------------------------------------
# Clips
# ---------------------------------------------------------------------------


def clip_path(clip_id: str) -> str:
    if source := HIGHLIGHTS[clip_id].get("source"):
        return os.path.join(ROOT, source)
    hits = glob.glob(os.path.join(ROOT, "public", "videos", "reels", f"{clip_id}-{'[0-9a-f]' * 8}.mp4"))
    if len(hits) != 1:
        raise SystemExit(f"expected one reel for {clip_id}, found {hits}")
    return hits[0]


@lru_cache(maxsize=None)
def probe(clip_id: str) -> tuple[int, int, float]:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height:format=duration", "-of", "json", clip_path(clip_id)],
                         capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    return j["streams"][0]["width"], j["streams"][0]["height"], float(j["format"]["duration"])


def prepare_windows() -> list[dict]:
    wins = []
    for i, spec in enumerate(TIMELINE):
        win = dict(spec, id=i)
        cw_px, ch_px, dur = probe(win["clip"])
        pick = HIGHLIGHTS[win["clip"]]
        if not (0 <= pick["start"] <= win["clip_in"] and
                win["clip_in"] + HOLD <= pick["start"] + pick["duration"] <= dur + 0.001):
            raise SystemExit(f"invalid highlight bounds: {win['clip']}")
        if crop := pick.get("crop"):
            cw_px, ch_px = crop[2:]
        win["ch"] = round(win["cw"] * ch_px / cw_px)
        win["clip_duration"] = dur
        if win["clip_in"] + (win["t1"] - win["t0"]) > dur:
            raise SystemExit(f"window {i}: {win['clip']} is only {dur:.1f}s")
        wins.append(win)
    return wins


def decode_clip(win: dict) -> str:
    """Decode the window's clip span, scaled to its content box, as raw RGB."""
    _, _, cw, ch = win["content"]
    n = int(math.ceil((win["t1"] - win["t0"]) * FPS)) + 2
    source = clip_path(win["clip"])
    crop = HIGHLIGHTS[win["clip"]].get("crop")
    signature = hashlib.sha1((source + str(os.stat(source).st_mtime_ns) + str(crop)).encode()).hexdigest()[:8]
    filters = [f"fps={FPS}"]
    if crop:
        x, y, w, h = crop
        filters.append(f"crop={w}:{h}:{x}:{y}")
    filters.append(f"scale={cw}:{ch}:flags=lanczos")
    out = os.path.join(BUILD, "clips", f"{win['id']:02d}-{win['clip']}-{signature}-{cw}x{ch}-{win['clip_in']}.raw")
    if not (os.path.exists(out) and os.path.getsize(out) == n * cw * ch * 3):
        os.makedirs(os.path.dirname(out), exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{win['clip_in']:.3f}", "-i", source,
                        "-frames:v", str(n), "-vf", ",".join(filters),
                        "-pix_fmt", "rgb24", "-f", "rawvideo", out], check=True)
    have = os.path.getsize(out) // (cw * ch * 3)
    win["raw"], win["raw_frames"] = out, have
    return out


# ---------------------------------------------------------------------------
# Static layers
# ---------------------------------------------------------------------------


def desktop_icon_cell(i: int) -> tuple[int, int]:
    return 8, 8 + i * 78  # logical top-left of a 76px-wide icon cell


def draw_icon(canvas: Image.Image, i: int, selected: bool):
    rel, label = DESKTOP_ICONS[i]
    x, y = desktop_icon_cell(i)
    ico = icon(rel, 40)
    if selected:
        tint = Image.new("RGBA", ico.size, (49, 106, 197, 255))
        ico = Image.composite(Image.blend(ico, tint, 0.45), ico, ico.split()[3].point(lambda a: 255 if a > 8 else 0))
    canvas.paste(ico, (px(x + 18), px(y + 2)), ico)
    d = ImageDraw.Draw(canvas)
    f = font(TAHOMA, 11)
    tw = f.getlength(label)
    tx, ty = px(x + 38) - tw / 2, px(y + 46)
    if selected:
        d.rectangle([tx - px(2), ty - px(1), tx + tw + px(2), ty + px(14)], fill=(49, 106, 197))
        d.text((tx, ty), label, font=f, fill=(255, 255, 255))
    else:
        shadow_text(d, (tx, ty), label, f, (255, 255, 255), (0, 0, 0))


def build_desktop() -> Image.Image:
    wall = Image.open(os.path.join(GUI, "bgs", "bliss-desktop.webp")).convert("RGB")
    scale = max(W / wall.width, H / wall.height)
    wall = wall.resize((round(wall.width * scale), round(wall.height * scale)), Image.LANCZOS)
    ox, oy = (wall.width - W) // 2, (wall.height - H) // 2
    canvas = wall.crop((ox, oy, ox + W, oy + H)).convert("RGBA")
    for i in range(len(DESKTOP_ICONS)):
        draw_icon(canvas, i, selected=False)
    # taskbar
    tb = px(TASKBAR)
    tile = Image.open(os.path.join(GUI, "taskbar", "taskbar-bg.webp")).convert("RGB").resize((px(50), tb), Image.LANCZOS)
    for x in range(0, W, tile.width):
        canvas.paste(tile, (x, H - tb))
    start = Image.open(os.path.join(GUI, "taskbar", "start-button.webp")).convert("RGBA").resize((px(94), tb), Image.LANCZOS)
    canvas.paste(start, (0, H - tb), start)
    tray = Image.open(os.path.join(GUI, "taskbar", "system-tray-bg.webp")).convert("RGBA").resize((px(118), tb), Image.LANCZOS)
    canvas.paste(tray, (W - tray.width, H - tb), tray)
    d = ImageDraw.Draw(canvas)
    for j, rel in enumerate(["tray/volume.webp", "tray/info.webp"]):
        ic = icon(rel, 16)
        canvas.paste(ic, (W - tray.width + px(12 + j * 22), H - tb + px(7)), ic)
    f = font(TAHOMA, 11)
    clock = "9:41 PM"
    d.text((W - px(10) - f.getlength(clock), H - tb + px(8)), clock, font=f, fill=(255, 255, 255))
    return canvas


def login_image() -> Image.Image:
    """The site's login screen, drawn from the values in src/xp/boot.css."""
    xs, ys = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    # radial-gradient(120% 80% at 50% 48%, #6ea2e8 0%, #3f74cf 42%, #22509f 72%, #1a3f86 100%)
    dist = np.sqrt(((xs - 0.5 * W) / (1.2 * W)) ** 2 + ((ys - 0.48 * H) / (0.8 * H)) ** 2)
    stops = [0.0, 0.42, 0.72, 1.0]
    cols = [(110, 162, 232), (63, 116, 207), (34, 80, 159), (26, 63, 134)]
    rgb = np.stack([np.interp(dist, stops, [c[i] for c in cols]) for i in range(3)], axis=-1)
    im = Image.fromarray(rgb.astype(np.uint8), "RGB").convert("RGBA")
    d = ImageDraw.Draw(im)
    band = px(88)
    d.rectangle([0, 0, W, band], fill=(20, 53, 111))
    d.rectangle([0, band - px(2), W, band], fill=(232, 163, 61))
    d.rectangle([0, H - band, W, H], fill=(20, 53, 111))
    d.rectangle([0, H - band, W, H - band + px(2)], fill=(232, 163, 61))
    # centre block: 1080px wide grid of 1fr | 1px divider | 1fr with 46px gaps
    col = (1080 - 1 - 92) / 2
    left_end, divider_x, right_x = 180 + col, 180 + col + 46, 180 + col + 47 + 46
    cy = 450
    logo = Image.open(os.path.join(GUI, "boot", "xp-logo.webp")).convert("RGBA")
    logo = logo.resize((px(210), px(210 * logo.height / logo.width)), Image.LANCZOS)
    block_h = logo.height / S + 14 + 25
    top = cy - block_h / 2
    im.paste(logo, (px(left_end) - logo.width, px(top)), logo)
    f17, f17b = font(TAHOMA, 17), font(TAHOMA_B, 17)
    parts = [("To begin, click on ", f17), ("Maxwell Mohammadi", f17b), (" to log in", f17)]
    total = sum(f.getlength(t) for t, f in parts)
    x, ty = px(left_end) - total, px(top + logo.height / S + 14)
    for t, f in parts:
        shadow_text(d, (x, ty), t, f, (255, 255, 255), (22, 40, 80))
        x += f.getlength(t)
    # divider: transparent -> white 50% -> transparent
    dv = np.interp(np.linspace(0, 1, px(block_h)), [0, 0.5, 1], [0, 128, 0]).astype(np.uint8)
    line = Image.new("RGBA", (max(1, px(1)), len(dv)), (255, 255, 255, 0))
    line.putalpha(Image.fromarray(np.repeat(dv[:, None], line.width, axis=1)))
    im.alpha_composite(line, (px(divider_x), px(top)))
    # user tile: avatar plate, name, title
    ax, ay = px(right_x + 10), px(cy - 32)
    av = px(64)
    im.paste(vgradient(av, av, [(0, (255, 215, 130)), (1, (240, 171, 60))]), (ax, ay), rounded_mask(av, av, px(6)))
    d.rounded_rectangle([ax, ay, ax + av - 1, ay + av - 1], radius=px(6), outline=(255, 255, 255), width=px(2))
    fm = font(TAHOMA_B, 32)
    d.text((ax + av / 2, ay + av / 2), "M", font=fm, fill=(18, 60, 134), anchor="mm")
    tx = ax + av + px(14)
    shadow_text(d, (tx, px(cy - 22)), "Maxwell Mohammadi", font(TAHOMA, 24), (255, 255, 255), (22, 40, 80))
    d.text((tx, px(cy + 8)), "Product engineer", font=font(TAHOMA_B, 12), fill=(215, 228, 255))
    # bottom chrome: restart control and the two hint lines
    rs = Image.open(os.path.join(GUI, "system", "restart.webp")).convert("RGBA").resize((px(30), px(30)), Image.LANCZOS)
    im.paste(rs, (px(44), H - px(26) - rs.height), rs)
    d.text((px(44 + 30 + 11), H - px(26 + 15)), "Restart MaxXP", font=font(TAHOMA, 14), fill=(255, 255, 255),
           anchor="lm")
    f13 = font(TAHOMA, 13)
    for i, line_text in enumerate(["After you log on, the system's yours to explore.",
                                   "Every window is wired to real portfolio content."]):
        d.text((W - px(44), H - px(26) - px(17) * (1 - i)), line_text, font=f13, fill=(255, 255, 255), anchor="rb")
    return im.convert("RGB")


# ---------------------------------------------------------------------------
# Motion
# ---------------------------------------------------------------------------


def smoothstep(a: float, b: float, t: float) -> float:
    if b <= a:
        return 1.0
    u = min(1.0, max(0.0, (t - a) / (b - a)))
    return u * u * (3 - 2 * u)


def hotspot(win: dict) -> tuple[float, float]:
    """Where the cursor heads once a window opens (logical px)."""
    x, y, ww, wh = win["rect"]
    style = win["style"]
    if style == "ie":
        return x + ww - 30, y + TB + IE_MENU + IE_TOOL + 13
    if style == "wmp":
        return x + 44, y + wh - 24
    if style == "demo":
        return x + ww / 2 - 70, y + wh - 44
    return x + ww * 0.62, y + wh * 0.58


def cursor_keys(wins: list[dict]) -> list[tuple[float, float, float]]:
    ix, iy = desktop_icon_cell(DEMO_REEL_ICON)
    keys = [(0.0, 980.0, 560.0), (0.25, 980.0, 560.0), (0.85, ix + 36.0, iy + 24.0), (1.25, ix + 36.0, iy + 24.0)]
    for win in wins:
        hx, hy = hotspot(win)
        keys.append((win["t0"] + 0.08, keys[-1][1], keys[-1][2]))
        keys.append((win["t0"] + 0.48, hx, hy))
    keys.sort()
    return keys


def cursor_at(keys, t: float) -> tuple[float, float]:
    prev = keys[0]
    for k in keys[1:]:
        if t <= k[0]:
            u = smoothstep(prev[0], k[0], t)
            x, y = prev[1] + (k[1] - prev[1]) * u, prev[2] + (k[2] - prev[2]) * u
            break
        prev = k
    else:
        x, y = keys[-1][1], keys[-1][2]
    # a hand on a mouse is never perfectly still
    return x + 2.2 * math.sin(t * 1.7) + 1.1 * math.sin(t * 4.3), y + 1.6 * math.cos(t * 1.3)


def open_windows(wins, t: float) -> list[dict]:
    return [w for w in wins if w["t0"] <= t < w["t1"]]


# ---------------------------------------------------------------------------
# Frame rendering
# ---------------------------------------------------------------------------
_STATE: dict = {}


def init_worker(wins: list[dict]):
    _STATE["wins"] = wins
    _STATE["desktop"] = build_desktop()
    selected = _STATE["desktop"].copy()
    draw_icon(selected, DEMO_REEL_ICON, selected=True)
    _STATE["desktop_selected"] = selected
    _STATE["login"] = login_image()
    _STATE["chrome"] = {w["id"]: BUILDERS[w["style"]](w)[0] for w in wins}
    _STATE["cursor"] = Image.open(os.path.join(GUI, "cursors", "arrow.png")).convert("RGBA").resize(
        (px(32), px(32)), Image.NEAREST)
    try:
        hg = Image.open(os.path.join(GUI, "cursors", "hourglass.cur")).convert("RGBA")
        _STATE["hourglass"] = hg.resize((px(hg.width), px(hg.height)), Image.NEAREST)
    except Exception:
        _STATE["hourglass"] = _STATE["cursor"]
    _STATE["keys"] = cursor_keys(wins)
    _STATE["raw"] = {w["id"]: np.memmap(w["raw"], dtype=np.uint8, mode="r",
                                        shape=(w["raw_frames"], w["content"][3], w["content"][2], 3)) for w in wins}
    _STATE["scroller"] = {}
    rng = random.Random(7)
    _STATE["stars"] = {w["id"]: [(rng.random(), rng.random(), 25 + 70 * rng.random(), rng.choice([1, 1, 2]))
                                 for _ in range(46)] for w in wins if w["style"] == "demo"}


def draw_dynamic(canvas: Image.Image, win: dict, t: float):
    x0, y0 = px(win["rect"][0]), px(win["rect"][1])
    cx, cy, cw, ch = win["content"]
    d = ImageDraw.Draw(canvas)
    style, el = win["style"], t - win["t0"]
    ww, wh = _STATE["chrome"][win["id"]].size
    if style == "ie":
        sy = y0 + cy + ch
        status = "Opening page " + win["url"] + "..." if el < 0.45 else "Done"
        ie16 = icon("desktop/projects.webp", 14)
        canvas.paste(ie16, (x0 + px(8), sy + px(4)), ie16)
        d.text((x0 + px(28), sy + px(5)), fit_text(status, font(TAHOMA, 11), ww - px(210)), font=font(TAHOMA, 11),
               fill=(0, 0, 0))
    elif style == "wmp":
        p = px(WMP_PAD)
        pos = win["clip_in"] + el
        iy = y0 + cy + ch + px(3)
        d.text((x0 + p + px(2), iy), "Now Playing: " + win["title"], font=font(TAHOMA, 11), fill=(159, 193, 255))
        duration = int(win["clip_duration"])
        ts = f"{int(pos) // 60:02d}:{int(pos) % 60:02d} / {duration // 60:02d}:{duration % 60:02d}"
        fnt = font(TAHOMA, 11)
        d.text((x0 + ww - p - px(4) - fnt.getlength(ts), iy), ts, font=fnt, fill=(159, 193, 255))
        sy = y0 + cy + ch + px(WMP_INFO) + px(3)
        sx0, sx1 = x0 + p + px(2), x0 + ww - p - px(2)
        d.rounded_rectangle([sx0, sy, sx1, sy + px(6)], radius=px(3), fill=(15, 26, 48), outline=(79, 111, 166))
        prog = max(0.0, min(1.0, pos / win["clip_duration"]))
        px_prog = sx0 + int((sx1 - sx0) * prog)
        d.rounded_rectangle([sx0, sy, max(sx0 + px(6), px_prog), sy + px(6)], radius=px(3), fill=(63, 169, 255))
        d.ellipse([px_prog - px(6), sy - px(3), px_prog + px(6), sy + px(9)], fill=(230, 240, 255), outline=(40, 90, 170))
        by = y0 + wh - p - px(WMP_CTRL) // 2
        # the big glass play/pause button, then stop / prev / next
        r = px(16)
        bx = x0 + p + px(28)
        glass = vgradient(2 * r, 2 * r, [(0, (150, 205, 255)), (0.5, (42, 111, 216)), (1, (18, 60, 150))])
        m = Image.new("L", (2 * r, 2 * r), 0)
        ImageDraw.Draw(m).ellipse([0, 0, 2 * r - 1, 2 * r - 1], fill=255)
        canvas.paste(glass, (bx - r, by - r), m)
        d.ellipse([bx - r, by - r, bx + r, by + r], outline=(200, 225, 255), width=px(1))
        d.rectangle([bx - px(6), by - px(7), bx - px(2), by + px(7)], fill=(255, 255, 255))
        d.rectangle([bx + px(2), by - px(7), bx + px(6), by + px(7)], fill=(255, 255, 255))
        for k, glyph in enumerate(["stop", "prev", "next"]):
            sx = bx + px(38 + k * 30)
            rr = px(11)
            m2 = Image.new("L", (2 * rr, 2 * rr), 0)
            ImageDraw.Draw(m2).ellipse([0, 0, 2 * rr - 1, 2 * rr - 1], fill=255)
            canvas.paste(vgradient(2 * rr, 2 * rr, [(0, (90, 120, 170)), (1, (26, 42, 78))]), (sx - rr, by - rr), m2)
            g = (220, 232, 255)
            if glyph == "stop":
                d.rectangle([sx - px(4), by - px(4), sx + px(4), by + px(4)], fill=g)
            elif glyph == "prev":
                d.polygon([(sx + px(4), by - px(5)), (sx - px(2), by), (sx + px(4), by + px(5))], fill=g)
                d.rectangle([sx - px(5), by - px(5), sx - px(3), by + px(5)], fill=g)
            else:
                d.polygon([(sx - px(4), by - px(5)), (sx + px(2), by), (sx - px(4), by + px(5))], fill=g)
                d.rectangle([sx + px(3), by - px(5), sx + px(5), by + px(5)], fill=g)
        vx = x0 + ww - p - px(90)
        d.polygon([(vx, by - px(3)), (vx + px(5), by - px(3)), (vx + px(10), by - px(8)), (vx + px(10), by + px(8)),
                   (vx + px(5), by + px(3)), (vx, by + px(3))], fill=(200, 215, 240))
        d.line([vx + px(18), by, vx + px(80), by], fill=(79, 111, 166), width=px(3))
        d.line([vx + px(18), by, vx + px(62), by], fill=(63, 169, 255), width=px(3))
        d.ellipse([vx + px(58), by - px(5), vx + px(68), by + px(5)], fill=(230, 240, 255))
    elif style == "demo":
        c = win["color"]
        # starfield behind the header
        hx0, hy0, hw, hh = x0 + px(6), y0 + px(6), ww - px(12), px(DEMO_HEAD) - px(12)
        for sx, sy, sp, sz in _STATE["stars"][win["id"]]:
            xs = hx0 + int((sx * hw - sp * S * el) % hw)
            ys = hy0 + int(sy * hh)
            shade = 110 + int(145 * (sp - 25) / 70)
            d.rectangle([xs, ys, xs + px(sz) - 1, ys + px(sz) - 1], fill=(shade, shade, shade))
        head = _STATE.setdefault(("head", win["id"]), pixel_text("MAXMONEYCASH", 12, 3, (255, 255, 255), c, (0, 0, 0)))
        canvas.paste(head, (x0 + (ww - head.width) // 2, y0 + px(10)), head)
        sub = _STATE.setdefault(("sub", win["id"]), pixel_text("presents  " + win["title"], 8, 2, c))
        canvas.paste(sub, (x0 + (ww - sub.width) // 2, y0 + px(52)), sub)
        # scroller along the bottom
        scr = _STATE["scroller"].get(c)
        if scr is None:
            scr = pixel_text(SCROLLER, 8, 2, c)
            _STATE["scroller"][c] = scr
        lane_w, lane_y = ww - px(16), y0 + wh - px(24)
        off = int(el * 80 * S) % scr.width
        strip = Image.new("RGBA", (lane_w, scr.height), (0, 0, 0, 0))
        strip.paste(scr, (-off, 0), scr)
        strip.paste(scr, (-off + scr.width, 0), scr)
        canvas.paste(strip, (x0 + px(8), lane_y), strip)


def render_frame(f: int) -> tuple[int, list[float], list[float]]:
    t = f / FPS
    wins = _STATE["wins"]
    base = _STATE["desktop_selected"] if ICON_SELECTED[0] <= t < ICON_SELECTED[1] else _STATE["desktop"]
    canvas = base.copy()
    showing = open_windows(wins, t)
    for win in showing:
        chrome = _STATE["chrome"][win["id"]]
        x0, y0 = px(win["rect"][0]), px(win["rect"][1])
        canvas.paste(chrome, (x0, y0), chrome)
        cx, cy, cw, ch = win["content"]
        k = int(round((t - win["t0"]) * FPS))
        if k == 0 and win["style"] != "demo":
            canvas.paste(BODY, (x0 + cx, y0 + cy, x0 + cx + cw, y0 + cy + ch))  # XP paints chrome first
        else:
            frame = _STATE["raw"][win["id"]][min(k, win["raw_frames"] - 1)]
            canvas.paste(Image.fromarray(np.asarray(frame)), (x0 + cx, y0 + cy))
        draw_dynamic(canvas, win, t)
    # taskbar buttons for open windows, newest on the right and pressed
    if showing:
        d = ImageDraw.Draw(canvas)
        tb = px(TASKBAR)
        x = px(100)
        avail = W - px(118) - px(8) - x
        bw = min(px(160), avail // len(showing) - px(3))
        fnt = font(TAHOMA, 11)
        for i, win in enumerate(showing):
            active = i == len(showing) - 1
            top, bot = ((30, 82, 183), (21, 68, 165)) if active else ((60, 129, 243), (41, 106, 226))
            by = H - tb + px(4)
            m = rounded_mask(bw, px(22), px(3))
            canvas.paste(vgradient(bw, px(22), [(0, top), (1, bot)]), (x, by), m)
            d.rounded_rectangle([x, by, x + bw - 1, by + px(22) - 1], radius=px(3),
                                outline=(22, 60, 150) if active else (90, 150, 250), width=px(1))
            ic = {"ie": icon("desktop/projects.webp", 16), "wmp": icon("start-menu/mediaPlayer.webp", 16)}.get(
                win["style"], app_icon(16))
            canvas.paste(ic, (x + px(6), by + px(3)), ic)
            d.text((x + px(26), by + px(4)), fit_text(win["title"], fnt, bw - px(32)), font=fnt, fill=(255, 255, 255))
            x += bw + px(3)
    # cursor (hidden once we log off)
    if t < LOGOFF[0]:
        cxl, cyl = cursor_at(_STATE["keys"], t)
        cur = _STATE["hourglass"] if DOUBLE_CLICK[1] <= t < DOUBLE_CLICK[1] + 0.25 else _STATE["cursor"]
        canvas.paste(cur, (px(cxl), px(cyl)), cur)
    img = canvas.convert("RGB")
    if t >= LOGOFF[0]:
        img = Image.blend(img, _STATE["login"], smoothstep(LOGOFF[0], LOGOFF[1], t))
    small = np.asarray(img.resize((64, 40), Image.BILINEAR), dtype=np.float32) / 255.0
    mean = small.reshape(-1, 3).mean(axis=0)
    img.save(os.path.join(BUILD, "screen", f"{f + 1:04d}.jpg"), quality=98, subsampling=0)
    # what the camera should frame (logical px): the newest window, else the
    # desktop icons before the first one, else the login screen
    if showing:
        region = showing[-1]["rect"]
    elif t < LOGOFF[0] and t < TIMELINE[0]["t0"]:
        region = START_REGION
    elif t < LOGOFF[0]:
        region = _STATE["wins"][-1]["rect"]
    else:
        region = LOGIN_REGION
    return f, [round(float(v), 4) for v in mean], [round(float(v), 1) for v in region]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--at", help="comma-separated times (s) to render as previews only")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 4)
    args = ap.parse_args()
    os.makedirs(os.path.join(BUILD, "screen"), exist_ok=True)
    wins = prepare_windows()
    for win in wins:
        chrome, content = BUILDERS[win["style"]](win)
        win["content"] = content
        ww, wh = chrome.width / S, chrome.height / S
        win["x"] = round(min(max(win["cx"] - ww / 2, 6), LW - ww - 6))
        win["y"] = round(min(max(win["cy"] - wh / 2, 6), LH - TASKBAR - wh - 6))
        win["rect"] = [win["x"], win["y"], ww, wh]
        decode_clip(win)
    frames = [int(round(float(v) * FPS)) for v in args.at.split(",")] if args.at else list(range(FRAMES))
    with ProcessPoolExecutor(max_workers=args.jobs, initializer=init_worker, initargs=(wins,)) as pool:
        results = sorted(pool.map(render_frame, frames, chunksize=4))
    if args.at:
        for f, _, _ in results:
            print(os.path.join(BUILD, "screen", f"{f + 1:04d}.jpg"))
        return
    timeline = {
        "fps": FPS, "frames": FRAMES, "screen": [LW, LH], "texture": [W, H],
        "windows": [{k: w[k] for k in ("id", "style", "title", "clip", "t0", "t1", "rect")} for w in wins],
        "spill": [m for _, m, _ in results],
        "regions": [r for _, _, r in results],
        "logoff": LOGOFF,
    }
    with open(os.path.join(BUILD, "timeline.json"), "w") as fh:
        json.dump(timeline, fh)
    print(f"wrote {len(results)} frames to {os.path.join(BUILD, 'screen')} and timeline.json")


if __name__ == "__main__":
    main()
