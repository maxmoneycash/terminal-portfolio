export type CubeFace = "U" | "R" | "F" | "D" | "L" | "B";
export type CubeAxis = "x" | "y" | "z";
export type CubeStickerColor = "white" | "yellow" | "green" | "blue" | "red" | "orange";

type Vec3 = {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
  z: -1 | 0 | 1;
};

export type CubeSticker = {
  id: string;
  color: CubeStickerColor;
  position: Vec3;
  normal: Vec3;
};

export type RubiksCubeState = CubeSticker[];
export type RubiksFaceMap = Record<CubeFace, CubeStickerColor[]>;

type MoveSpec = {
  axis: CubeAxis;
  layer: -1 | 1;
  turn: -1 | 1;
};

const moveSpecs: Record<CubeFace, MoveSpec> = {
  U: { axis: "y", layer: 1, turn: 1 },
  D: { axis: "y", layer: -1, turn: -1 },
  R: { axis: "x", layer: 1, turn: 1 },
  L: { axis: "x", layer: -1, turn: -1 },
  F: { axis: "z", layer: 1, turn: 1 },
  B: { axis: "z", layer: -1, turn: -1 },
};

const faceColors: Record<CubeFace, CubeStickerColor> = {
  U: "white",
  R: "red",
  F: "green",
  D: "yellow",
  L: "orange",
  B: "blue",
};

const faceAxes: Record<CubeFace, CubeAxis> = {
  U: "y",
  D: "y",
  R: "x",
  L: "x",
  F: "z",
  B: "z",
};

const faceLayers: Record<CubeFace, -1 | 1> = {
  U: 1,
  D: -1,
  R: 1,
  L: -1,
  F: 1,
  B: -1,
};

