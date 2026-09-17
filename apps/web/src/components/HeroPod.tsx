"use client";

/**
 * The hero object: the husk, opening.
 *
 * What it depicts
 * ---------------
 * The brand mark in three dimensions — a heavy shell, a peeled flap, and the
 * blade between them. It plays once on arrival: shut, then the seam parts, the
 * flap peels back, and the core rises and lights. After that it holds its open
 * pose and tracks the pointer within a few degrees. The geometry lives in
 * `lib/husk-pod.ts`, shared with the SVG this degrades to.
 *
 * Budget
 * ------
 * Two lathes at 12 profile points by 18 segments, a twelve-triangle core, a
 * glyph plane and 48 points: about 1.1k triangles, four lights, one bloom
 * pass, DPR capped at 1.75.
 *
 * The loop runs while the hero is on screen and not at all otherwise, because
 * the caret blinks and a blink needs frames. What keeps that honest is the
 * parent: it unmounts this canvas entirely once the hero is clear of the
 * viewport, so the cost is bounded to the first screen and the page never
 * holds two WebGL contexts at once — the isolation viewer further down owns
 * the other one.
 */

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import {
  BEVEL,
  CORE_CLOSED,
  CORE_CLOSED_SCALE,
  CORE_OUTLINE,
  DEPTH,
  GLYPH_OFFSET,
  PIECES,
  outlineFor,
  pieceTransform,
  type Piece,
  type Vec2,
} from "@/lib/husk-pod";

export interface PodColors {
  shell: string;
  shellDeep: string;
  coreLit: string;
  coreRim: string;
  glyph: string;
}

export interface HeroPodProps {
  colors: PodColors;
  /** True while the loop may run. The parent gates this on visibility. */
  running: boolean;
  /** Pointer position within the hero box, -1..1 on each axis. The ref itself,
      not its value: the parent mutates it on pointermove, and reading .current
      during the parent's render would be reading a ref during render. */
  pointer: React.RefObject<{ x: number; y: number }>;
  /** Called once, when the opening sequence has finished. */
  onOpened: () => void;
  /** Skip the sequence and start open, for a reader who arrives scrolled. */
  startOpen?: boolean;
}

const OPEN_SECONDS = 1.85;
const DUST_COUNT = 48;

/* -----------------------------------------------------------------------------
   Geometry, built once per mount.

   One extruded outline per piece, bevelled so the edges catch the rim light
   rather than going to a hard black line. Each is centred on its own pivot so
   `rotation.y` on the mesh swings it about that edge without a wrapper group.
-------------------------------------------------------------------------------- */

