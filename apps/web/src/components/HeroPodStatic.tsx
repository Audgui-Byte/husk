/**
 * The drawing the hero object degrades to: no WebGL, `prefers-reduced-motion`,
 * and the frames before the WebGL chunk lands.
 *
 * Not a placeholder. It is the same three outlines from the same
 * `lib/husk-pod.ts` tables, in the open pose the animated version settles
 * into — which, because open *is* the mark, means a reader who will never see
 * the sequence still gets the object the sequence exists to arrive at.
 *
 * Each piece is drawn twice: a darker copy offset by the extrusion depth, then
 * the face on top. That is the whole of the "3D" here, and it is enough,
 * because the shape is what carries the meaning and the shading only says
 * which piece is in front.
 *
 * It renders on the server, so it is also what a crawler sees, and it holds
 * the same square box as the canvas so nothing shifts when the scene arrives.
 */

import {
  CORE_OUTLINE,
  FLAP_OUTLINE,
  GLYPH_OFFSET,
  SHELL_OUTLINE,
  type Vec2,
} from "@/lib/husk-pod";

const SIZE = 420;
const SCALE = 150;

/* A slight three-quarter read: the depth copy is offset down-left, which is
   where the scene's key light puts the shadow side. */
const DEPTH_X = -7;
const DEPTH_Y = 6;

function toPath(outline: Vec2[], dx = 0, dy = 0): string {
  return (
    outline
      .map(([x, y], i) => {
        const px = SIZE / 2 + x * SCALE + dx;
        const py = SIZE / 2 - y * SCALE + dy;
        return `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

export function HeroPodStatic({ label }: { label?: string }) {
  const gx = SIZE / 2 + GLYPH_OFFSET[0] * SCALE;
  const gy = SIZE / 2 - GLYPH_OFFSET[1] * SCALE;

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

      {/* Depth copies first, so every face lands on top of its own side. */}
      <path className="pod-depth" d={toPath(FLAP_OUTLINE, DEPTH_X, DEPTH_Y)} />
      <path className="pod-depth" d={toPath(SHELL_OUTLINE, DEPTH_X, DEPTH_Y)} />
      <path className="pod-core-depth" d={toPath(CORE_OUTLINE, DEPTH_X, DEPTH_Y)} />

      <path className="pod-flap" d={toPath(FLAP_OUTLINE)} />
      <path className="pod-core" d={toPath(CORE_OUTLINE)} />
      <path className="pod-shell" d={toPath(SHELL_OUTLINE)} />

      <g className="pod-glyph" transform={`translate(${gx - 44} ${gy - 33})`}>
        <rect x="0" y="0" width="88" height="66" rx="5" />
        <rect className="pod-caret" x="12" y="14" width="8" height="15" />
        <rect className="pod-rule" x="12" y="38" width="48" height="4" rx="2" />
        <rect className="pod-rule pod-rule-dim" x="12" y="48" width="33" height="4" rx="2" />
      </g>
    </svg>
  );
}

export default HeroPodStatic;
