"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  MeshTransmissionMaterial,
  Environment,
  Lightformer,
  Sparkles,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/**
 * Refractive crystal centrepiece — the igloo.inc "grown ice" aesthetic,
 * rebuilt with a transmission material + bloom. Slowly rotates, floats, and
 * tilts toward the cursor. The faceted icosahedron reads as a crystal football:
 * on-brand for "MatchPulse".
 */
function Crystal() {
  const mesh = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.rotation.y += delta * 0.18;
      mesh.current.rotation.x += delta * 0.04;
      // Tilt toward pointer for a hand-of-god interactive feel.
      mesh.current.rotation.z = THREE.MathUtils.lerp(
        mesh.current.rotation.z,
        state.pointer.x * 0.35,
        0.04,
      );
      mesh.current.position.y = THREE.MathUtils.lerp(
        mesh.current.position.y,
        state.pointer.y * 0.25,
        0.04,
      );
    }
    if (inner.current) inner.current.rotation.y -= delta * 0.4;
  });

  return (
    <Float speed={1.4} rotationIntensity={0.5} floatIntensity={1.1}>
      {/* Glowing core seen through the glass */}
      <mesh ref={inner} scale={0.55}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#1ad17a"
          emissive="#1ad17a"
          emissiveIntensity={1.15}
          roughness={0.35}
          metalness={0.1}
        />
      </mesh>

      {/* Refractive crystal shell */}
      <mesh ref={mesh} scale={1.55}>
        <icosahedronGeometry args={[1, 0]} />
        <MeshTransmissionMaterial
          samples={6}
          resolution={512}
          transmission={1}
          thickness={1.3}
          roughness={0.06}
          ior={1.44}
          chromaticAberration={0.7}
          anisotropicBlur={0.3}
          distortion={0.35}
          distortionScale={0.4}
          temporalDistortion={0.15}
          color="#cdefff"
          background={new THREE.Color("#04060a")}
        />
      </mesh>
    </Float>
  );
}

export default function CrystalHero() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 6], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.25} />
        <directionalLight position={[5, 5, 5]} intensity={1.1} color="#bfe9ff" />
        <pointLight position={[-5, -3, -2]} intensity={26} color="#9945ff" />
        <pointLight position={[4, -4, 3]} intensity={14} color="#1ad17a" />

        <Crystal />

        <Sparkles count={80} scale={9} size={2.2} speed={0.3} color="#8fd8ff" opacity={0.7} />

        {/* Inline environment (no external HDRI fetch) for crisp reflections. */}
        <Environment resolution={256}>
          <Lightformer intensity={2} position={[0, 4, -6]} scale={[10, 4, 1]} color="#8fd8ff" />
          <Lightformer intensity={1.4} position={[-5, 1, 2]} scale={[3, 6, 1]} color="#9945ff" />
          <Lightformer intensity={1.4} position={[5, -1, 2]} scale={[3, 6, 1]} color="#1ad17a" />
        </Environment>

        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={0.38} luminanceSmoothing={0.25} intensity={0.5} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
