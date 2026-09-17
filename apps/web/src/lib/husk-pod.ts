/**
 * The hero object's geometry: a husk, with walls, that opens.
 *
 * Shared by the WebGL scene and the SVG it falls back to, so the two are one
 * object rather than two drawings that drift apart.
 *
 * What it is, and what it stopped being
 * -------------------------------------
 * A seed husk: a ribbed pod with a real wall, split along a seam that faces
 * the reader, opening to show the cavity and the lit kernel inside. It is not
 * the logo. The mark is already in the header, in the footer and at the end of
 * the scroll sequence; a fourth copy in the hero was repetition, and a product
 * called Husk should have something husk-shaped in it.
 *
 * Two earlier builds are worth recording, because the second failure is the
 * one that produced this file:
 *
 *   1. A lathe, split into two arcs. Head-on, an open lathe surface shows you
 *      its concave inside, which fills the silhouette as a flat blob and hides
 *      the thing the opening exists to reveal.
 *   2. The mark's own paths, extruded. Solid, so the blob problem went away —
 *      but it is the logo, which is the note this file is answering.
 *
 * The blob was never about lathes. It was about *thickness*: a surface with no
 * wall has no inside to see. Each half here is a closed solid — an outer
 * surface, an inner surface, and a cap at each end of its arc joining the two.
 * When it parts you see the wall's edge and the cavity behind it, which is
 * what makes it read as something that grew rather than something extruded.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

/**
 * The husk silhouette, revolved around Y: radius against height, bottom to
 * top. Widest below the equator and drawn to a point at each end — a seed,
 * not an egg. The poles sit at r = 0, so the outer and inner surfaces meet
 * there and each half closes without needing a cap.
 */
export const PROFILE: Vec2[] = [
  [0.0, -1.02],
  [0.14, -0.96],
  [0.3, -0.84],
  [0.44, -0.66],
  [0.535, -0.42],
  [0.585, -0.14],
  [0.593, 0.14],
  [0.558, 0.42],
  [0.472, 0.66],
  [0.34, 0.85],
  [0.18, 0.97],
  [0.0, 1.05],
];

/** How much of the outer radius is wall. Tapers to nothing at the poles. */
export const WALL = 0.17;

/** Flutes running down the husk, so the surface reads as grown, not moulded. */
export const RIB_COUNT = 11;
export const RIB_DEPTH = 0.035;

/** Segments per half, around the arc. */
export const SEGMENTS = 28;

const TAU = Math.PI * 2;

/**
 * The seam sits at +Z — straight at the camera — so the husk parts towards the
 * reader instead of turning to show them a gap. The two arcs are unequal
 * because a husk does not split down the middle, and because the mark's own
 * asymmetry is load-bearing (`Logo.tsx`).
 */
const SEAM = Math.PI / 2;

export interface Half {
  id: "front" | "back";
  phiStart: number;
  phiLength: number;
  /** Radians it swings open about Y. This is what uncovers the kernel. */
  openYaw: number;
  /** A little roll, so the two do not part like a machine. */
  openRoll: number;
  openOffset: Vec3;
}

/**
 * Tuned by looking at it. The first pass yawed each half by 38 degrees about
 * the origin, which is too much: an arc of nearly 200 degrees swings its whole
 * body across the centre line, so the two halves ended up side by side with
 * their backs to each other and the kernel behind both of them. The opening
 * has to *uncover* something.
 *
 * So most of the parting is translation now, with enough yaw left to turn the
 * cavity towards the reader and catch the inner wall in the key light.
 */
export const HALVES: Half[] = [
  {
    id: "front",
    phiStart: SEAM,
    phiLength: TAU * 0.54,
    openYaw: 0.3,
    openRoll: -0.08,
    openOffset: [-0.37, -0.02, 0.05],
  },
  {
    id: "back",
    phiStart: SEAM + TAU * 0.54,
    phiLength: TAU * 0.46,
    openYaw: -0.24,
    openRoll: 0.11,
    openOffset: [0.34, 0.03, 0.02],
  },
];

/** The kernel: where it sits shut, and how small it is before it grows. */
export const KERNEL_CLOSED_Y = -0.08;
export const KERNEL_OPEN_Y = 0.04;
export const KERNEL_CLOSED_SCALE = 0.42;
export const KERNEL_RADIUS = 0.33;

/** Outer radius at a point on the profile, with the flutes applied. */
export function outerRadius(r: number, phi: number): number {
  return r * (1 + RIB_DEPTH * Math.cos(RIB_COUNT * phi));
}

/** Inner radius. The wall tapers with the profile, so the tips stay solid. */
export function innerRadius(r: number): number {
  return r * (1 - WALL);
}

/**
 * A half's transform at a given openness, 0 shut and 1 open. One function, so
 * the scene and the SVG cannot disagree about where a piece ends up.
 */
export function halfTransform(half: Half, open: number) {
  return {
    yaw: half.openYaw * open,
    roll: half.openRoll * open,
    offset: [
      half.openOffset[0] * open,
      half.openOffset[1] * open,
      half.openOffset[2] * open,
    ] as Vec3,
  };
}

/** Apply that transform to one point: yaw about Y, then roll about Z. */
export function applyHalf(half: Half, p: Vec3, open: number): Vec3 {
  const t = halfTransform(half, open);
  const cy = Math.cos(t.yaw);
  const sy = Math.sin(t.yaw);
  const x1 = p[0] * cy + p[2] * sy;
  const z1 = -p[0] * sy + p[2] * cy;

  const cr = Math.cos(t.roll);
  const sr = Math.sin(t.roll);
  const x2 = x1 * cr - p[1] * sr;
  const y2 = x1 * sr + p[1] * cr;

  return [x2 + t.offset[0], y2 + t.offset[1], z1 + t.offset[2]];
}

/** A point on a half's outer surface. `u` walks its arc, `i` the profile. */
export function outerPoint(half: Half, i: number, u: number): Vec3 {
  const [r, y] = PROFILE[i];
  const phi = half.phiStart + half.phiLength * u;
  const rr = outerRadius(r, phi);
  return [Math.cos(phi) * rr, y, Math.sin(phi) * rr];
}
