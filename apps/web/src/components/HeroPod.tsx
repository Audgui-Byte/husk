"use client";

/**
 * The hero object: a husk, opening.
 *
 * What it depicts
 * ---------------
 * A ribbed seed husk with a real wall, split on a seam that faces the reader.
 * It plays once on arrival — shut, then the seam parts, the two halves draw
 * back far enough to show the cavity and the wall's edge, and the kernel
 * inside grows and lights. After that it holds and tracks the pointer within a
 * few degrees. Geometry is in `lib/husk-pod.ts`, shared with the SVG this
 * degrades to.
 *
 * There was a small floating terminal glyph beside it, tying the husk to the
 * computer. It came out: it sat at the very edge of the frame and clipped at
 * the hero's real column width, and with the pod reading plainly organic a
 * 40px rectangle in the corner was clutter rather than signal. The page says
 * "computer" in the headline, in the install command and in the chat docked at
 * the bottom of it; the object does not have to say it a fourth time.
 *
 * Budget
 * ------
 * Two shells at 28 segments by 12 profile points, each a closed solid: about
 * 2.6k triangles between them. A 320-triangle kernel, 48 points, four lights
 * and one additive quad for the glow, with DPR capped at 1.75.
 *
 * The loop runs while this canvas is mounted, and the parent is what bounds
 * that: `HeroObject` unmounts the whole thing once the hero is clear of the
 * viewport, so the cost stops at the first screen and the page never holds two
 * WebGL contexts at once — the isolation viewer further down owns the other.
 *
 * `frameloop` is "always" rather than gated on a `running` prop, and that is
 * deliberate: the canvas is a lazy chunk, and a scene that mounted while the
 * hero was briefly out of view landed in "demand" and never advanced past the
 * first frame. Once the husk is open nothing moves but the pointer tracking,
 * which settles, so an idle loop here costs a cleared buffer.
 */

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import {
  HALVES,
  KERNEL_CLOSED_SCALE,
  KERNEL_CLOSED_Y,
  KERNEL_OPEN_Y,
  KERNEL_RADIUS,
  PROFILE,
  SEGMENTS,
  halfTransform,
  innerRadius,
  outerRadius,
  type Half,
} from "@/lib/husk-pod";

export interface PodColors {
  shell: string;
  shellDeep: string;
  coreLit: string;
  coreRim: string;
}

export interface HeroPodProps {
  colors: PodColors;
  /** The ref itself, not its value — the parent mutates it on pointermove. */
  pointer: React.RefObject<{ x: number; y: number }>;
  onOpened: () => void;
  startOpen?: boolean;
}

const OPEN_SECONDS = 2.1;
const DUST_COUNT = 48;

/* -----------------------------------------------------------------------------
   One half of the husk, as a closed solid.

   Outer surface, inner surface, and a cap at each end of the arc joining the
   two. The caps are the whole point: they are the wall's edge, and they are
   what the reader sees when it opens. A surface with no thickness has no
   inside to show, which is how the first two builds of this ended up looking
   like a flat blob and like the logo respectively.

   Indexed, with the two surfaces sharing no vertices with the caps — a cap
   needs its own normals or the flutes smear across the rim.
-------------------------------------------------------------------------------- */

