import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createSolvedCube, type CubeAxis, type CubeSticker, type RubiksCubeState } from "../lib/rubiks";

type CubeMode = "ready" | "scrambling" | "scrambled" | "solving" | "solved";

type RubiksThreeOverlayProps = {
  visible: boolean;
  state: RubiksCubeState;
  mode: CubeMode;
  activeMove: string | null;
  moveTick: number;
  hasScramble: boolean;
};

type MoveSpec = {
  axis: CubeAxis;
  layer: -1 | 1;
  turn: -1 | 1;
};

type CubieNode = {
  homeCoord: THREE.Vector3;
  coord: THREE.Vector3;
  group: THREE.Group;
};

type SolvedStickerRef = {
  id: string;
  normal: THREE.Vector3;
};

type CubeMaterials = {
  body: THREE.MeshStandardMaterial;
  stickers: Record<string, THREE.MeshStandardMaterial>;
};

const moveSpecs: Record<string, MoveSpec> = {
  U: { axis: "y", layer: 1, turn: 1 },
  D: { axis: "y", layer: -1, turn: -1 },
  R: { axis: "x", layer: 1, turn: 1 },
  L: { axis: "x", layer: -1, turn: -1 },
  F: { axis: "z", layer: 1, turn: 1 },
  B: { axis: "z", layer: -1, turn: -1 },
};

const faceColors: Record<string, number> = {
  U: 0xff3040,
  D: 0xffdc18,
  R: 0x44d04f,
  L: 0x009fe3,
  F: 0xf7f5ee,
  B: 0xff8015,
};

const stickerNames: Record<string, string> = {
  U: "red",
  D: "yellow",
  R: "green",
  L: "blue",
  F: "white",
  B: "orange",
};

const spacing = 1.0;
const shellOuterSize = 0.986;
const coreSize = 0.72;
const faceSize = 0.948;
const faceDepth = 0.18;
const faceBevelThickness = 0.036;
const turnAnimationMs = 96;

function coordKey(coord: THREE.Vector3 | CubeSticker["position"]) {
  return `${coord.x},${coord.y},${coord.z}`;
}

const solvedStickerRefsByCubie = createSolvedCube().reduce((groups, sticker) => {
  const key = coordKey(sticker.position);
  const refs = groups.get(key) ?? [];
  refs.push({
    id: sticker.id,
    normal: new THREE.Vector3(sticker.normal.x, sticker.normal.y, sticker.normal.z),
  });
  groups.set(key, refs);
  return groups;
}, new Map<string, SolvedStickerRef[]>());

function axisValue(vector: THREE.Vector3, axis: CubeAxis) {
  return axis === "x" ? vector.x : axis === "y" ? vector.y : vector.z;
}

function moveInfo(move: string) {
  const face = move[0] ?? "U";
  const suffix = move.slice(1);
  const spec = moveSpecs[face] ?? moveSpecs.U;
  const suffixTurn = suffix === "'" ? -1 : suffix === "2" ? 2 : 1;
  return {
    spec,
    targetAngle: spec.turn * suffixTurn * (Math.PI / 2),
  };
}

function setAxisRotation(group: THREE.Group, axis: CubeAxis, value: number) {
  group.rotation.set(0, 0, 0);
  if (axis === "x") group.rotation.x = value;
  if (axis === "y") group.rotation.y = value;
  if (axis === "z") group.rotation.z = value;
}