function buildExtrusion(outline: Vec2[], pivotX = 0) {
  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x - pivotX, y);
    else shape.lineTo(x - pivotX, y);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 2,
    curveSegments: 1,
  });
  geo.translate(0, 0, -(DEPTH / 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * The drift. Forty-eight points seeded from their own index, so the same dust
 * lands in the same places on every machine and a screenshot diff means
 * something. They rise while the husk opens and stop when it has.
 */
function buildDust() {
  const pos = new Float32Array(DUST_COUNT * 3);
  const seed = new Float32Array(DUST_COUNT);
  const hash = (n: number) => {
    const h = Math.sin(n) * 43758.5453;
    return h - Math.floor(h);
  };
  for (let i = 0; i < DUST_COUNT; i++) {
    const a = hash(i * 12.9898) * Math.PI * 2;
    const r = 0.35 + hash(i * 78.233) * 0.75;
    const t = hash(i * 39.425);
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = -0.9 + t * 1.9;
    pos[i * 3 + 2] = Math.sin(a) * r;
    seed[i] = t;
  }
  return { pos, seed };
}

/* The halo. A radial falloff on one quad, added to whatever is behind it --
   the cheapest honest approximation of light coming off the core, and the only
   thing in this scene that is not geometry. */
const HALO_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HALO_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    // Two falloffs summed: a tight core and a wide wash, which is what a bloom
    // pass produces and what one gaussian does not.
    float tight = exp(-d * 7.0);
    float wide  = exp(-d * 2.4) * 0.35;
    float a = (tight + wide) * uStrength;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

/* Both easings are the shape of --ease-enter: quick off the mark, long settle.
   Written out because a GPU frame cannot read a CSS custom property. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c = 1.22;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

function Scene({ colors, pointer, onOpened, startOpen }: Omit<HeroPodProps, "running">) {
  const root = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const flapRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const glyphRef = useRef<THREE.Group>(null);
  const caretRef = useRef<THREE.Mesh>(null);
  const dustRef = useRef<THREE.Points>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const haloMat = useRef<THREE.ShaderMaterial>(null);
  const invalidate = useThree((s) => s.invalidate);

  const anim = useRef({
    t: startOpen ? OPEN_SECONDS : 0,
    /* Our own clock. three.js has deprecated THREE.Clock in favour of
       THREE.Timer and `state.clock` warns once per construction; the frame
       already hands us a delta, so neither is needed. */
    elapsed: 0,
    yaw: 0,
    pitch: 0,
    announced: false,
  });

  const geo = useMemo(
    () => ({
      shell: buildExtrusion(outlineFor("shell"), PIECES[0].pivotX),
      flap: buildExtrusion(outlineFor("flap"), PIECES[1].pivotX),
      core: buildExtrusion(CORE_OUTLINE, 0),
    }),
    [],
  );
  const dust = useMemo(() => buildDust(), []);
  const haloUniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(colors.coreLit) }, uStrength: { value: 0 } }),
    // Built once; the colour is pushed imperatively so a theme change does not
    // recompile the program.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    haloUniforms.uColor.value.set(colors.coreLit);
  }, [colors, haloUniforms]);

  useEffect(() => {
    const g = geo;
    return () => {
      g.shell.dispose();
      g.flap.dispose();
      g.core.dispose();
    };
  }, [geo]);

  useFrame((_state, delta) => {
    const a = anim.current;
    const dt = Math.min(delta, 1 / 30);
    a.elapsed += dt;

    if (a.t < OPEN_SECONDS) {
      a.t += dt;
      invalidate();
    } else if (!a.announced) {
      a.announced = true;
      onOpened();
    }

    // 0 shut, 1 open. The pieces lead the core by a beat, so the core rises
    // out of something that has already parted.
    const p = Math.min(a.t / OPEN_SECONDS, 1);
    const open = easeOut(Math.min(p / 0.72, 1));
    const lift = easeOutBack(Math.max(0, Math.min((p - 0.26) / 0.74, 1)));

    /* Open is the mark itself: at open === 1 every offset is zero and the
       three pieces sit exactly where brand/logo puts them. The sequence is an
       arrival at the logo, not a departure from it. */
    for (const [ref, piece] of [
      [shellRef, PIECES[0]],
      [flapRef, PIECES[1]],
    ] as [React.RefObject<THREE.Mesh | null>, Piece][]) {
      const m = ref.current;
      if (!m) continue;
      const t = pieceTransform(piece, open);
      m.rotation.y = t.yaw;
      m.rotation.z = t.tilt;
      m.position.set(
        piece.pivotX + t.offset[0],
        t.offset[1],
        t.offset[2],
      );
    }

    const core = coreRef.current;
    if (core) {
      const k = 1 - lift;
      core.position.set(CORE_CLOSED[0] * k, CORE_CLOSED[1] * k, CORE_CLOSED[2] * k);
      core.rotation.y = k * 0.5;
      core.scale.setScalar(CORE_CLOSED_SCALE + (1 - CORE_CLOSED_SCALE) * lift);
    }
    if (coreMat.current) {
      coreMat.current.emissiveIntensity = 0.2 + 2.3 * lift;
    }
    if (haloMat.current) {
      haloMat.current.uniforms.uStrength.value = Math.max(0, lift) * 0.5;
    }
    if (haloRef.current && core) {
      haloRef.current.position.copy(core.position);
    }

    const glyph = glyphRef.current;
    if (glyph) {
      const gp = Math.max(0, Math.min((p - 0.55) / 0.45, 1));
      const g = easeOut(gp);
      glyph.position.set(
        GLYPH_OFFSET[0] * (0.55 + 0.45 * g),
        GLYPH_OFFSET[1],
        GLYPH_OFFSET[2],
      );
      glyph.scale.setScalar(0.001 + 0.999 * g);
      glyph.visible = gp > 0.001;
    }

    // The caret blinks at a terminal's own rate, and only once the object is
    // open. It is the one thing here that repeats, and it repeats because a
    // cursor that does not blink is a cursor that is not waiting for you.
    if (caretRef.current && p >= 1) {
      caretRef.current.visible = Math.floor(a.elapsed * 1.6) % 2 === 0;
      invalidate();
    }

    if (dustRef.current) {
      const mat = dustRef.current.material as THREE.PointsMaterial;
      mat.opacity = Math.sin(Math.min(p, 1) * Math.PI) * 0.5;
      const attr = dustRef.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < DUST_COUNT; i++) {
        attr.setY(i, dust.pos[i * 3 + 1] + open * (0.25 + dust.seed[i] * 0.5));
      }
      attr.needsUpdate = true;
    }

    // Bounded pointer tracking. Six degrees each way: enough to feel awake,
    // nowhere near the free spin section 8.2 of UI-PRINCIPLES is about.
    const wantYaw = pointer.current.x * 0.11;
    const wantPitch = -pointer.current.y * 0.07;
    const k = 1 - Math.pow(0.0025, dt);
    a.yaw += (wantYaw - a.yaw) * k;
    a.pitch += (wantPitch - a.pitch) * k;
    if (root.current) {
      root.current.rotation.y = a.yaw;
      root.current.rotation.x = a.pitch;
    }
    if (Math.abs(wantYaw - a.yaw) > 0.0004 || Math.abs(wantPitch - a.pitch) > 0.0004) {
      invalidate();
    }
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3.2, 4.2, 4.6]} intensity={2.0} />
      {/* The rim. Behind and below, so the husk's edge separates from the page
          instead of needing a stroke drawn round it. */}
      <directionalLight position={[-3.6, 1.4, -4.2]} intensity={1.35} color={colors.coreRim} />
      <directionalLight position={[0, -3.4, 1.2]} intensity={0.35} />

      <group ref={root} position={[0, 0.02, 0]}>
        <mesh ref={shellRef} geometry={geo.shell} position={[PIECES[0].pivotX, 0, 0]}>
          <meshStandardMaterial
            color={colors.shell}
            roughness={0.5}
            metalness={0.12}
          />
        </mesh>
        <mesh ref={flapRef} geometry={geo.flap} position={[PIECES[1].pivotX, 0, 0]}>
          <meshStandardMaterial
            color={colors.shellDeep}
            roughness={0.58}
            metalness={0.1}
          />
        </mesh>

        {/* The glow, and why it is not a bloom pass.
            @react-three/postprocessing composites through an EffectComposer
            that writes an opaque frame, which put a hard-edged dark rectangle
            behind a canvas the whole hero depends on being transparent. It
            also costs about 100K of JavaScript on a page whose Total Blocking
            Time is already the thing being fixed.
            This is one additive quad with a radial falloff: same read, no
            render target, no second library, and it composites over the page
            because it never touches the alpha channel. */}
        <mesh ref={haloRef} position={CORE_CLOSED} renderOrder={-1}>
          <planeGeometry args={[2.1, 2.1]} />
          <shaderMaterial
            ref={haloMat}
            transparent
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
            uniforms={haloUniforms}
            vertexShader={HALO_VERT}
            fragmentShader={HALO_FRAG}
          />
        </mesh>

        <mesh ref={coreRef} geometry={geo.core} position={CORE_CLOSED}>
          <meshStandardMaterial
            ref={coreMat}
            color={colors.coreLit}
            emissive={colors.coreLit}
            emissiveIntensity={0.15}
            roughness={0.28}
            metalness={0}
            flatShading
          />
        </mesh>

        {/* The glyph: a terminal reduced to the only two things that say so,
            a frame and a caret waiting inside it. */}
        <group ref={glyphRef} position={GLYPH_OFFSET}>
          <mesh>
            <planeGeometry args={[0.58, 0.44]} />
            <meshStandardMaterial
              color={colors.glyph}
              roughness={0.9}
              metalness={0}
              transparent
              opacity={0.92}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh ref={caretRef} position={[-0.21, 0.1, 0.008]}>
            <planeGeometry args={[0.05, 0.1]} />
            <meshBasicMaterial color={colors.coreRim} toneMapped={false} />
          </mesh>
          {/* Two rules where output would be. Not text -- text at this size is
              unreadable and would be inventing a transcript. */}
          <mesh position={[-0.1, -0.05, 0.008]}>
            <planeGeometry args={[0.32, 0.022]} />
            <meshBasicMaterial color={colors.shell} transparent opacity={0.5} />
          </mesh>
          <mesh position={[-0.15, -0.12, 0.008]}>
            <planeGeometry args={[0.22, 0.022]} />
            <meshBasicMaterial color={colors.shell} transparent opacity={0.32} />
          </mesh>
        </group>

        <points ref={dustRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[dust.pos, 3]}
              count={DUST_COUNT}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.022}
            color={colors.coreRim}
            transparent
            opacity={0}
            sizeAttenuation
            depthWrite={false}
          />
        </points>
      </group>

    </>
  );
}

export default function HeroPod({ running, ...rest }: HeroPodProps) {
  return (
    <Canvas
      frameloop={running ? "always" : "demand"}
      dpr={[1, 1.75]}
      camera={{ position: [0.3, 0.02, 4.5], fov: 33 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%" }}
    >
      <Scene {...rest} />
    </Canvas>
  );
}
