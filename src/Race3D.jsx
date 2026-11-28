import React, { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, Stars, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import bikeUrl from "./assets/sport-motorcycle-v1-lod0.glb";

// MATH RACING — third-person 3D prototype.
// Bike front points toward -Z; camera follows from behind at +Z.
function Bike({ position = [0, 0, 0], color = "#e11d48", player = false, lane = 0, speed = 1 }) {
  const root = useRef();
  const rider = useRef();
  const { scene } = useGLTF(bikeUrl);

  // Clone the GLB so every racer has its own independent model/material state.
  const bikeModel = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    const bounds = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);

    // Normalize different model dimensions to a consistent racing-bike length.
    const longest = Math.max(size.x, size.z, 0.001);
    const scale = 2.65 / longest;
    const rotateY = size.x > size.z ? Math.PI / 2 : Math.PI;

    return { object: clone, center, scale, rotateY, minY: bounds.min.y };
  }, [scene]);

  useFrame((state, delta) => {
    if (!root.current) return;
    const t = state.clock.elapsedTime;
    root.current.position.y = position[1] + 0.018 + Math.sin(t * 8 * speed + lane) * 0.012;
    root.current.rotation.z = THREE.MathUtils.damp(
      root.current.rotation.z,
      Math.sin(t * 0.72 + lane) * 0.045,
      3.5,
      delta
    );
    if (rider.current) {
      rider.current.rotation.z = THREE.MathUtils.damp(
        rider.current.rotation.z,
        Math.sin(t * 0.72 + lane) * 0.025,
        3,
        delta
      );
    }
  });

  const riderSuit = player ? "#f1f5f9" : color;

  return (
    <group ref={root} position={position} scale={player ? 1.08 : 0.82}>
      <group
        rotation={[0, bikeModel.rotateY, 0]}
        scale={bikeModel.scale}
        position={[
          -bikeModel.center.x * bikeModel.scale,
          -bikeModel.minY * bikeModel.scale,
          -bikeModel.center.z * bikeModel.scale
        ]}
      >
        <primitive object={bikeModel.object} />
      </group>

      {/* Separate rider silhouette: the uploaded GLB contains the motorcycle only. */}
      <group ref={rider} position={[0, 0.88, 0.02]} rotation={[0.32, 0, 0]}>
        <mesh position={[0, 0.22, 0]}>
          <capsuleGeometry args={[0.23, 0.48, 6, 12]} />
          <meshStandardMaterial color={riderSuit} roughness={0.72} />
        </mesh>
        <mesh position={[0, 0.72, 0.08]}>
          <sphereGeometry args={[0.22, 24, 18]} />
          <meshStandardMaterial color={player ? "#dc2626" : color} metalness={0.35} roughness={0.24} />
        </mesh>
        <mesh position={[0, 0.72, 0.27]} scale={[0.17, 0.085, 0.045]}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshPhysicalMaterial color="#07111f" metalness={0.65} roughness={0.12} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.28, 0.12, 0.25]} rotation={[0.9, 0, side * -0.45]}>
              <capsuleGeometry args={[0.075, 0.42, 5, 10]} />
              <meshStandardMaterial color={riderSuit} />
            </mesh>
            <mesh position={[side * 0.18, -0.22, -0.28]} rotation={[-0.75, 0, side * 0.12]}>
              <capsuleGeometry args={[0.09, 0.38, 5, 10]} />
              <meshStandardMaterial color="#202938" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

useGLTF.preload(bikeUrl);

function RoadMarkings() {
  const group = useRef();
  const marks = useMemo(() => Array.from({ length: 28 }, (_, i) => i), []);
  useFrame((state) => {
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      child.position.z = ((-i * 5 + state.clock.elapsedTime * 27) % 140 + 140) % 140 - 70;
    });
  });
  return <group ref={group}>{marks.map((i) => (
    <mesh key={i} position={[0, 0.025, -i * 5]}>
      <boxGeometry args={[0.16, 0.025, 2.1]} />
      <meshStandardMaterial color="#f8fafc" emissive="#ffffff" emissiveIntensity={0.12} />
    </mesh>
  ))}</group>;
}

