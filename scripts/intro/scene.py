"""MaxXP intro, stage 2 of 2: film the monitor.

Run inside Blender (EEVEE). Builds a 20" 16:10 LCD on a desk in a dark room,
maps stage 1's frame sequence onto its screen, and films it with a handheld
phone-like camera that follows the active window.

  blender -b --factory-startup --python scripts/intro/scene.py -- \
      --orient portrait --out .intro-build/render/portrait        # full run
  blender -b --factory-startup --python scripts/intro/scene.py -- \
      --orient landscape --still 150 --out .intro-build/still.png   # one frame
"""
import argparse
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BUILD = os.path.join(ROOT, ".intro-build")

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--orient", choices=["portrait", "landscape"], default="portrait")
ap.add_argument("--out", required=True)
ap.add_argument("--still", type=int, help="render just this frame (1-based) to --out as a PNG")
ap.add_argument("--stills", help="comma-separated frames (1-based) to render as --out/NNNN.png")
ap.add_argument("--start", type=int, default=1)
ap.add_argument("--end", type=int)
ap.add_argument("--samples", type=int, default=32)
ap.add_argument("--scale", type=int, default=100, help="resolution percentage")
ap.add_argument("--view", default="Standard", help="view transform: Standard or AgX")
ap.add_argument("--emission", type=float, default=1.0, help="screen brightness")
ap.add_argument("--bloom", type=float, default=0.0, help="optional bloom strength; off to preserve screen detail")
ap.add_argument("--login-ending", action="store_true", help="film the generated login / desktop ending")
ap.add_argument("--showcase", action="store_true", help="use large, orientation-specific original-recording compositions")
args = ap.parse_args(argv)

timeline_path = os.path.join(BUILD, "showcase", f"timeline-{args.orient}.json") if args.showcase else os.path.join(BUILD, "timeline.json")
timeline = json.load(open(timeline_path))
FPS, FRAMES = timeline["fps"], timeline["frames"]

# 20" 16:10 panel, metres. The monitor faces -Y; the desk top is z = 0.
SW, SH = 0.4308, 0.2692
BEZEL_SIDE, BEZEL_TOP, BEZEL_BOTTOM = 0.017, 0.017, 0.029
ZC = 0.37  # screen centre height above the desk
LIP = 0.004  # bezel lip in front of the panel

# ---------------------------------------------------------------------------
# Scene reset
# ---------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, FRAMES


def material(name, base=(0.02, 0.02, 0.02), rough=0.4, spec=0.5, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = spec
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.12
    return m


def box(name, size, loc, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width, mod.segments = bevel, 3
        mod.limit_method = "ANGLE"
    ob.data.materials.append(mat)
    for poly in ob.data.polygons:
        poly.use_smooth = True
    return ob


# ---------------------------------------------------------------------------
# Monitor
# ---------------------------------------------------------------------------
plastic = material("plastic", (0.018, 0.018, 0.02), rough=0.36, spec=0.5, coat=0.25)
housing_w = SW + 2 * BEZEL_SIDE
housing_h = SH + BEZEL_TOP + BEZEL_BOTTOM
housing_z = ZC + (BEZEL_TOP - BEZEL_BOTTOM) / 2
# main housing behind the panel, then four lip strips framing it
box("housing", (housing_w, 0.05, housing_h), (0, 0.025 + 0.001, housing_z), plastic, bevel=0.004)
box("back", (housing_w * 0.72, 0.05, housing_h * 0.7), (0, 0.07, housing_z - 0.01), plastic, bevel=0.01)
lip_d = LIP + 0.001
box("lip_top", (housing_w, lip_d, BEZEL_TOP), (0, -lip_d / 2, ZC + SH / 2 + BEZEL_TOP / 2), plastic, 0.0015)
box("lip_bottom", (housing_w, lip_d, BEZEL_BOTTOM), (0, -lip_d / 2, ZC - SH / 2 - BEZEL_BOTTOM / 2), plastic, 0.0015)
box("lip_left", (BEZEL_SIDE, lip_d, housing_h), (-SW / 2 - BEZEL_SIDE / 2, -lip_d / 2, housing_z), plastic, 0.0015)
box("lip_right", (BEZEL_SIDE, lip_d, housing_h), (SW / 2 + BEZEL_SIDE / 2, -lip_d / 2, housing_z), plastic, 0.0015)
# power LED on the chin
led = material("led", (0.0, 0.0, 0.0))
led.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (0.2, 0.55, 1.0, 1)
led.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 1.2
box("led", (0.0018, 0.0015, 0.0018), (SW / 2 - 0.01, -lip_d - 0.0005, ZC - SH / 2 - BEZEL_BOTTOM / 2), led)
# stand
stand_top = ZC - SH / 2 - BEZEL_BOTTOM
box("neck", (0.07, 0.03, stand_top - 0.01), (0, 0.06, (stand_top - 0.01) / 2 + 0.01), plastic, 0.006)
box("base", (0.24, 0.19, 0.012), (0, 0.05, 0.006), plastic, 0.005)

# The panel: the stage-1 frames as an emissive texture under a faint matte coat.
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, ZC), rotation=(math.pi / 2, 0, 0))
panel = bpy.context.active_object
panel.name = "panel"
panel.scale = (SW, SH, 1)
bpy.ops.object.transform_apply(scale=True)
screen_mat = bpy.data.materials.new("screen")
screen_mat.use_nodes = True
nt = screen_mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.004, 0.004, 0.005, 1)
bsdf.inputs["Roughness"].default_value = 0.22
bsdf.inputs["Specular IOR Level"].default_value = 0.35
screen_dir = os.path.join(BUILD, "ending", "screen", args.orient) if args.login_ending else os.path.join(BUILD, "screen")
if args.showcase and not args.login_ending:
    screen_dir = os.path.join(BUILD, "showcase", "screen", args.orient)