function easeInOutSine(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function snapCoord(value: number) {
  if (value > 0.5) return 1;
  if (value < -0.5) return -1;
  return 0;
}

function rotateCoord(coord: THREE.Vector3, axis: CubeAxis, angle: number) {
  const axisVector =
    axis === "x" ? new THREE.Vector3(1, 0, 0) : axis === "y" ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const next = coord.clone().applyAxisAngle(axisVector, angle);
  return new THREE.Vector3(snapCoord(next.x), snapCoord(next.y), snapCoord(next.z));
}

function vectorFromStickerVector(vector: CubeSticker["normal"] | CubeSticker["position"]) {
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}

function orientationFromStickerRefs(refs: SolvedStickerRef[], stickers: CubeSticker[]) {
  if (refs.length === 0 || stickers.length === 0) return new THREE.Quaternion();

  const sourceA = refs[0].normal.clone().normalize();
  const targetA = vectorFromStickerVector(stickers[0].normal).normalize();
  if (refs.length === 1 || stickers.length === 1) {
    return new THREE.Quaternion().setFromUnitVectors(sourceA, targetA);
  }

  const makeBasis = (a: THREE.Vector3, b: THREE.Vector3) => {
    const x = a.clone().normalize();
    const y = b.clone().sub(x.clone().multiplyScalar(b.dot(x))).normalize();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    return new THREE.Matrix4().makeBasis(x, y, z);
  };

  const sourceB = refs[1].normal.clone().normalize();
  const targetB = vectorFromStickerVector(stickers[1].normal).normalize();
  const sourceBasis = makeBasis(sourceA, sourceB);
  const targetBasis = makeBasis(targetA, targetB);
  const rotation = targetBasis.multiply(sourceBasis.invert());
  return new THREE.Quaternion().setFromRotationMatrix(rotation);
}

function resetCubieNode(cubie: CubieNode) {
  cubie.coord.copy(cubie.homeCoord);
  cubie.group.position.set(cubie.coord.x * spacing, cubie.coord.y * spacing, cubie.coord.z * spacing);
  cubie.group.quaternion.identity();
  cubie.group.scale.setScalar(1);
}

function snapCubiePosition(cubie: CubieNode) {
  cubie.group.position.set(cubie.coord.x * spacing, cubie.coord.y * spacing, cubie.coord.z * spacing);
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeTexture(seed: number, variant: "body-color" | "body-roughness" | "sticker-color" | "sticker-roughness") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const random = seededRandom(seed);
  const isSticker = variant.startsWith("sticker");
  const isRoughness = variant.endsWith("roughness");
  const base = isRoughness ? (isSticker ? 192 : 224) : isSticker ? 246 : 48;
  context.fillStyle = `rgb(${base}, ${base}, ${base})`;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < (isSticker ? 1500 : 2200); index += 1) {
    const spread = isRoughness ? (isSticker ? 28 : 52) : isSticker ? 10 : 26;
    const value = Math.floor(base - spread / 2 + random() * spread);
    context.fillStyle = `rgb(${value}, ${value}, ${value})`;
    context.globalAlpha = isSticker ? 0.008 + random() * 0.018 : 0.07 + random() * 0.11;
    context.fillRect(random() * canvas.width, random() * canvas.height, 0.5 + random() * 1.25, 0.5 + random() * 1.25);
  }

  context.lineWidth = isSticker ? 0.42 : 0.5;
  for (let index = 0; index < (isSticker ? 52 : 54); index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const length = isSticker ? 10 + random() * 70 : 6 + random() * 34;
    const angle = (random() - 0.5) * (isSticker ? 0.24 : 1.2);
    const value = Math.floor(base + (random() > 0.52 ? 16 : -20));
    context.globalAlpha = isRoughness ? 0.07 + random() * 0.12 : 0.012 + random() * 0.028;
    context.strokeStyle = `rgb(${value}, ${value}, ${value})`;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    context.stroke();
  }

  if (isSticker && !isRoughness) {
    const gradient = context.createRadialGradient(78, 56, 10, 132, 132, 178);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.24)");
    gradient.addColorStop(0.55, "rgba(255, 255, 255, 0.03)");
    gradient.addColorStop(1, "rgba(95, 88, 78, 0.08)");
    context.globalAlpha = 1;
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (variant === "body-color") {
    const gradient = context.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, "rgba(86, 104, 112, 0.2)");
    gradient.addColorStop(0.45, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(120, 90, 48, 0.12)");
    context.globalAlpha = 1;
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = isRoughness ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(isSticker ? 1.08 : 1.85, isSticker ? 1.08 : 1.85);
  texture.anisotropy = 4;
  return texture;
}

function makeCubeMaterials(textures: {
  bodyMap: THREE.Texture | null;
  bodyRoughness: THREE.Texture | null;
  stickerMap: THREE.Texture | null;
  stickerRoughness: THREE.Texture | null;
}): CubeMaterials {
  const body = new THREE.MeshStandardMaterial({
    color: 0x15130f,
    roughness: 0.74,
    metalness: 0,
    map: textures.bodyMap ?? undefined,
    roughnessMap: textures.bodyRoughness ?? undefined,
    bumpMap: textures.bodyRoughness ?? undefined,
    bumpScale: 0.008,
  });

  const stickers = Object.fromEntries(
    Object.entries(faceColors).map(([face, color]) => [
      stickerNames[face],
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.46,
        metalness: 0,
        map: textures.stickerMap ?? undefined,
        roughnessMap: textures.stickerRoughness ?? undefined,
        bumpMap: textures.stickerRoughness ?? undefined,
        bumpScale: 0.006,
      }),
    ]),
  ) as Record<string, THREE.MeshStandardMaterial>;

  return { body, stickers };
}