function StadiumSide({ side = -1 }) {
  const stands = useMemo(() => Array.from({ length: 20 }, (_, i) => i), []);
  return <group position={[side * 15, 0, -43]}>{stands.map((i) => (
    <group key={i} position={[0, 0, i * 5]}>
      <mesh position={[0, 1.8, 0]} rotation={[0, 0, side * -0.13]}>
        <boxGeometry args={[8, 3.6, 4.8]} />
        <meshStandardMaterial color={i % 2 ? "#263a5c" : "#344968"} roughness={0.9} />
      </mesh>
      <mesh position={[side * -0.1, 3.8, 0]}>
        <boxGeometry args={[7.8, 0.22, 4.7]} />
        <meshStandardMaterial color={i % 3 ? "#f97316" : "#38bdf8"} emissive={i % 3 ? "#f97316" : "#38bdf8"} emissiveIntensity={0.35} />
      </mesh>
    </group>
  ))}</group>;
}

function ArenaScene({ boost = false }) {
  const camera = useRef();
  const glow = useRef();
  const cameraTarget = useRef(new THREE.Vector3(0, 1.15, -10));
  useFrame((state, delta) => {
    if (camera.current) {
      camera.current.position.lerp(new THREE.Vector3(0, 4.25, 9.5), 1 - Math.pow(0.001, delta));
      camera.current.lookAt(cameraTarget.current);
    }
    if (glow.current) glow.current.intensity = boost ? 2.8 + Math.sin(state.clock.elapsedTime * 18) * 0.8 : 0.25;
  });
  return <>
    <PerspectiveCamera ref={camera} makeDefault fov={60} position={[0, 4.25, 9.5]} />
    <color attach="background" args={["#071426"]} />
    <fog attach="fog" args={["#10243b", 38, 125]} />
    <ambientLight intensity={1.15} />
    <directionalLight position={[8, 16, 5]} intensity={2.25} castShadow />
    <pointLight ref={glow} position={[0, 1.7, 1.2]} color="#38bdf8" intensity={0.25} distance={9} />
    <Stars radius={100} depth={35} count={650} factor={3} fade speed={0.3} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, -38]} receiveShadow>
      <planeGeometry args={[25, 160]} /><meshStandardMaterial color="#242d3b" roughness={0.92} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.055, -38]}>
      <planeGeometry args={[18, 160]} /><meshStandardMaterial color="#424b58" roughness={0.85} />
    </mesh>
    {[-6, -2, 2, 6].map((x) => <mesh key={x} position={[x, 0.015, -38]}>
      <boxGeometry args={[0.1, 0.025, 160]} /><meshStandardMaterial color="#f8fafc" emissive="#ffffff" emissiveIntensity={0.18} />
    </mesh>)}
    <RoadMarkings />
    {[-1, 1].map((s) => <group key={s}>
      <mesh position={[s * 9.3, 0.28, -38]}>
        <boxGeometry args={[0.35, 0.55, 160]} /><meshStandardMaterial color={s < 0 ? "#e11d48" : "#f8fafc"} />
      </mesh>
      <StadiumSide side={s} />
    </group>)}
    <group position={[0, 7.2, -28]}>
      <mesh><boxGeometry args={[19, 0.5, 0.7]} /><meshStandardMaterial color="#111827" metalness={0.5} /></mesh>
      <mesh position={[0, -0.42, 0.38]}>
        <boxGeometry args={[5.5, 0.9, 0.12]} /><meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.65} />
      </mesh>
    </group>
    {/* Opponents and player all face away from the following camera */}
    <Bike position={[-5.8, 0, -16]} color="#2563eb" lane={1} speed={1.1} />
    <Bike position={[5.8, 0, -21]} color="#f59e0b" lane={2} speed={1.18} />
    <Bike position={[-2, 0, -31]} color="#16a34a" lane={3} speed={1.06} />
    <Bike position={[2, 0, -39]} color="#a855f7" lane={4} speed={1.22} />
    <Bike position={[0, 0, 0.2]} color="#ef4444" player lane={0} speed={boost ? 1.8 : 1} />
  </>;
}

export default function Race3D({ boost = false, height = "100%", className = "" }) {
  return <div className={className} style={{ width: "100%", height, minHeight: 320, overflow: "hidden", borderRadius: 18, background: "#071426", position: "relative" }}>
    <Canvas dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }} shadows camera={{ position: [0, 4.25, 9.5], fov: 60 }}>
      <Suspense fallback={null}><ArenaScene boost={boost} /></Suspense>
    </Canvas>
    <div style={{ position: "absolute", left: 14, top: 12, padding: "7px 12px", borderRadius: 10, color: "white", background: "rgba(3,10,24,.72)", border: "1px solid rgba(96,165,250,.45)", font: "800 12px Orbitron, sans-serif", letterSpacing: 1, pointerEvents: "none" }}>
      MATH RACING · 3D ARENA
    </div>
  </div>;
}
