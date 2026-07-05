"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/**
 * Golden championship trophy — landing hero. Sits perfectly upright and calm;
 * hovering it makes it swell slightly and take one smooth celebratory spin,
 * then it eases back to rest in its place. Realistic gold via a clearcoated
 * physical material.
 */

interface SceneColors {
  glow: string;
  cool: string;
  warm: string;
  particles: string;
}

function useCup(): THREE.LatheGeometry {
  return useMemo(() => {
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
  const vel = useRef(0); // spin velocity — only from hover/click impulses
  const [hovered, setHovered] = useState(false);
  const cup = useCup();

  const gold = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#f2c14e",
        metalness: 1,
        roughness: 0.2,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
        envMapIntensity: 1.15,
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
    // Spin impulse decays to stillness — the trophy rests facing forward.
    vel.current = THREE.MathUtils.lerp(vel.current, 0, delta * 1.6);
    group.current.rotation.y += vel.current * delta;
    // Once the spin has died down, ease back to the front-facing pose.
    if (Math.abs(vel.current) < 0.25) {
      const settled = Math.round(group.current.rotation.y / (Math.PI * 2)) * Math.PI * 2;
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, settled, delta * 2.5);
    }

    const wide = state.viewport.width > 5.2;
    group.current.position.x = THREE.MathUtils.lerp(
      group.current.position.x,
      wide ? state.viewport.width / 3.6 : 0,
      0.06,
    );
    group.current.position.y = THREE.MathUtils.lerp(
      group.current.position.y,
      wide ? -0.9 : -1.9,
      0.06,
    );
    const s = (wide ? 0.85 : 0.62) * (hovered ? 1.14 : 1);
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, s, 0.09));
  });

  return (
    <Float speed={1.1} rotationIntensity={0} floatIntensity={0.25}>
      <group
        ref={group}
        onPointerOver={() => {
          setHovered(true);
          vel.current = 7; // one smooth celebratory spin
        }}
        onPointerOut={() => setHovered(false)}
        onClick={() => (vel.current = 10)}
      >
        <mesh material={plinth} position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.56, 0.62, 0.24, 64]} />
        </mesh>
        <mesh geometry={cup} material={gold} />
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