img = bpy.data.images.load(os.path.join(screen_dir, "0001.jpg"))
img.source = "SEQUENCE"
img.colorspace_settings.name = "sRGB"
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = img
tex.interpolation = "Linear"
tex.image_user.frame_duration = FRAMES
tex.image_user.frame_start = 1
tex.image_user.frame_offset = 0
tex.image_user.use_auto_refresh = True
nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
bsdf.inputs["Emission Strength"].default_value = args.emission
panel.data.materials.append(screen_mat)
# the plane's UVs run 0..1 across its local X/Y, which after the rotation is
# screen left->right and bottom->top, matching the image's orientation.

# ---------------------------------------------------------------------------
# Room: desk, wall, keyboard, a lamp glow off to the side
# ---------------------------------------------------------------------------
wood = material("desk", (0.035, 0.022, 0.014), rough=0.42, spec=0.45, coat=0.15)
wn = wood.node_tree
wave = wn.nodes.new("ShaderNodeTexWave")
wave.inputs["Scale"].default_value = 3.0
wave.inputs["Distortion"].default_value = 6.0
wave.inputs["Detail"].default_value = 3.0
ramp = wn.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = (0.020, 0.012, 0.008, 1)
ramp.color_ramp.elements[1].color = (0.060, 0.036, 0.022, 1)
wn.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
wn.links.new(ramp.outputs["Color"], wn.nodes["Principled BSDF"].inputs["Base Color"])
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.3, 0))
desk = bpy.context.active_object
desk.scale = (2.4, 1.6, 1)
desk.data.materials.append(wood)

wall_mat = material("wall", (0.045, 0.045, 0.05), rough=0.9, spec=0.2)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.5, 0.8), rotation=(math.pi / 2, 0, 0))
wall = bpy.context.active_object
wall.scale = (3.0, 1.8, 1)
wall.data.materials.append(wall_mat)

keys_mat = material("keys", (0.03, 0.03, 0.032), rough=0.55, spec=0.4)
kn = keys_mat.node_tree
brick = kn.nodes.new("ShaderNodeTexBrick")
brick.inputs["Color1"].default_value = (0.035, 0.035, 0.038, 1)
brick.inputs["Color2"].default_value = (0.03, 0.03, 0.033, 1)
brick.inputs["Mortar"].default_value = (0.004, 0.004, 0.005, 1)
brick.inputs["Scale"].default_value = 26.0
brick.inputs["Mortar Size"].default_value = 0.08
brick.offset = 0.25
kn.links.new(brick.outputs["Color"], kn.nodes["Principled BSDF"].inputs["Base Color"])
box("keyboard", (0.44, 0.15, 0.022), (-0.02, -0.29, 0.011), keys_mat, 0.004)

# ---------------------------------------------------------------------------
# Lighting: screen spill that follows the picture, plus a dim lamp
# ---------------------------------------------------------------------------
bpy.ops.object.light_add(type="AREA", location=(0, -0.006, ZC), rotation=(-math.pi / 2, 0, 0))
spill = bpy.context.active_object
spill.data.shape = "RECTANGLE"
spill.data.size, spill.data.size_y = SW, SH
spill.data.energy = 9.0
for f, (r, g, b) in enumerate(timeline["spill"], start=1):
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (r, g, b)]
    spill.data.color = [min(1.0, c * 1.6 + 0.05) for c in lin]
    spill.data.keyframe_insert("color", frame=f)

bpy.ops.object.light_add(type="POINT", location=(-1.1, -0.6, 0.95))
lamp = bpy.context.active_object
lamp.data.energy = 32.0
lamp.data.color = (1.0, 0.72, 0.45)
lamp.data.shadow_soft_size = 0.35

world = bpy.data.worlds.new("room")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.0035, 0.0035, 0.004, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0

