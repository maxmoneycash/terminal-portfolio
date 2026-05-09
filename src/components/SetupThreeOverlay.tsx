import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type SetupThreeOverlayProps = {
  visible: boolean;
};

type KeySpec = {
  label: string;
  width?: number;
};

type GlowNode = {
  material: THREE.MeshBasicMaterial;
  hue: number;
};

type DisposableMaterial = THREE.Material | THREE.Material[];

const macbookAssetPath = "/apple_macbook_pro_16_inch_2021.glb";
const maxKeys = new Set(["M", "A", "X"]);

const keyboardRows: KeySpec[][] = [
  [
    { label: "ESC", width: 1.15 },
    { label: "1" },
    { label: "2" },
    { label: "3" },
    { label: "4" },
    { label: "5" },
    { label: "6" },
    { label: "7" },
    { label: "8" },
    { label: "9" },
    { label: "0" },
    { label: "-" },
    { label: "=" },
    { label: "DEL", width: 1.55 },
  ],
  [
    { label: "TAB", width: 1.45 },
    { label: "Q" },
    { label: "W" },
    { label: "E" },
    { label: "R" },
    { label: "T" },
    { label: "Y" },
    { label: "U" },
    { label: "I" },
    { label: "O" },
    { label: "P" },
    { label: "[" },
    { label: "]" },
    { label: "\\", width: 1.25 },
  ],
  [
    { label: "CAPS", width: 1.75 },
    { label: "A" },
    { label: "S" },
    { label: "D" },
    { label: "F" },
    { label: "G" },
    { label: "H" },
    { label: "J" },
    { label: "K" },
    { label: "L" },
    { label: ";" },
    { label: "'" },
    { label: "ENTER", width: 1.85 },
  ],
  [
    { label: "SHIFT", width: 2.18 },
    { label: "Z" },
    { label: "X" },
    { label: "C" },
    { label: "V" },
    { label: "B" },
    { label: "N" },
    { label: "M" },
    { label: "," },
    { label: "." },
    { label: "/" },
    { label: "SHIFT", width: 2.32 },
  ],
  [
    { label: "CTRL", width: 1.25 },
    { label: "OPT", width: 1.25 },
    { label: "CMD", width: 1.25 },
    { label: "", width: 6.25 },
    { label: "CMD", width: 1.25 },
    { label: "FN", width: 1.1 },
    { label: "ALT", width: 1.25 },
    { label: "CTRL", width: 1.25 },
  ],
];

function disposeMaterial(material: DisposableMaterial | null | undefined) {
  if (!material) return;
  if (Array.isArray(material)) {
    for (const item of material) item.dispose();
  } else {
    material.dispose();
  }
}

