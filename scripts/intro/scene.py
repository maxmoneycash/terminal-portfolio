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
ap.add_argument("--start", type=int, default=1)
ap.add_argument("--end", type=int)
ap.add_argument("--samples", type=int, default=32)
ap.add_argument("--scale", type=int, default=100, help="resolution percentage")
ap.add_argument("--view", default="Standard", help="view transform: Standard or AgX")
ap.add_argument("--emission", type=float, default=1.15, help="screen brightness")
ap.add_argument("--bloom", type=float, default=0.25, help="bloom strength")
args = ap.parse_args(argv)

timeline = json.load(open(os.path.join(BUILD, "timeline.json")))
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
img = bpy.data.images.load(os.path.join(BUILD, "screen", "0001.jpg"))
img.source = "SEQUENCE"
img.colorspace_settings.name = "sRGB"
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = img
tex.interpolation = "Cubic"
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
cam_data.lens = 34 if args.orient == "portrait" else 28
cam_data.sensor_width = 36
cam_data.sensor_fit = "AUTO"
cam_data.clip_start = 0.01
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
cam_data.dof.use_dof = True
cam_data.dof.focus_object = target
cam_data.dof.aperture_fstop = 5.6

focus = np.array(timeline["focus"], dtype=np.float64)  # (u, v) in screen space, v down


def zero_phase(x: np.ndarray, alpha: float) -> np.ndarray:
    """Exponential smoothing run forwards then backwards (no lag)."""
    y = x.copy()
    for i in range(1, len(y)):
        y[i] = y[i - 1] + alpha * (y[i] - y[i - 1])
    for i in range(len(y) - 2, -1, -1):
        y[i] = y[i + 1] + alpha * (y[i] - y[i + 1])
    return y


fu = zero_phase(focus[:, 0], 0.06)
fv = zero_phase(focus[:, 1], 0.05)
t = np.arange(FRAMES) / FPS
logoff_t = timeline["logoff"][0]
end_push = np.clip((t - logoff_t) / (t[-1] - logoff_t), 0, 1)
end_push = end_push * end_push * (3 - 2 * end_push)

if portrait:
    follow_x, follow_z = 0.72, 0.18
    dist = 0.36 + 0.02 * np.sin(0.23 * t + 0.4) - 0.01 * end_push
    aim_z_bias = -0.018 * (1 - end_push)
    end_u = 0.57  # a vertical frame can't hold the whole login screen: end on the user tile
else:
    follow_x, follow_z = 0.22, 0.08
    dist = 0.47 + 0.025 * np.sin(0.19 * t) - 0.09 * end_push
    aim_z_bias = -0.02 * (1 - end_push)
    end_u = 0.5

for i in range(FRAMES):
    u = fu[i] * (1 - end_push[i]) + end_u * end_push[i]
    v = fv[i] * (1 - end_push[i]) + 0.5 * end_push[i]
    tx = (u - 0.5) * SW * follow_x
    tz = ZC - (v - 0.5) * SH * follow_z + aim_z_bias[i]
    target.location = (tx, 0.0, tz)
    target.keyframe_insert("location", frame=i + 1)
    sway_x = 0.035 * math.sin(0.41 * t[i] + 1.1) * (1 - 0.6 * end_push[i])
    sway_z = 0.018 * math.sin(0.33 * t[i] + 2.0)
    rig.location = (tx * 0.85 + sway_x, -dist[i], tz + 0.012 + sway_z)
    rig.keyframe_insert("location", frame=i + 1)
    cam.rotation_euler = (0.0, 0.0, math.radians(0.9 * math.sin(0.37 * t[i] + 0.7)))
    cam.keyframe_insert("rotation_euler", index=2, frame=i + 1)


def shake(ob, path, strength, scale, phase):
    fc = ob.animation_data.action.fcurves
    for c in fc:
        if c.data_path != path:
            continue
        n = c.modifiers.new("NOISE")
        n.strength, n.scale, n.phase = strength, scale, phase + c.array_index * 17.3
        n.blend_in = n.blend_out = 0


shake(rig, "location", 0.0035, 38, 3.0)   # slow drift of hands
shake(rig, "location", 0.0009, 4.5, 9.0)  # micro tremor
shake(target, "location", 0.003, 30, 21.0)
shake(cam, "rotation_euler", 0.004, 22, 5.0)  # roll wobble (radians)

# ---------------------------------------------------------------------------
# Render settings and the phone-camera look
# ---------------------------------------------------------------------------
scene.render.engine = "BLENDER_EEVEE_NEXT"
ev = scene.eevee
ev.taa_render_samples = args.samples
for attr, val in (("use_raytracing", True), ("use_shadows", True), ("use_gtao", True)):
    if hasattr(ev, attr):
        setattr(ev, attr, val)
scene.render.use_motion_blur = True
scene.render.motion_blur_shutter = 0.5
scene.render.film_transparent = False
vs = scene.view_settings
vs.view_transform = args.view
vs.look = "AgX - Punchy" if args.view == "AgX" else "Medium High Contrast"
vs.exposure = 0.0
# phone auto-exposure: the picture brightens a little as the screen darkens
lum = np.array([0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in timeline["spill"]])
lum = zero_phase(lum, 0.08)
for f in range(FRAMES):
    vs.exposure = float(np.clip(-0.9 * (lum[f] - lum.mean()), -0.35, 0.35))
    vs.keyframe_insert("exposure", frame=f + 1)

scene.use_nodes = True
tree = scene.node_tree
for n in list(tree.nodes):
    tree.nodes.remove(n)
rl = tree.nodes.new("CompositorNodeRLayers")
glare = tree.nodes.new("CompositorNodeGlare")
glare.glare_type, glare.quality = "BLOOM", "HIGH"
glare.inputs["Threshold"].default_value = 0.95
glare.inputs["Smoothness"].default_value = 0.3
glare.inputs["Strength"].default_value = args.bloom
glare.inputs["Size"].default_value = 0.45
lens = tree.nodes.new("CompositorNodeLensdist")
lens.inputs["Fit"].default_value = True
lens.inputs["Distortion"].default_value = -0.007
lens.inputs["Dispersion"].default_value = 0.012
comp = tree.nodes.new("CompositorNodeComposite")
tree.links.new(rl.outputs["Image"], glare.inputs["Image"])
tree.links.new(glare.outputs["Image"], lens.inputs["Image"])
tree.links.new(lens.outputs["Image"], comp.inputs["Image"])

scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.color_depth = "8"

if args.still:
    scene.frame_set(args.still)
    scene.render.filepath = args.out
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
