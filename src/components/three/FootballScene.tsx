"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/**
 * Interactive 3D football under stadium lights — the hero centrepiece.
 * The ball's classic panel pattern is drawn procedurally onto a canvas
 * (no external model/texture downloads), the ball tilts toward the cursor,
 * and clicking it gives a "kick" spin impulse. Theme accents come in as props
 * since WebGL materials can't read CSS variables.
 */

interface SceneColors {
  glow: string;
  cool: string;
  warm: string;
  particles: string;
}

/** Draws a classic black-pentagon football pattern onto an equirect canvas. */
function makeBallTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  // Leather base with subtle vignette.
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "#f4f6f8");
  base.addColorStop(0.5, "#ffffff");
  base.addColorStop(1, "#e9edf1");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const pentagon = (cx: number, cy: number, r: number, rot = 0) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = rot + (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  // Panel seams: faint hex web.
  ctx.strokeStyle = "rgba(30,38,46,0.18)";
  ctx.lineWidth = 3;
  const hexR = 74;
  for (let row = -1; row < 6; row++) {
    for (let col = -1; col < 9; col++) {
      const cx = col * hexR * 1.78 + (row % 2 ? hexR * 0.89 : 0);
      const cy = row * hexR * 1.54 + 40;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + Math.PI / 6;
        const x = cx + hexR * Math.cos(a);
        const y = cy + hexR * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Black pentagons — offset rows so they wrap pleasingly around the sphere.
  ctx.fillStyle = "#12181f";
  const rows = [
    { y: 90, n: 5, r: 46, phase: 0 },
    { y: 256, n: 5, r: 52, phase: 0.5 },
    { y: 422, n: 5, r: 46, phase: 0 },
  ];
  for (const { y, n, r, phase } of rows) {
    for (let i = 0; i < n; i++) {
      const x = ((i + phase) / n) * w;
      pentagon(x, y, r, i * 0.6);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function Ball({ colors }: { colors: SceneColors }) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const spin = useRef(0.25); // extra spin velocity from "kicks"
  const [hovered, setHovered] = useState(false);
  const texture = useMemo(() => makeBallTexture(), []);

  useFrame((state, delta) => {
    // On wide screens the ball lives right-of-centre so the headline stays
    // clear; on phones it sits low behind the copy.
    const wide = state.viewport.width > 5.2;
    const baseX = wide ? state.viewport.width / 3.9 : 0;
    const baseY = wide ? -0.2 : -2.1;

    // Kick spin decays back to a lazy roll.
    spin.current = THREE.MathUtils.lerp(spin.current, 0.25, delta * 0.8);
    if (mesh.current) {
      mesh.current.rotation.y += delta * spin.current;
      mesh.current.rotation.x += delta * spin.current * 0.35;
    }
    if (group.current) {
      // Ball leans toward the cursor — playable with mouse movement.
      group.current.rotation.z = THREE.MathUtils.lerp(
        group.current.rotation.z,
        -state.pointer.x * 0.4,
        0.06,
      );
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        state.pointer.y * 0.3,
        0.06,
      );
      group.current.position.x = THREE.MathUtils.lerp(
        group.current.position.x,
        baseX + state.pointer.x * 0.45,
        0.05,
      );
      group.current.position.y = THREE.MathUtils.lerp(
        group.current.position.y,
        baseY + state.pointer.y * 0.25,
        0.05,
      );
      const targetScale = (wide ? 1 : 0.72) * (hovered ? 1.06 : 1);
      group.current.scale.setScalar(
        THREE.MathUtils.lerp(group.current.scale.x, targetScale, 0.1),
      );
    }
  });

  return (
    <Float speed={1.6} rotationIntensity={0.25} floatIntensity={0.7}>
      <group
        ref={group}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={() => {
          spin.current = 4.5; // kick!
        }}
      >
        <mesh ref={mesh} castShadow>
          <sphereGeometry args={[1.05, 64, 64]} />
          <meshStandardMaterial
            map={texture}
            bumpMap={texture}
            bumpScale={0.6}
            roughness={0.32}
            metalness={0.05}
            envMapIntensity={0.9}
          />
        </mesh>
        {/* halo ring under the ball */}
        <mesh position={[0, -1.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 1.05, 64]} />
          <meshBasicMaterial color={colors.glow} transparent opacity={0.16} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </Float>
  );
}

/** Four stadium floodlight beams angled at the ball. */
function LightBeams({ colors }: { colors: SceneColors }) {
  const beams = useMemo(
    () => [
      { pos: [-4.5, 3.6, -2] as const, rot: [0, 0, 0.9] as const, color: colors.cool },
      { pos: [4.5, 3.6, -2] as const, rot: [0, 0, -0.9] as const, color: colors.glow },
      { pos: [-3.2, 3.8, -3.5] as const, rot: [0, 0, 0.65] as const, color: colors.warm },
      { pos: [3.2, 3.8, -3.5] as const, rot: [0, 0, -0.65] as const, color: colors.cool },
    ],
    [colors],
  );
  return (
    <>
      {beams.map((b, i) => (
        <mesh key={i} position={b.pos as unknown as THREE.Vector3} rotation={b.rot as unknown as THREE.Euler}>
          <coneGeometry args={[1.3, 7, 24, 1, true]} />
          <meshBasicMaterial
            color={b.color}
            transparent
            opacity={0.05}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </>
  );
}

export default function FootballScene({ colors }: { colors: SceneColors }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.2, 5.4], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[6, 8, 4]} intensity={2.2} color="#ffffff" />
        <pointLight position={[-6, -2, -3]} intensity={30} color={colors.warm} />
        <pointLight position={[5, -3, 2]} intensity={18} color={colors.glow} />

        <Ball colors={colors} />
        <LightBeams colors={colors} />

        <Sparkles count={90} scale={10} size={2} speed={0.25} color={colors.particles} opacity={0.55} />

        <Environment resolution={256}>
          <Lightformer intensity={1.6} position={[0, 5, -6]} scale={[12, 4, 1]} color="#ffffff" />
          <Lightformer intensity={1} position={[-6, 0, 2]} scale={[3, 8, 1]} color={colors.cool} />
          <Lightformer intensity={1} position={[6, 0, 2]} scale={[3, 8, 1]} color={colors.glow} />
        </Environment>

        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={0.55} luminanceSmoothing={0.3} intensity={0.42} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
