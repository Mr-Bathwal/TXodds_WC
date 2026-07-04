"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { makeBallTexture } from "./ballTexture";

/**
 * Lightweight interactive football — no postprocessing, capped DPR — for page
 * headers. Rolls lazily, leans toward the cursor, and a click kicks it into a
 * fast spin.
 */
function Ball({ glow }: { glow: string }) {
  const mesh = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  const spin = useRef(0.4);
  const texture = useMemo(() => makeBallTexture(), []);

  useFrame((state, delta) => {
    spin.current = THREE.MathUtils.lerp(spin.current, 0.4, delta * 0.9);
    if (mesh.current) {
      mesh.current.rotation.y += delta * spin.current;
      mesh.current.rotation.x += delta * spin.current * 0.3;
    }
    if (group.current) {
      group.current.rotation.z = THREE.MathUtils.lerp(
        group.current.rotation.z,
        -state.pointer.x * 0.5,
        0.08,
      );
      group.current.position.y = THREE.MathUtils.lerp(
        group.current.position.y,
        state.pointer.y * 0.15,
        0.08,
      );
    }
  });

  return (
    <group ref={group} onClick={() => (spin.current = 6)}>
      <mesh ref={mesh}>
        <sphereGeometry args={[1.15, 48, 48]} />
        <meshStandardMaterial
          map={texture}
          bumpMap={texture}
          bumpScale={0.5}
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>
      <mesh position={[0, -1.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1.1, 48]} />
        <meshBasicMaterial color={glow} transparent opacity={0.22} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function MiniBall({ glow = "#1ad17a" }: { glow?: string }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 3.4], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 5, 3]} intensity={2} />
        <pointLight position={[-4, -2, 2]} intensity={12} color={glow} />
        <Ball glow={glow} />
      </Suspense>
    </Canvas>
  );
}
