/**
 * The hero object's geometry, shared by the WebGL scene and the SVG it falls
 * back to — one description, so the two cannot drift into different objects.
 *
 * What it is
 * ----------
 * `brand/logo/USAGE.md` calls the mark "a split husk with a lit core", and
 * `Logo.tsx` says of its two shell paths that "the asymmetry is load-bearing":
 * one heavy half, one peeled flap, and a blade between them that is also a
 * caret. This is that mark given depth. Not a pod invented to put something in
 * the hero — which is the whole difference between an object that means
 * something and a rotating sphere.
 *
 * The three polygons below are `Logo.tsx`'s path data, unchanged, converted
 * from the mark's 32x32 viewBox into a centred unit space: x right, y up,
 * origin at the middle. Every vertex is a straight line in the original, so
 * they extrude exactly, with no curve fitting and nothing redrawn by hand.
 *
 * Why extruded outlines and not a lathe
 * -------------------------------------
 * The first build revolved a husk profile and split the revolution in two.
 * Head-on, an open half-shell shows you its concave inside, which fills the
 * whole silhouette as a flat blob and hides the core behind it — the one thing
 * the opening exists to reveal. Extruding the mark's own outlines gives solid,
 * capped pieces instead: nothing is hollow, so nothing can swallow the core,
 * and the object is recognisably the logo from the first frame.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

/** The mark's viewBox is 32x32 with y growing down. This space is centred, y up. */
function fromMark(points: Array<[number, number]>): Vec2[] {
  return points.map(([x, y]) => [(x - 16) / 16, (16 - y) / 16]);
}

/** "Shell: the heavy half of the husk." */
export const SHELL_OUTLINE: Vec2[] = fromMark([
  [13, 1.5],
  [3.5, 9],
  [1.5, 19],
  [9, 30.5],
  [17, 28],
  [13.5, 22],
  [12.5, 15.5],
  [15.5, 8.5],
  [20, 4],
]);

/** "Flap: the peeled half. The asymmetry is load-bearing." */
export const FLAP_OUTLINE: Vec2[] = fromMark([
  [23.5, 3],
  [30, 10],
  [30.5, 20],
  [26, 27.5],
  [23.5, 20],
  [23.8, 11],
]);

/** "Core: one asymmetric blade. It is also a caret." */
export const CORE_OUTLINE: Vec2[] = fromMark([
  [18.2, 9.5],
  [21, 15],
  [18.8, 26.5],
  [15.5, 15.5],
]);

/** Extrusion depth and bevel, in the same unit space. */
export const DEPTH = 0.3;
export const BEVEL = 0.035;

/**
 * How each piece sits when the husk is shut, relative to where the mark puts
 * it. Open is the mark itself — the logo is the settled state, which is what
 * makes the sequence an arrival rather than a departure.
 *
 * The flap swings about Y on a pivot at its own inner edge, so it peels rather
 * than slides. The shell leans in a little; it is the half that stays.
 */
export interface Piece {
  id: "shell" | "flap";
  /** Pivot on X, in unit space. Rotation about Y happens around this. */
  pivotX: number;
  /** Yaw when shut. Open is always 0. */
  closedYaw: number;
  /** Roll when shut. */
  closedTilt: number;
  /** Offset when shut. */
  closedOffset: Vec3;
}

export const PIECES: Piece[] = [
  {
    id: "shell",
    pivotX: (13 - 16) / 16,
    closedYaw: -0.34,
    closedTilt: 0.07,
    closedOffset: [0.2, -0.02, 0.0],
  },
  {
    id: "flap",
    pivotX: (23.5 - 16) / 16,
    closedYaw: 1.15,
    closedTilt: -0.13,
    closedOffset: [-0.34, 0.02, 0.0],
  },
];

/** The core is hidden inside the shut husk and rises as it opens. */
export const CORE_CLOSED: Vec3 = [-0.16, -0.14, -0.1];
export const CORE_CLOSED_SCALE = 0.34;

/** The terminal glyph's resting place, beside the open core. */
export const GLYPH_OFFSET: Vec3 = [1.34, 0.08, 0.14];

/**
 * A piece's transform at a given openness, 0 shut and 1 open. Written once so
 * the SVG and the scene cannot disagree about where anything ends up.
 */
export function pieceTransform(piece: Piece, open: number) {
  const k = 1 - open;
  return {
    yaw: piece.closedYaw * k,
    tilt: piece.closedTilt * k,
    offset: [
      piece.closedOffset[0] * k,
      piece.closedOffset[1] * k,
      piece.closedOffset[2] * k,
    ] as Vec3,
    pivotX: piece.pivotX,
  };
}

/** Apply that transform to one point. Yaw about Y at the pivot, then roll. */
export function applyPiece(piece: Piece, p: Vec2, open: number): Vec3 {
  const t = pieceTransform(piece, open);
  const dx = p[0] - t.pivotX;
  const cy = Math.cos(t.yaw);
  const sy = Math.sin(t.yaw);
  let x = t.pivotX + dx * cy;
  const z = -dx * sy;

  const ct = Math.cos(t.tilt);
  const st = Math.sin(t.tilt);
  const y = p[1];
  const x2 = x * ct - y * st;
  const y2 = x * st + y * ct;
  x = x2;

  return [x + t.offset[0], y2 + t.offset[1], z + t.offset[2]];
}

/** The outline for a piece id, so callers do not index two parallel arrays. */
export function outlineFor(id: Piece["id"]): Vec2[] {
  return id === "shell" ? SHELL_OUTLINE : FLAP_OUTLINE;
}