function makeLegendTexture(label: string, redKey: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = redKey ? "#fff7ed" : "#111827";
  context.font = `${label.length > 3 ? 600 : 740} ${label.length > 3 ? 50 : 74}px "Fira Code Local", monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label || " ", canvas.width / 2, canvas.height / 2 + 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeKeyboard() {
  const group = new THREE.Group();
  const glowNodes: GlowNode[] = [];
  const disposableMaterials: THREE.Material[] = [];
  const disposableGeometries: THREE.BufferGeometry[] = [];
  const keyGap = 0.08;
  const keyUnit = 0.42;
  const keyDepth = 0.42;
  const keyHeight = 0.14;
  const rowGap = 0.12;
  const totalRows = keyboardRows.length;
  const widestRowUnits = Math.max(
    ...keyboardRows.map((row) => row.reduce((sum, key) => sum + (key.width ?? 1), 0) + (row.length - 1) * keyGap),
  );

  const caseGeometry = new RoundedBoxGeometry(widestRowUnits * keyUnit + 0.48, 0.16, 2.72, 8, 0.12);
  const caseMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.76,
    metalness: 0.02,
    clearcoat: 0.22,
    clearcoatRoughness: 0.72,
  });
  disposableGeometries.push(caseGeometry);
  disposableMaterials.push(caseMaterial);

  const keyboardCase = new THREE.Mesh(caseGeometry, caseMaterial);
  keyboardCase.position.set(0, 0, 0);
  keyboardCase.receiveShadow = true;
  group.add(keyboardCase);

  keyboardRows.forEach((row, rowIndex) => {
    const rowUnits = row.reduce((sum, key) => sum + (key.width ?? 1), 0) + (row.length - 1) * keyGap;
    let x = -rowUnits * keyUnit * 0.5;
    const z = (rowIndex - (totalRows - 1) / 2) * (keyDepth + rowGap);

    row.forEach((key, keyIndex) => {
      const width = key.width ?? 1;
      const keyWidth = width * keyUnit;
      const redKey = maxKeys.has(key.label);
      const hue = (keyIndex / Math.max(1, row.length - 1) + rowIndex * 0.13) % 1;
      const keyGroup = new THREE.Group();
      keyGroup.position.set(x + keyWidth / 2, 0.18, z);

      const capGeometry = new RoundedBoxGeometry(keyWidth - 0.045, keyHeight, keyDepth - 0.045, 6, 0.055);
      const capMaterial = new THREE.MeshPhysicalMaterial({
        color: redKey ? 0xdc2626 : 0xf8fafc,
        roughness: redKey ? 0.58 : 0.82,
        metalness: 0.01,
        clearcoat: redKey ? 0.48 : 0.18,
        clearcoatRoughness: redKey ? 0.44 : 0.78,
      });
      disposableGeometries.push(capGeometry);
      disposableMaterials.push(capMaterial);

      const cap = new THREE.Mesh(capGeometry, capMaterial);
      cap.castShadow = true;
      cap.receiveShadow = true;
      keyGroup.add(cap);

      const glowGeometry = new RoundedBoxGeometry(keyWidth - 0.025, 0.018, keyDepth - 0.025, 4, 0.05);
      const glowColor = new THREE.Color().setHSL(hue, 0.88, redKey ? 0.52 : 0.58);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: redKey ? 0xef4444 : glowColor,
        transparent: true,
        opacity: redKey ? 0.78 : 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      disposableGeometries.push(glowGeometry);
      disposableMaterials.push(glowMaterial);

      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.y = -0.095;
      keyGroup.add(glow);
      glowNodes.push({ material: glowMaterial, hue });

      if (key.label) {
        const texture = makeLegendTexture(key.label, redKey);
        if (texture) {
          const legendGeometry = new THREE.PlaneGeometry(Math.min(keyWidth * 0.78, 0.5), 0.2);
          const legendMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
          });
          disposableGeometries.push(legendGeometry);
          disposableMaterials.push(legendMaterial);

          const legend = new THREE.Mesh(legendGeometry, legendMaterial);
          legend.rotation.x = -Math.PI / 2;
          legend.position.y = keyHeight / 2 + 0.004;
          keyGroup.add(legend);
        }
      }

      group.add(keyGroup);
      x += keyWidth + keyGap * keyUnit;
    });
  });

  const accentGeometry = new THREE.RingGeometry(1.72, 1.79, 96);
  const accentMaterial = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  disposableGeometries.push(accentGeometry);
  disposableMaterials.push(accentMaterial);
  const accent = new THREE.Mesh(accentGeometry, accentMaterial);
  accent.rotation.x = -Math.PI / 2;
  accent.position.set(0, -0.08, 0.08);
  group.add(accent);

  return { group, glowNodes, disposableMaterials, disposableGeometries, accentMaterial };
}

function normalizeModel(object: THREE.Object3D, targetWidth: number) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scale = targetWidth / Math.max(size.x, 0.001);
  object.scale.setScalar(scale);
  object.position.sub(center.multiplyScalar(scale));
}

export function SetupThreeOverlay({ visible }: SetupThreeOverlayProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible) return;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(4.9, 3.25, 6.7);
    camera.lookAt(0.1, 0.16, 0.1);

    const root = new THREE.Group();
    root.position.set(1.35, -0.18, 0);
    root.rotation.y = -0.18;
    scene.add(root);

    scene.add(new THREE.HemisphereLight(0xf8fafc, 0x172033, 1.85));
    const keyLight = new THREE.DirectionalLight(0xffffff, 4.8);
    keyLight.position.set(4, 6, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const cyanLight = new THREE.PointLight(0x38bdf8, 5.4, 7.4);
    cyanLight.position.set(-2.2, 0.8, 1.9);
    root.add(cyanLight);

    const magentaLight = new THREE.PointLight(0xfb7185, 4.8, 7.2);
    magentaLight.position.set(2.3, 0.55, 1.4);
    root.add(magentaLight);

    const deskGeometry = new THREE.PlaneGeometry(8.8, 5.2);
    const deskMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0b1118,
      roughness: 0.62,
      metalness: 0.04,
      clearcoat: 0.2,
      clearcoatRoughness: 0.7,
    });
    const desk = new THREE.Mesh(deskGeometry, deskMaterial);
    desk.rotation.x = -Math.PI / 2;
    desk.position.y = -0.12;
    desk.receiveShadow = true;
    root.add(desk);

    const keyboard = makeKeyboard();
    keyboard.group.position.set(0.12, 0.08, 1.15);
    keyboard.group.rotation.y = -0.03;
    root.add(keyboard.group);

    const laptopMount = new THREE.Group();
    laptopMount.position.set(-0.28, 0.12, -1.1);
    laptopMount.rotation.y = 0.08;
    root.add(laptopMount);

    const loader = new GLTFLoader();
    let laptopModel: THREE.Object3D | null = null;
    let active = true;
    loader.load(macbookAssetPath, (gltf) => {
      if (!active) return;
      laptopModel = gltf.scene;
      laptopModel.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.castShadow = true;
        node.receiveShadow = true;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
            material.roughness = Math.min(0.78, Math.max(material.roughness ?? 0.5, 0.42));
            material.metalness = Math.min(0.62, Math.max(material.metalness ?? 0.1, 0.12));
          }
        }
      });
      normalizeModel(laptopModel, 4.25);
      laptopModel.rotation.x = -0.03;
      laptopMount.add(laptopModel);
    });

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const compact = width < 640;
      root.position.set(compact ? 0.52 : 1.35, compact ? -0.36 : -0.18, compact ? 0.25 : 0);
      root.scale.setScalar(compact ? 0.66 : Math.min(1.06, Math.max(0.9, width / 1120)));
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let frame: number | null = null;
    let intersecting = true;

    const render = (now: number) => {
      frame = null;
      const time = now * 0.001;
      root.rotation.x = -0.03 + Math.sin(time * 0.7) * 0.012;
      root.rotation.y = -0.18 + Math.sin(time * 0.43) * 0.034;
      keyboard.group.position.y = 0.08 + Math.sin(time * 1.05) * 0.018;
      keyboard.accentMaterial.color.setHSL((time * 0.04) % 1, 0.92, 0.62);
      keyboard.accentMaterial.opacity = 0.16 + Math.sin(time * 1.2) * 0.05;
      cyanLight.color.setHSL((time * 0.055 + 0.55) % 1, 0.95, 0.62);
      magentaLight.color.setHSL((time * 0.055 + 0.88) % 1, 0.95, 0.62);

      for (const node of keyboard.glowNodes) {
        const hue = (node.hue + time * 0.075) % 1;
        node.material.color.setHSL(hue, 0.9, 0.58);
        node.material.opacity = 0.38 + Math.sin(time * 2.5 + node.hue * Math.PI * 2) * 0.14;
      }

      renderer.render(scene, camera);
      if (!document.hidden && intersecting) frame = window.requestAnimationFrame(render);
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
      active = false;
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      renderer.dispose();
      deskGeometry.dispose();
      deskMaterial.dispose();
      for (const geometry of keyboard.disposableGeometries) geometry.dispose();
      for (const material of keyboard.disposableMaterials) disposeMaterial(material);
      if (laptopModel) {
        laptopModel.traverse((node) => {
          if (!(node instanceof THREE.Mesh)) return;
          node.geometry?.dispose();
          disposeMaterial(node.material);
        });
      }
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <aside className="setup-three-orbit" ref={hostRef} aria-hidden="true">
      <canvas className="setup-three-canvas" ref={canvasRef} />
      <div className="setup-three-readout">
        <span>setup scene</span>
        <strong>m a x / red caps</strong>
      </div>
    </aside>
  );
}
