/**
 * The drawing the hero object degrades to: no WebGL, `prefers-reduced-motion`,
 * and the frames before the WebGL chunk lands.
 *
 * Not a placeholder. It is the same husk from the same `lib/husk-pod.ts`
 * tables, projected here in TypeScript, in the open pose the animated version
 * settles into — so a reader who will never see the sequence still gets the
 * object the sequence exists to arrive at.
 *
 * Each half is drawn as its outer silhouette with the inner wall laid over it,
 * which is the SVG's version of the thing the geometry is built to show: the
 * husk has a wall, and when it opens you see the edge of it. The kernel sits
 * between them.
 *
 * It renders on the server, so it is also what a crawler sees, and it holds
 * the same square box as the canvas so nothing shifts when the scene arrives.
 */

import {
  HALVES,
  KERNEL_OPEN_Y,
  KERNEL_RADIUS,
  PROFILE,
  applyHalf,
  innerRadius,
  outerRadius,
  type Half,
  type Vec3,
} from "@/lib/husk-pod";

/* A three-quarter view, matching where the canvas camera sits. */
const YAW = 0.3;
const PITCH = -0.08;
const SIZE = 420;
const SCALE = 150;

function rotate(v: Vec3): Vec3 {
  const [x, y, z] = v;
  const x1 = x * Math.cos(YAW) + z * Math.sin(YAW);
  const z1 = -x * Math.sin(YAW) + z * Math.cos(YAW);
  const y2 = y * Math.cos(PITCH) - z1 * Math.sin(PITCH);
  const z2 = y * Math.sin(PITCH) + z1 * Math.cos(PITCH);
  return [x1, y2, z2];
}

function project(v: Vec3): [number, number] {
  const [x, y] = rotate(v);
  return [SIZE / 2 + x * SCALE, SIZE / 2 - y * SCALE];
}

function toPath(points: Array<[number, number]>): string {
  return (
    points
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(" ") + " Z"
  );
}

/**
 * One half's silhouette: up one edge of its arc and back down the other. With
 * `inner` it traces the cavity wall instead, which is the surface the open
 * husk shows.
 */
function halfOutline(half: Half, open: number, inner: boolean): string {
  const pts: Array<[number, number]> = [];
  const at = (i: number, u: number) => {
    const [r, y] = PROFILE[i];
    const phi = half.phiStart + half.phiLength * u;
    const rr = inner ? innerRadius(r) : outerRadius(r, phi);
    const p: Vec3 = [Math.cos(phi) * rr, y, Math.sin(phi) * rr];
    return project(applyHalf(half, p, open));
  };
  for (let i = 0; i < PROFILE.length; i++) pts.push(at(i, 0));
  for (let i = PROFILE.length - 1; i >= 0; i--) pts.push(at(i, inner ? 0.5 : 1));
  return toPath(pts);
}

function kernelOutline(): string {
  const r = KERNEL_RADIUS;
  const pts: Array<[number, number]> = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    pts.push(project([Math.cos(a) * r * 0.82, KERNEL_OPEN_Y + Math.sin(a) * r * 1.55, 0]));
  }
  return toPath(pts);
}

export function HeroPodStatic({ label }: { label?: string }) {
  const open = 1;
  const [front, back] = HALVES;

  return (
    <svg
      className="hero-pod-svg"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      focusable="false"
    >
      {label ? <title>{label}</title> : null}

      {/* Back half first, then the kernel between them, then the front half —
          the same order the depth buffer resolves them in. */}
      <path className="pod-shell-back" d={halfOutline(back, open, false)} />
      <path className="pod-wall" d={halfOutline(back, open, true)} />
      <path className="pod-kernel" d={kernelOutline()} />
      <path className="pod-wall" d={halfOutline(front, open, true)} />
      <path className="pod-shell" d={halfOutline(front, open, false)} />
    </svg>
  );
}

export default HeroPodStatic;