function orientPlaneToNormal(plane: THREE.Object3D, normal: THREE.Vector3) {
  if (normal.x > 0) plane.rotation.y = Math.PI / 2;
  if (normal.x < 0) plane.rotation.y = -Math.PI / 2;
  if (normal.y > 0) plane.rotation.x = -Math.PI / 2;
  if (normal.y < 0) plane.rotation.x = Math.PI / 2;
  if (normal.z < 0) plane.rotation.y = Math.PI;
}

function stickerFacesForCoord(coord: THREE.Vector3) {
  const faces: Array<{ face: string; normal: THREE.Vector3 }> = [];
  if (coord.y === 1) faces.push({ face: "U", normal: new THREE.Vector3(0, 1, 0) });
  if (coord.y === -1) faces.push({ face: "D", normal: new THREE.Vector3(0, -1, 0) });
  if (coord.x === 1) faces.push({ face: "R", normal: new THREE.Vector3(1, 0, 0) });
  if (coord.x === -1) faces.push({ face: "L", normal: new THREE.Vector3(-1, 0, 0) });
  if (coord.z === 1) faces.push({ face: "F", normal: new THREE.Vector3(0, 0, 1) });
  if (coord.z === -1) faces.push({ face: "B", normal: new THREE.Vector3(0, 0, -1) });
  return faces;
}

function makeLogoTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(252, 126);
  context.rotate(-0.18);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";

  const letters = [
    { text: "M", color: "#55c94f" },
    { text: "A", color: "#f8f7f1" },
    { text: "X", color: "#12a7e2" },
  ];
  let x = -104;
  for (const letter of letters) {
    context.font = '900 82px "Arial Black", Impact, sans-serif';
    context.lineWidth = 12;
    context.strokeStyle = "#1f2428";
    context.strokeText(letter.text, x, -24);
    context.fillStyle = letter.color;
    context.fillText(letter.text, x, -24);
    x += 72;
  }

  context.font = '900 45px "Arial Black", Impact, sans-serif';
  context.lineWidth = 9;
  context.strokeStyle = "#1f2428";
  context.strokeText("SPEED", 14, 42);
  context.fillStyle = "#f7f4ee";
  context.fillText("SPEED", 14, 42);
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeRoundedFaceGeometry(size: number, radius: number, depth: number) {
  const half = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half + radius, -half);
  shape.lineTo(half - radius, -half);
  shape.quadraticCurveTo(half, -half, half, -half + radius);
  shape.lineTo(half, half - radius);
  shape.quadraticCurveTo(half, half, half - radius, half);
  shape.lineTo(-half + radius, half);
  shape.quadraticCurveTo(-half, half, -half, half - radius);
  shape.lineTo(-half, -half + radius);
  shape.quadraticCurveTo(-half, -half, -half + radius, -half);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 7,
    bevelSize: 0.035,
    bevelThickness: faceBevelThickness,
    curveSegments: 14,
  });
  geometry.center();
  return geometry;
}

