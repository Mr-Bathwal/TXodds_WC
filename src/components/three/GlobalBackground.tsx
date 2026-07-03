"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTheme } from "@/lib/theme";

/**
 * Ambient 3D layer behind every page: a drifting particle field plus a faint
 * receding pitch grid, both parallaxing toward the cursor. Deliberately cheap —
 * no postprocessing, capped DPR — so the app stays fast while feeling alive.
 */

function Particles({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const n = 500;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 24;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 14;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10 - 3;
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.012;
    // Parallax toward pointer.
    ref.current.rotation.x = THREE.MathUtils.lerp(
      ref.current.rotation.x,
      -state.pointer.y * 0.12,
      0.03,
    );
    ref.current.rotation.z = THREE.MathUtils.lerp(
      ref.current.rotation.z,
      state.pointer.x * 0.06,
      0.03,
    );
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color={color}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** Faint pitch-line grid receding into the distance. */
function PitchGrid({ color }: { color: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.x = THREE.MathUtils.lerp(
      ref.current.position.x,
      state.pointer.x * 0.8,
      0.02,
    );
  });
  return (
    <group ref={ref} position={[0, -3.4, -4]} rotation={[-Math.PI / 2.15, 0, 0]}>
      <gridHelper args={[40, 26, color, color]}>
        <meshBasicMaterial transparent opacity={0.07} depthWrite={false} />
      </gridHelper>
    </group>
  );
}

export default function GlobalBackground() {
  const { theme } = useTheme();
  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
      <Canvas
        dpr={[1, 1.25]}
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        eventSource={typeof document !== "undefined" ? document.body : undefined}
        eventPrefix="client"
      >
        <Suspense fallback={null}>
          <Particles color={theme.three.particles} />
          <PitchGrid color={theme.three.glow} />
        </Suspense>
      </Canvas>
    </div>
  );
}