function buildHalfGeometry(half: Half) {
  const P = PROFILE.length;
  const pos: number[] = [];
  const idx: number[] = [];

  const push = (x: number, y: number, z: number) => {
    pos.push(x, y, z);
    return pos.length / 3 - 1;
  };

  const ringPoint = (i: number, u: number, inner: boolean) => {
    const [r, y] = PROFILE[i];
    const phi = half.phiStart + half.phiLength * u;
    const rr = inner ? innerRadius(r) : outerRadius(r, phi);
    return [Math.cos(phi) * rr, y, Math.sin(phi) * rr] as const;
  };

  // --- the two surfaces ------------------------------------------------------
  for (const inner of [false, true]) {
    const base = pos.length / 3;
    for (let s = 0; s <= SEGMENTS; s++) {
      const u = s / SEGMENTS;
      for (let i = 0; i < P; i++) {
        const [x, y, z] = ringPoint(i, u, inner);
        push(x, y, z);
      }
    }
    for (let s = 0; s < SEGMENTS; s++) {
      for (let i = 0; i < P - 1; i++) {
        const a = base + s * P + i;
        const b = base + s * P + i + 1;
        const c = base + (s + 1) * P + i + 1;
        const d = base + (s + 1) * P + i;
        // The inner surface faces the other way, so its winding is reversed.
        if (inner) idx.push(a, c, b, a, d, c);
        else idx.push(a, b, c, a, c, d);
      }
    }
  }

  // --- the wall's edge, at both ends of the arc -------------------------------
  for (const u of [0, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i < P; i++) {
      const o = ringPoint(i, u, false);
      const n = ringPoint(i, u, true);
      push(o[0], o[1], o[2]);
      push(n[0], n[1], n[2]);
    }
    for (let i = 0; i < P - 1; i++) {
      const a = base + i * 2;
      const b = base + i * 2 + 1;
      const c = base + (i + 1) * 2 + 1;
      const d = base + (i + 1) * 2;
      if (u === 0) idx.push(a, b, c, a, c, d);
      else idx.push(a, c, b, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** The kernel. Low-poly and stretched, so it reads as a seed, not a ball. */
function buildKernelGeometry() {
  const geo = new THREE.IcosahedronGeometry(KERNEL_RADIUS, 1);
  geo.scale(0.82, 1.55, 0.82);
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
    const r = 0.35 + hash(i * 78.233) * 0.8;
    const t = hash(i * 39.425);
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = -0.9 + t * 1.9;
    pos[i * 3 + 2] = Math.sin(a) * r;
    seed[i] = t;
  }
  return { pos, seed };
}

/* The glow. A radial falloff on one additive quad — the cheapest honest
   approximation of light coming off the kernel, and the reason there is no
   postprocessing pass here: an EffectComposer writes an opaque frame, which
   put a hard-edged rectangle behind a canvas this hero needs transparent. */
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
    // A tight core and a wide wash, summed. One gaussian does not read as bloom.
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

function Scene({ colors, pointer, onOpened, startOpen }: HeroPodProps) {
  const root = useRef<THREE.Group>(null);
  const frontRef = useRef<THREE.Mesh>(null);
  const backRef = useRef<THREE.Mesh>(null);
  const kernelRef = useRef<THREE.Mesh>(null);
  const kernelMat = useRef<THREE.MeshStandardMaterial>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const haloMat = useRef<THREE.ShaderMaterial>(null);
  const dustRef = useRef<THREE.Points>(null);
  const invalidate = useThree((s) => s.invalidate);

  const anim = useRef({
    /* null until the first frame, so the clock starts when the scene actually
       begins drawing rather than when the module evaluated. */
    startedAt: startOpen ? 0 : (null as number | null),
    t: startOpen ? OPEN_SECONDS : 0,
    /* Our own clock. three.js has deprecated THREE.Clock and `state.clock`
       warns per construction; the frame already hands us a delta. */
    elapsed: 0,
    yaw: 0,
    pitch: 0,
    announced: false,
  });

  const geo = useMemo(
    () => ({
      front: buildHalfGeometry(HALVES[0]),
      back: buildHalfGeometry(HALVES[1]),
      kernel: buildKernelGeometry(),
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
      g.front.dispose();
      g.back.dispose();
      g.kernel.dispose();
    };
  }, [geo]);

  useFrame((_state, delta) => {
    const a = anim.current;
    const dt = Math.min(delta, 1 / 30);
    a.elapsed += dt;

    /* Wall clock, not accumulated deltas. An accumulator is only correct if
       every frame is delivered; this reaches 1 whether the loop ran sixty
       times a second or twice, which matters because the canvas is a lazy
       chunk mounting into a page that is still settling. */
    if (a.startedAt === null) a.startedAt = performance.now();
    const p = Math.min((performance.now() - a.startedAt) / (OPEN_SECONDS * 1000), 1);

    if (p < 1) {
      invalidate();
    } else if (!a.announced) {
      a.announced = true;
      onOpened();
    }

    // 0 shut, 1 open. The shells lead the kernel, so it grows out of something
    // that has already parted.
    const open = easeOut(Math.min(p / 0.7, 1));
    const grow = easeOutBack(Math.max(0, Math.min((p - 0.3) / 0.7, 1)));

    for (const [ref, half] of [
      [frontRef, HALVES[0]],
      [backRef, HALVES[1]],
    ] as [React.RefObject<THREE.Mesh | null>, Half][]) {
      const m = ref.current;
      if (!m) continue;
      const t = halfTransform(half, open);
      m.rotation.y = t.yaw;
      m.rotation.z = t.roll;
      m.position.set(t.offset[0], t.offset[1], t.offset[2]);
    }

    const kernel = kernelRef.current;
    if (kernel) {
      kernel.position.y = KERNEL_CLOSED_Y + (KERNEL_OPEN_Y - KERNEL_CLOSED_Y) * grow;
      kernel.rotation.y = 0.4 + grow * 0.5;
      kernel.scale.setScalar(KERNEL_CLOSED_SCALE + (1 - KERNEL_CLOSED_SCALE) * grow);
    }
    if (kernelMat.current) {
      /* 0.9, not 2.2. Above about 1.2 the kernel clips to white and stops
         being teal or faceted -- a bright blob instead of a lit seed. The
         glow it throws is the halo's job, not the material's. */
      kernelMat.current.emissiveIntensity = 0.15 + 0.9 * grow;
    }
    if (haloMat.current) {
      haloMat.current.uniforms.uStrength.value = Math.max(0, grow) * 0.54;
    }
    if (haloRef.current && kernel) {
      haloRef.current.position.y = kernel.position.y;
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
      <ambientLight intensity={0.5} />
      <directionalLight position={[3.2, 4.2, 4.6]} intensity={1.9} />
      {/* The rim. Behind and below, so the husk's edge separates from the page
          instead of needing a stroke drawn round it. */}
      <directionalLight position={[-3.6, 1.4, -4.2]} intensity={1.3} color={colors.coreRim} />
      <directionalLight position={[0, -3.4, 1.2]} intensity={0.4} />

      <group ref={root} position={[0, 0.02, 0]}>
        {/* The glow sits behind the kernel and in front of the cavity, so the
            inner wall catches some of it. */}
        <mesh ref={haloRef} position={[0, KERNEL_CLOSED_Y, 0]} renderOrder={-1}>
          <planeGeometry args={[2.2, 2.2]} />
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

        <mesh ref={kernelRef} geometry={geo.kernel} position={[0, KERNEL_CLOSED_Y, 0]}>
          <meshStandardMaterial
            ref={kernelMat}
            color={colors.coreLit}
            emissive={colors.coreLit}
            emissiveIntensity={0.18}
            roughness={0.38}
            metalness={0}
            flatShading
          />
        </mesh>

        {/* Both halves are solid, so neither needs DoubleSide. The inner
            surface is real geometry with its own normals, which is what makes
            the cavity read as a cavity. */}
        <mesh ref={frontRef} geometry={geo.front}>
          <meshStandardMaterial color={colors.shell} roughness={0.66} metalness={0.04} />
        </mesh>
        <mesh ref={backRef} geometry={geo.back}>
          <meshStandardMaterial color={colors.shellDeep} roughness={0.72} metalness={0.03} />
        </mesh>

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

export default function HeroPod(props: HeroPodProps) {
  return (
    <Canvas
      /* Always, and the parent is what bounds it. Gating this on a `running`
         prop was the bug: the canvas is a lazy chunk, and if the observer
         reported the hero out of view in the window between mount and the
         chunk arriving, the scene landed in "demand" and the opening sequence
         never advanced past frame one. The cost is bounded properly instead —
         HeroObject unmounts the whole canvas once the hero is clear. */
      frameloop="always"
      dpr={[1, 1.75]}
      camera={{ position: [0.2, 0.04, 4.5], fov: 33 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%" }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