# ---------------------------------------------------------------------------
# Camera: a phone held by someone watching the screen
# ---------------------------------------------------------------------------
portrait = args.orient == "portrait"
scene.render.resolution_x, scene.render.resolution_y = (1080, 1920) if portrait else (1920, 1080)
scene.render.resolution_percentage = args.scale

cam_data = bpy.data.cameras.new("phone")
cam_data.lens = 28  # a phone's main camera, held close to the glass
cam_data.sensor_width = 36
cam_data.sensor_fit = "AUTO"
cam_data.clip_start = 0.01
cam_data.dof.use_dof = False  # a phone keeps the whole screen sharp
# rig aims at the target; the camera rides it and adds hand roll
rig = bpy.data.objects.new("rig", None)
scene.collection.objects.link(rig)
cam = bpy.data.objects.new("phone", cam_data)
scene.collection.objects.link(cam)
cam.parent = rig
scene.camera = cam
target = bpy.data.objects.new("look", None)
scene.collection.objects.link(target)
track = rig.constraints.new("TRACK_TO")
track.target = target
track.track_axis, track.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"

# Keep a comfortable view of the desktop. Follow the active window gently,
# with only a small distance adjustment between wide and tall recordings.
# The previous full fit-to-window move pumped the zoom on every cut.
LW, LH = timeline["screen"]
M_PER_PX = SW / LW
regions = np.array(timeline["regions"], dtype=np.float64)  # x, y, w, h per frame, logical px
t = np.arange(FRAMES) / FPS
logoff_t = timeline["logoff"][0]
if portrait:
    aspect = 9 / 16
    fill_w, fill_h = 0.80, 0.82
    vis_h_min, vis_h_max = 620.0, 880.0
    regions[t >= logoff_t] = (760, 330, 340, 190)
else:
    aspect = 16 / 9
    fill_w, fill_h = 0.62, 0.76
    vis_h_min, vis_h_max = 450.0, 810.0


def framing(reg):
    fitted_h = np.clip(np.maximum(reg[:, 2] / fill_w / aspect, reg[:, 3] / fill_h), vis_h_min, vis_h_max)
    # Retain just 20% of the old zoom variation, then move the camera back 12%.
    vis_h = (0.8 * vis_h_max + 0.2 * fitted_h) * 1.12
    vis_w = vis_h * aspect
    # When the view extends past the screen, centre that axis rather than
    # clipping against reversed bounds and shoving the monitor off-centre.
    cx = np.clip(reg[:, 0] + reg[:, 2] / 2, np.minimum(vis_w / 2 - 6, LW / 2), np.maximum(LW - vis_w / 2 + 6, LW / 2))
    cy = np.clip(reg[:, 1] + reg[:, 3] / 2, np.minimum(vis_h / 2 - 6, LH / 2), np.maximum(LH - vis_h / 2 + 6, LH / 2))
    return cx, cy, vis_h


def spring(x: np.ndarray, omega: float, delay: int = 3) -> np.ndarray:
    """Critically damped follow of x, starting `delay` frames late."""
    goal = np.concatenate([np.full(delay, x[0]), x[:-delay]])
    y, v, dt = np.empty_like(x), 0.0, 1 / FPS
    y[0] = x[0]
    for i in range(1, len(x)):
        v += (omega * omega * (goal[i] - y[i - 1]) - 2 * omega * v) * dt
        y[i] = y[i - 1] + v * dt
    return y


cx, cy, vis_h = framing(regions)
cx, cy, vis_h = spring(cx, 7.0), spring(cy, 7.0), spring(vis_h, 5.0)
vis_w = vis_h * aspect
cx = np.clip(cx, np.minimum(vis_w / 2 - 6, LW / 2), np.maximum(LW - vis_w / 2 + 6, LW / 2))
cy = np.clip(cy, np.minimum(vis_h / 2 - 6, LH / 2), np.maximum(LH - vis_h / 2 + 6, LH / 2))
if args.showcase:
    # Windows fill the viewport themselves. Keep the camera steady instead
    # of magnifying and chasing each app; only move for the final login.
    blend = np.clip((t - 25.05) / 1.05, 0, 1)
    blend = blend * blend * (3 - 2 * blend)
    login_x = 925 if portrait else LW / 2
    cx = LW / 2 + (login_x - LW / 2) * blend
    cy = np.full(FRAMES, LH / 2)
    vis_h = np.full(FRAMES, 890 if portrait else 860, dtype=float)
    vis_w = vis_h * aspect
# distance that shows vis_h (portrait: the sensor spans the height) or vis_w
dist = (vis_h if portrait else vis_w) * M_PER_PX / 2 * cam_data.lens / (cam_data.sensor_width / 2)

def enter_screen(time):
    u = np.clip((time - 26.72) / (28.10 - 26.72), 0, 1) if args.login_ending else 0
    return u * u * u * (u * (u * 6 - 15) + 10)


