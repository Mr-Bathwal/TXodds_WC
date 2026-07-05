"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/**
 * Stylized golden championship trophy — the landing hero. Built from lathe
 * primitives (no external models). It idles in a slow spin; moving the cursor
 * spins it with you, and a click gives it a celebratory twirl.
 */

interface SceneColors {
  glow: string;
  cool: string;
  warm: string;
  particles: string;
}

const GOLD = "#e8b923";

function useGoblet(): THREE.LatheGeometry {
  return useMemo(() => {
    // (radius, height) profile from base plate up to the cup lip.
    const pts: THREE.Vector2[] = [
      new THREE.Vector2(0.52, 0.0),
      new THREE.Vector2(0.52, 0.06),
      new THREE.Vector2(0.34, 0.1),
      new THREE.Vector2(0.15, 0.18),
      new THREE.Vector2(0.09, 0.34),
      new THREE.Vector2(0.13, 0.5), // knop
      new THREE.Vector2(0.08, 0.62),
      new THREE.Vector2(0.08, 0.78),
      new THREE.Vector2(0.2, 0.92), // bowl underside
      new THREE.Vector2(0.34, 1.08),
      new THREE.Vector2(0.4, 1.28),
      new THREE.Vector2(0.38, 1.46),
      new THREE.Vector2(0.35, 1.52), // lip
      new THREE.Vector2(0.33, 1.5),
    ];
    return new THREE.LatheGeometry(pts, 48);
  }, []);
}

function Trophy({ colors }: { colors: SceneColors }) {
  const group = useRef<THREE.Group>(null);
  const vel = useRef(0.35);
  const goblet = useGoblet();

  const gold = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: GOLD,
        metalness: 1,
        roughness: 0.24,
        envMapIntensity: 1.35,
      }),
    [],
  );
  const plinth = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0d1117",
        metalness: 0.6,
        roughness: 0.35,
        envMapIntensity: 0.8,
      }),
    [],
  );

  useFrame((state, delta) => {
    if (!group.current) return;
    // Cursor drives the spin: drift toward pointer-based velocity, decay to idle.
    const target = 0.35 + state.pointer.x * 1.6;
    vel.current = THREE.MathUtils.lerp(vel.current, target, delta * 1.5);
    group.current.rotation.y += vel.current * delta;
    // Gentle lean toward the cursor.
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      state.pointer.y * 0.12,
      0.05,
    );
    const wide = state.viewport.width > 5.2;
    group.current.position.x = THREE.MathUtils.lerp(
      group.current.position.x,
      wide ? state.viewport.width / 4.1 : 0,
      0.06,
    );
    group.current.position.y = THREE.MathUtils.lerp(
      group.current.position.y,
      (wide ? -1.05 : -1.9) + state.pointer.y * 0.15,
      0.06,
    );
    const s = wide ? 1.35 : 0.95;
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, s, 0.08));
  });

  return (
    <Float speed={1.3} rotationIntensity={0.12} floatIntensity={0.5}>
      <group ref={group} onClick={() => (vel.current = 5)}>
        {/* plinth */}
        <mesh material={plinth} position={[0, -0.14, 0]}>
          <cylinderGeometry args={[0.62, 0.7, 0.28, 48]} />
        </mesh>
        {/* goblet body */}
        <mesh geometry={goblet} material={gold} />
        {/* handles — half-torus loops on either side of the bowl */}
        <mesh material={gold} position={[0.44, 1.14, 0]} rotation={[0, 0, -0.15]}>
          <torusGeometry args={[0.24, 0.05, 14, 28, Math.PI * 1.25]} />
        </mesh>
        <mesh material={gold} position={[-0.44, 1.14, 0]} rotation={[0, Math.PI, -0.15]}>
          <torusGeometry args={[0.24, 0.05, 14, 28, Math.PI * 1.25]} />
        </mesh>
        {/* glow ring on the floor */}
        <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.78, 1.0, 64]} />
          <meshBasicMaterial color={colors.glow} transparent opacity={0.09} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </Float>
  );
}

export default function TrophyScene({ colors }: { colors: SceneColors }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.4, 5.2], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[6, 8, 4]} intensity={2.4} color="#fff7e0" />
        <pointLight position={[-6, -2, -3]} intensity={26} color={colors.warm} />
        <pointLight position={[5, -3, 2]} intensity={16} color={colors.glow} />

        <Trophy colors={colors} />

        <Sparkles count={90} scale={10} size={2} speed={0.25} color={colors.particles} opacity={0.5} />

        <Environment resolution={256}>
          <Lightformer intensity={1.8} position={[0, 5, -6]} scale={[12, 4, 1]} color="#fff2cc" />
          <Lightformer intensity={1} position={[-6, 0, 2]} scale={[3, 8, 1]} color={colors.cool} />
          <Lightformer intensity={1.1} position={[6, 0, 2]} scale={[3, 8, 1]} color={colors.glow} />
        </Environment>

        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={0.6} luminanceSmoothing={0.3} intensity={0.4} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
