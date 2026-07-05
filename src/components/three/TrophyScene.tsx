"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/**
 * Sleek golden championship trophy — landing hero. Smooth spline-lathed
 * silhouette, clean warm-gold lighting (no colored streaks), deliberately
 * compact so the headline owns the page. Cursor movement drives a slow spin;
 * click for a celebratory twirl.
 */

interface SceneColors {
  glow: string;
  cool: string;
  warm: string;
  particles: string;
}

function useCup(): THREE.LatheGeometry {
  return useMemo(() => {
    // Smooth (radius, height) silhouette: wide base → slender stem → flowing bowl.
    const spline = new THREE.SplineCurve([
      new THREE.Vector2(0.46, 0.0),
      new THREE.Vector2(0.44, 0.05),
      new THREE.Vector2(0.3, 0.09),
      new THREE.Vector2(0.14, 0.17),
      new THREE.Vector2(0.09, 0.32),
      new THREE.Vector2(0.11, 0.46),
      new THREE.Vector2(0.07, 0.6),
      new THREE.Vector2(0.08, 0.76),
      new THREE.Vector2(0.17, 0.9),
      new THREE.Vector2(0.29, 1.04),
      new THREE.Vector2(0.34, 1.2),
      new THREE.Vector2(0.32, 1.34),
      new THREE.Vector2(0.3, 1.4),
    ]);
    return new THREE.LatheGeometry(spline.getPoints(72), 72);
  }, []);
}

function Trophy({ colors }: { colors: SceneColors }) {
  const group = useRef<THREE.Group>(null);
  const vel = useRef(0.35);
  const cup = useCup();

  const gold = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f0c04a",
        metalness: 1,
        roughness: 0.18,
        envMapIntensity: 1.1,
      }),
    [],
  );
  const plinth = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#10151c",
        metalness: 0.5,
        roughness: 0.4,
        envMapIntensity: 0.6,
      }),
    [],
  );

  useFrame((state, delta) => {
    if (!group.current) return;
    // Cursor drives the spin; decays back to an idle rotation.
    const target = 0.35 + state.pointer.x * 1.4;
    vel.current = THREE.MathUtils.lerp(vel.current, target, delta * 1.5);
    group.current.rotation.y += vel.current * delta;
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      state.pointer.y * 0.08,
      0.05,
    );
    const wide = state.viewport.width > 5.2;
    group.current.position.x = THREE.MathUtils.lerp(
      group.current.position.x,
      wide ? state.viewport.width / 3.6 : 0,
      0.06,
    );
    group.current.position.y = THREE.MathUtils.lerp(
      group.current.position.y,
      (wide ? -0.9 : -1.9) + state.pointer.y * 0.1,
      0.06,
    );
    const s = wide ? 0.85 : 0.62;
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, s, 0.08));
  });

  return (
    <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.35}>
      <group ref={group} onClick={() => (vel.current = 5)}>
        <mesh material={plinth} position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.56, 0.62, 0.24, 64]} />
        </mesh>
        <mesh geometry={cup} material={gold} />
        {/* subtle theme glow on the floor */}
        <mesh position={[0, -0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 0.92, 64]} />
          <meshBasicMaterial color={colors.glow} transparent opacity={0.08} side={THREE.DoubleSide} />
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
        {/* clean warm-gold lighting — no colored streaks on the metal */}
        <ambientLight intensity={0.35} />
        <directionalLight position={[6, 8, 4]} intensity={2.2} color="#ffffff" />
        <directionalLight position={[-5, 3, -2]} intensity={0.8} color="#ffe9c4" />
        <pointLight position={[0, -2, 3]} intensity={6} color="#ffd98a" />

        <Trophy colors={colors} />

        <Sparkles count={70} scale={9} size={1.8} speed={0.22} color={colors.particles} opacity={0.4} />

        <Environment resolution={256}>
          <Lightformer intensity={2} position={[0, 5, -6]} scale={[12, 4, 1]} color="#fff6e0" />
          <Lightformer intensity={0.9} position={[-6, 0, 2]} scale={[3, 8, 1]} color="#ffffff" />
          <Lightformer intensity={0.9} position={[6, 0, 2]} scale={[3, 8, 1]} color="#ffe9c4" />
        </Environment>

        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={0.7} luminanceSmoothing={0.3} intensity={0.3} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