# The handheld camera settles square to the glass as Welcome appears. Its
# final crop is filled by the same orientation-specific Bliss as the website.
final_h = 870 if portrait else 790
final_dist = (final_h if portrait else final_h * aspect) * M_PER_PX * cam_data.lens / cam_data.sensor_width

for i in range(FRAMES):
    enter = enter_screen(t[i])
    tx = (cx[i] - LW / 2) * M_PER_PX * (1 - enter)
    tz = ZC - (cy[i] - LH / 2) * M_PER_PX * (1 - enter)
    target.location = (tx, 0.0, tz)
    target.keyframe_insert("location", frame=i + 1)
    # never quite square to the glass: a little off to the side and below
    off_x = dist[i] * (0.10 * math.sin(0.41 * t[i] + 1.1) + 0.04 * math.sin(0.93 * t[i]))
    off_z = dist[i] * (-0.07 + 0.05 * math.sin(0.33 * t[i] + 2.0))
    if args.showcase:
        off_x *= .15
        off_z *= .15
    rig.location = (tx + off_x * (1 - enter), -(dist[i] * (1 - enter) + final_dist * enter), tz + off_z * (1 - enter))
    rig.keyframe_insert("location", frame=i + 1)
    cam.rotation_euler = (0.0, 0.0, math.radians((.15 if args.showcase else 1.1) * math.sin(0.37 * t[i] + 0.7)) * (1 - enter))
    cam.keyframe_insert("rotation_euler", index=2, frame=i + 1)


def shake(ob, path, strength, scale, phase):
    fc = ob.animation_data.action.fcurves
    for c in fc:
        if c.data_path != path:
            continue
        n = c.modifiers.new("NOISE")
        n.strength, n.scale, n.phase = strength, scale, phase + c.array_index * 17.3
        n.blend_in = n.blend_out = 0
        if args.login_ending:
            n.use_restricted_range = True
            n.frame_start, n.frame_end = 1, 28.1 * FPS + 1
            n.blend_out = (28.1 - 26.72) * FPS


shake(rig, "location", 0.00011 if args.showcase else 0.0011, 38, 3.0)
shake(target, "location", 0.00008 if args.showcase else 0.0008, 30, 21.0)
shake(cam, "rotation_euler", 0.0002 if args.showcase else 0.002, 22, 5.0)

# ---------------------------------------------------------------------------
# Render settings and the phone-camera look
# ---------------------------------------------------------------------------
scene.render.engine = "BLENDER_EEVEE_NEXT"
ev = scene.eevee
ev.taa_render_samples = args.samples
for attr, val in (("use_raytracing", True), ("use_shadows", True), ("use_gtao", True)):
    if hasattr(ev, attr):
        setattr(ev, attr, val)
scene.render.use_motion_blur = False
scene.render.film_transparent = False
vs = scene.view_settings
vs.view_transform = args.view
vs.look = "AgX - Punchy" if args.view == "AgX" else "None"
vs.exposure = 0.0
# Preserve the screen's colours and fine text. The viewing angle already
# supplies the filmed-monitor look; lens dispersion blurred every recording.
scene.use_nodes = args.bloom > 0
if scene.use_nodes:
    tree = scene.node_tree
    tree.nodes.clear()
    rl = tree.nodes.new("CompositorNodeRLayers")
    glare = tree.nodes.new("CompositorNodeGlare")
    glare.glare_type, glare.quality = "BLOOM", "HIGH"
    glare.inputs["Threshold"].default_value = 0.95
    glare.inputs["Smoothness"].default_value = 0.3
    glare.inputs["Strength"].default_value = args.bloom
    glare.inputs["Size"].default_value = 0.45
    comp = tree.nodes.new("CompositorNodeComposite")
    tree.links.new(rl.outputs["Image"], glare.inputs["Image"])
    tree.links.new(glare.outputs["Image"], comp.inputs["Image"])

scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.color_depth = "8"

if args.still:
    scene.frame_set(args.still)
    scene.render.filepath = args.out
    bpy.ops.render.render(write_still=True)
elif args.stills:
    os.makedirs(args.out, exist_ok=True)
    for frame in (int(v) for v in args.stills.split(",")):
        scene.frame_set(frame)
        scene.render.filepath = os.path.join(args.out, f"{frame:04d}.png")
        bpy.ops.render.render(write_still=True)
else:
    os.makedirs(args.out, exist_ok=True)
    scene.frame_start = args.start
    scene.frame_end = args.end or FRAMES
    scene.render.filepath = os.path.join(args.out, "")
    scene.render.use_overwrite = False  # resumable: skip frames already on disk
    scene.render.use_placeholder = True
    bpy.ops.render.render(animation=True)
print("DONE", args.orient, flush=True)