const movePattern = /^([URFDLB])([2']?)$/i;

function axisValue(vector: Vec3, axis: CubeAxis) {
  return vector[axis];
}

function normalizeQuarterTurns(value: number) {
  return ((value % 4) + 4) % 4;
}

function rotatePositiveQuarter(vector: Vec3, axis: CubeAxis): Vec3 {
  if (axis === "x") {
    return { x: vector.x, y: (-vector.z) as Vec3["y"], z: vector.y as Vec3["z"] };
  }

  if (axis === "y") {
    return { x: vector.z as Vec3["x"], y: vector.y, z: (-vector.x) as Vec3["z"] };
  }

  return { x: (-vector.y) as Vec3["x"], y: vector.x as Vec3["y"], z: vector.z };
}

function rotateVector(vector: Vec3, axis: CubeAxis, quarterTurns: number) {
  let next = vector;
  for (let index = 0; index < normalizeQuarterTurns(quarterTurns); index += 1) {
    next = rotatePositiveQuarter(next, axis);
  }
  return next;
}

function buildFace(face: CubeFace): CubeSticker[] {
  const axis = faceAxes[face];
  const layer = faceLayers[face];
  const stickers: CubeSticker[] = [];

  for (let a = -1; a <= 1; a += 1) {
    for (let b = -1; b <= 1; b += 1) {
      const position = { x: 0, y: 0, z: 0 } as Vec3;
      const normal = { x: 0, y: 0, z: 0 } as Vec3;
      position[axis] = layer;
      normal[axis] = layer;

      if (axis === "x") {
        position.y = a as Vec3["y"];
        position.z = b as Vec3["z"];
      } else if (axis === "y") {
        position.x = a as Vec3["x"];
        position.z = b as Vec3["z"];
      } else {
        position.x = a as Vec3["x"];
        position.y = b as Vec3["y"];
      }

      stickers.push({
        id: `${face}-${a}-${b}`,
        color: faceColors[face],
        position,
        normal,
      });
    }
  }

  return stickers;
}

export function createSolvedCube(): RubiksCubeState {
  return (["U", "R", "F", "D", "L", "B"] as CubeFace[]).flatMap(buildFace);
}

export function parseCubeMoves(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true as const, moves: [] as string[] };

  const moves: string[] = [];
  for (const token of trimmed.split(/\s+/)) {
    const match = token.match(movePattern);
    if (!match) {
      return {
        ok: false as const,
        error: `Invalid move "${token}". Use U D L R F B with optional ' or 2.`,
      };
    }

    moves.push(`${match[1].toUpperCase()}${match[2] ?? ""}`);
  }

  return { ok: true as const, moves };
}

export function applyCubeMove(state: RubiksCubeState, move: string): RubiksCubeState {
  const parsed = parseCubeMoves(move);
  if (!parsed.ok || parsed.moves.length !== 1) return state;

  const normalizedMove = parsed.moves[0];
  const face = normalizedMove[0] as CubeFace;
  const suffix = normalizedMove.slice(1);
  const spec = moveSpecs[face];
  const suffixTurn = suffix === "'" ? -1 : suffix === "2" ? 2 : 1;
  const quarterTurns = spec.turn * suffixTurn;

  return state.map((sticker) => {
    if (axisValue(sticker.position, spec.axis) !== spec.layer) return sticker;
    return {
      ...sticker,
      position: rotateVector(sticker.position, spec.axis, quarterTurns),
      normal: rotateVector(sticker.normal, spec.axis, quarterTurns),
    };
  });
}

export function applyCubeMoves(state: RubiksCubeState, moves: readonly string[]) {
  return moves.reduce((nextState, move) => applyCubeMove(nextState, move), state);
}

export function invertCubeMoves(moves: readonly string[]) {
  return [...moves].reverse().map((move) => {
    const face = move[0] ?? "";
    const suffix = move.slice(1);
    if (suffix === "2") return move;
    return suffix === "'" ? face : `${face}'`;
  });
}

function faceIndex(face: CubeFace, position: Vec3) {
  if (face === "U") return (position.z + 1) * 3 + (position.x + 1);
  if (face === "D") return (1 - position.z) * 3 + (position.x + 1);
  if (face === "F") return (1 - position.y) * 3 + (position.x + 1);
  if (face === "B") return (1 - position.y) * 3 + (1 - position.x);
  if (face === "R") return (1 - position.y) * 3 + (1 - position.z);
  return (1 - position.y) * 3 + (position.z + 1);
}

function normalMatchesFace(sticker: CubeSticker, face: CubeFace) {
  return axisValue(sticker.normal, faceAxes[face]) === faceLayers[face];
}

export function cubeToFaceMap(state: RubiksCubeState): RubiksFaceMap {
  const faceMap = {
    U: Array<CubeStickerColor>(9).fill("white"),
    R: Array<CubeStickerColor>(9).fill("red"),
    F: Array<CubeStickerColor>(9).fill("green"),
    D: Array<CubeStickerColor>(9).fill("yellow"),
    L: Array<CubeStickerColor>(9).fill("orange"),
    B: Array<CubeStickerColor>(9).fill("blue"),
  };

  for (const face of Object.keys(faceMap) as CubeFace[]) {
    for (const sticker of state) {
      if (!normalMatchesFace(sticker, face)) continue;
      faceMap[face][faceIndex(face, sticker.position)] = sticker.color;
    }
  }

  return faceMap;
}

export function generateCubeScramble(length = 20) {
  const faces = ["U", "D", "R", "L", "F", "B"] as CubeFace[];
  const suffixes = ["", "'", "2"] as const;
  const axisByFace: Record<CubeFace, CubeAxis> = {
    U: "y",
    D: "y",
    R: "x",
    L: "x",
    F: "z",
    B: "z",
  };
  const count = Math.max(5, Math.min(40, Math.round(length)));
  const moves: string[] = [];

  while (moves.length < count) {
    const previous = moves[moves.length - 1]?.[0] as CubeFace | undefined;
    const previousAxis = previous ? axisByFace[previous] : null;
    const options = faces.filter((face) => axisByFace[face] !== previousAxis);
    const face = options[Math.floor(Math.random() * options.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    moves.push(`${face}${suffix}`);
  }

  return moves;
}