export function RubiksThreeOverlay({
  visible,
  state,
  mode,
  activeMove,
  moveTick,
  hasScramble,
}: RubiksThreeOverlayProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragZoneRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const stateSerialRef = useRef(0);
  const activeMoveRef = useRef(activeMove);
  const moveStartRef = useRef(0);
  const moveTickRef = useRef(moveTick);

  useEffect(() => {
    stateRef.current = state;
    stateSerialRef.current += 1;
  }, [state]);

  useEffect(() => {
    activeMoveRef.current = activeMove;
    moveTickRef.current = moveTick;
    moveStartRef.current = performance.now();
  }, [activeMove, moveTick]);

  useEffect(() => {
    if (!visible) return;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const dragZone = dragZoneRef.current;
    if (!host || !canvas || !dragZone) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.38));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(4.65, 3.85, 7.25);
    camera.lookAt(0.1, -0.05, 0);

    const orbit = new THREE.Group();
    const cubeRoot = new THREE.Group();
    const pivot = new THREE.Group();
    scene.add(orbit);
    orbit.add(cubeRoot);
    cubeRoot.add(pivot);

    scene.add(new THREE.HemisphereLight(0xf7f2e8, 0x0a1015, 1.9));
    const keyLight = new THREE.DirectionalLight(0xfff4dc, 3.05);
    keyLight.position.set(3.2, 6.1, 4.5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xa8cfff, 1.1);
    rimLight.position.set(-4.8, 2.2, -4.6);
    scene.add(rimLight);
    const fillLight = new THREE.PointLight(0x7dd3fc, 1.35, 8.5);
    fillLight.position.set(-2.8, -0.2, 3.2);
    scene.add(fillLight);

    const shadowGeometry = new THREE.CircleGeometry(2.2, 64);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0.18, -1.95, 0.18);
    shadow.scale.set(1.5, 0.34, 1);
    orbit.add(shadow);

    const textures = {
      bodyMap: makeTexture(3427, "body-color"),
      bodyRoughness: makeTexture(9127, "body-roughness"),
      stickerMap: makeTexture(5419, "sticker-color"),
      stickerRoughness: makeTexture(8351, "sticker-roughness"),
    };
    const materials = makeCubeMaterials(textures);
    const logoTexture = makeLogoTexture();
    const logoMaterial = new THREE.MeshBasicMaterial({
      map: logoTexture ?? undefined,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const bodyGeometry = new RoundedBoxGeometry(coreSize, coreSize, coreSize, 5, 0.09);
    const faceGeometry = makeRoundedFaceGeometry(faceSize, 0.124, faceDepth);
    const centerRingGeometry = new THREE.RingGeometry(0.218, 0.234, 64);
    const centerRingMaterial = new THREE.MeshBasicMaterial({
      color: 0x1a1712,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const logoGeometry = new THREE.PlaneGeometry(0.58, 0.28);
    const cubies: CubieNode[] = [];
    let disposed = false;
    let turnMove: string | null = null;
    let turnTick = -1;
    let turningCubies: CubieNode[] = [];
    let lastAppliedStateSerial = -1;

    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          const coord = new THREE.Vector3(x, y, z);
          const group = new THREE.Group();
          group.name = `cubie-${x}-${y}-${z}`;

          const body = new THREE.Mesh(bodyGeometry, materials.body);
          body.castShadow = true;
          body.receiveShadow = true;
          group.add(body);

          const faceOffset = shellOuterSize / 2 - faceDepth / 2 - faceBevelThickness;
          for (const { face, normal } of stickerFacesForCoord(coord)) {
            const facePanel = new THREE.Mesh(faceGeometry, materials.stickers[stickerNames[face]]);
            facePanel.position.set(normal.x * faceOffset, normal.y * faceOffset, normal.z * faceOffset);
            orientPlaneToNormal(facePanel, normal);
            facePanel.castShadow = true;
            facePanel.receiveShadow = true;
            group.add(facePanel);

            const isCenterFace = Math.abs(coord.x) + Math.abs(coord.y) + Math.abs(coord.z) === 1;
            if (isCenterFace) {
              const detailOffset = faceOffset + faceDepth / 2 + faceBevelThickness + 0.006;
              const ring = new THREE.Mesh(centerRingGeometry, centerRingMaterial);
              ring.position.set(normal.x * detailOffset, normal.y * detailOffset, normal.z * detailOffset);
              orientPlaneToNormal(ring, normal);
              ring.renderOrder = 2;
              group.add(ring);

              if (face !== "F") continue;
              const logo = new THREE.Mesh(logoGeometry, logoMaterial);
              const logoOffset = faceOffset + faceDepth / 2 + faceBevelThickness + 0.012;
              logo.position.set(normal.x * logoOffset, normal.y * logoOffset, normal.z * logoOffset);
              orientPlaneToNormal(logo, normal);
              logo.renderOrder = 3;
              group.add(logo);
            }
          }

          cubeRoot.add(group);
          const cubie = { homeCoord: coord, coord: coord.clone(), group };
          resetCubieNode(cubie);
          cubies.push(cubie);
        }
      }
    }

    const clearPivot = () => {
      pivot.updateMatrixWorld(true);
      for (const cubie of turningCubies) {
        cubeRoot.attach(cubie.group);
      }
      turningCubies = [];
      pivot.rotation.set(0, 0, 0);
      pivot.quaternion.identity();
      pivot.position.set(0, 0, 0);
    };

    const applySceneFromState = (nextState: RubiksCubeState) => {
      clearPivot();
      turnMove = null;
      turnTick = -1;
      const stickersById = new Map(nextState.map((sticker) => [sticker.id, sticker]));

      for (const cubie of cubies) {
        const refs = solvedStickerRefsByCubie.get(coordKey(cubie.homeCoord)) ?? [];
        const stickers = refs.map((ref) => stickersById.get(ref.id)).filter(Boolean) as CubeSticker[];

        if (refs.length === 0 || stickers.length === 0) {
          resetCubieNode(cubie);
          continue;
        }

        const currentPosition = vectorFromStickerVector(stickers[0].position);
        cubie.coord.copy(currentPosition);
        cubie.group.position.set(currentPosition.x * spacing, currentPosition.y * spacing, currentPosition.z * spacing);
        cubie.group.quaternion.copy(orientationFromStickerRefs(refs, stickers));
        cubie.group.scale.setScalar(1);
      }

      lastAppliedStateSerial = stateSerialRef.current;
    };

    const finishTurn = () => {
      if (!turnMove) return;
      const { spec, targetAngle } = moveInfo(turnMove);
      setAxisRotation(pivot, spec.axis, targetAngle);
      pivot.updateMatrixWorld(true);

      for (const cubie of turningCubies) {
        cubie.coord.copy(rotateCoord(cubie.coord, spec.axis, targetAngle));
        cubeRoot.attach(cubie.group);
        snapCubiePosition(cubie);
        cubie.group.scale.setScalar(1);
      }

      turningCubies = [];
      pivot.rotation.set(0, 0, 0);
      pivot.quaternion.identity();
      pivot.position.set(0, 0, 0);
      turnMove = null;
      turnTick = -1;
    };

    const beginTurn = (move: string) => {
      if (turnMove) finishTurn();
      if (lastAppliedStateSerial !== stateSerialRef.current) applySceneFromState(stateRef.current);
      if (cubies.length === 0) return;

      const { spec } = moveInfo(move);
      pivot.rotation.set(0, 0, 0);
      pivot.quaternion.identity();
      pivot.updateMatrixWorld(true);

      for (const cubie of cubies) {
        if (axisValue(cubie.coord, spec.axis) !== spec.layer) continue;
        pivot.attach(cubie.group);
        turningCubies.push(cubie);
      }

      turnMove = move;
      turnTick = moveTickRef.current;
      moveStartRef.current = performance.now();
    };

    applySceneFromState(stateRef.current);

    const rootBasePosition = new THREE.Vector3(1.48, -0.12, 0);
    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const compact = width < 620;
      rootBasePosition.set(compact ? 0.08 : 1.36, compact ? -0.52 : -0.13, 0);
      const scale = compact ? 0.67 : Math.min(0.98, Math.max(0.78, width / 1720));
      orbit.scale.setScalar(scale);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let frame: number | null = null;
    let intersecting = true;
    const drag = {
      active: false,
      x: 0,
      y: 0,
      yaw: 0,
      pitch: 0,
      velocityX: 0,
      velocityY: 0,
    };

    const handlePointerDown = (event: PointerEvent) => {
      drag.active = true;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.velocityX = 0;
      drag.velocityY = 0;
      dragZone.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!drag.active) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.velocityX = dx * 0.00135;
      drag.velocityY = dy * 0.0009;
      drag.yaw += dx * 0.0085;
      drag.pitch = Math.max(-0.68, Math.min(0.48, drag.pitch + dy * 0.006));
    };

    const handlePointerUp = (event: PointerEvent) => {
      drag.active = false;
      if (dragZone.hasPointerCapture(event.pointerId)) dragZone.releasePointerCapture(event.pointerId);
    };

    dragZone.addEventListener("pointerdown", handlePointerDown);
    dragZone.addEventListener("pointermove", handlePointerMove);
    dragZone.addEventListener("pointerup", handlePointerUp);
    dragZone.addEventListener("pointercancel", handlePointerUp);

    const render = (now: number) => {
      frame = null;
      const seconds = now * 0.001;
      const requestedMove = activeMoveRef.current;

      if (requestedMove && (requestedMove !== turnMove || moveTickRef.current !== turnTick)) {
        beginTurn(requestedMove);
      } else if (!requestedMove && turnMove) {
        finishTurn();
        if (lastAppliedStateSerial !== stateSerialRef.current) applySceneFromState(stateRef.current);
      } else if (!requestedMove && lastAppliedStateSerial !== stateSerialRef.current) {
        applySceneFromState(stateRef.current);
      }

      const move = turnMove;
      if (move) {
        const { spec, targetAngle } = moveInfo(move);
        const progress = easeInOutSine((now - moveStartRef.current) / turnAnimationMs);
        setAxisRotation(pivot, spec.axis, targetAngle * progress);
      }

      if (!drag.active) {
        drag.yaw += 0.001 + drag.velocityX;
        drag.pitch = Math.max(-0.68, Math.min(0.48, drag.pitch + drag.velocityY));
        drag.velocityX *= 0.94;
        drag.velocityY *= 0.9;
      }

      orbit.rotation.x = 0.16 + drag.pitch + Math.sin(seconds * 0.62) * 0.01;
      orbit.rotation.y = 0.68 + drag.yaw;
      orbit.rotation.z = -0.1 + Math.sin(seconds * 0.48) * 0.007;
      orbit.position.copy(rootBasePosition);
      shadow.material.opacity = 0.22 + Math.sin(seconds * 1.1) * 0.025;

      renderer.render(scene, camera);
      if (!document.hidden && intersecting && !disposed) frame = window.requestAnimationFrame(render);
    };

    const start = () => {
      if (frame === null && !document.hidden && intersecting) frame = window.requestAnimationFrame(render);
    };

    const stop = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    const intersectionObserver = new IntersectionObserver((entries) => {
      intersecting = entries[0]?.isIntersecting ?? true;
      if (intersecting) start();
      else stop();
    });
    intersectionObserver.observe(host);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    start();

    return () => {
      stop();
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      clearPivot();
      dragZone.removeEventListener("pointerdown", handlePointerDown);
      dragZone.removeEventListener("pointermove", handlePointerMove);
      dragZone.removeEventListener("pointerup", handlePointerUp);
      dragZone.removeEventListener("pointercancel", handlePointerUp);
      renderer.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      bodyGeometry.dispose();
      faceGeometry.dispose();
      centerRingGeometry.dispose();
      centerRingMaterial.dispose();
      logoGeometry.dispose();
      for (const texture of Object.values(textures)) texture?.dispose();
      logoTexture?.dispose();
      logoMaterial.dispose();
      materials.body.dispose();
      for (const material of Object.values(materials.stickers)) material.dispose();
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <aside className={`rubiks-three-orbit is-${mode}`} ref={hostRef} aria-hidden="true">
      <canvas className="rubiks-three-canvas" ref={canvasRef} />
      <div className="rubiks-three-drag-zone" ref={dragZoneRef} />
      <div className="rubiks-three-readout">
        <span>{mode}</span>
        <strong>{activeMove ?? (hasScramble ? "cube solve" : "cube scramble")}</strong>
      </div>
    </aside>
  );
}
