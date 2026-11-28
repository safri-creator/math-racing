import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, Stars } from "@react-three/drei";
import * as THREE from "three";

// MATH RACING 3D arena prototype — React 18 / R3F 8 / Drei 9.
function Bike({ position = [0, 0, 0], color = "#e11d48", player = false, lane = 0, speed = 1 }) {
  const root = useRef();
  const wheels = useRef([]);
  useFrame((state, delta) => {
    if (!root.current) return;
    root.current.position.y = 0.02 + Math.sin(state.clock.elapsedTime * 8 * speed + lane) * 0.018;
    root.current.rotation.z = THREE.MathUtils.damp(root.current.rotation.z, Math.sin(state.clock.elapsedTime * 0.7 + lane) * 0.035, 3, delta);
    wheels.current.forEach((wheel) => { if (wheel) wheel.rotation.x -= delta * 12 * speed; });
  });
  const tire = "#10141c";
  return (
    <group ref={root} position={position} scale={player ? 1.08 : 0.82}>
      {[0.92, -0.91].map((z, i) => (
        <group key={z}>
          <mesh ref={(el) => (wheels.current[i] = el)} position={[0, 0.43, z]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.39, 0.105, 12, 28]} />
            <meshStandardMaterial color={tire} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.43, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.12, 24]} />
            <meshStandardMaterial color="#aeb8c7" metalness={0.65} roughness={0.35} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.82, 0.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.075, 0.075, 1.42, 10]} />
        <meshStandardMaterial color="#555e6c" metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.72, 0.02]} scale={[0.55, 0.43, 0.52]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#303846" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.03, -0.12]} rotation={[0.12, 0, 0]} scale={[0.72, 0.48, 1.08]}>
        <sphereGeometry args={[0.72, 20, 16]} />
        <meshStandardMaterial color={color} metalness={0.32} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.05, 0.63]} rotation={[0.12, 0, 0]} scale={[0.5, 0.34, 0.45]}>
        <coneGeometry args={[0.75, 0.9, 5]} />
        <meshStandardMaterial color={color} metalness={0.25} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.37, 0.67]} rotation={[-0.25, 0, 0]} scale={[0.34, 0.08, 0.28]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#dbeafe" emissive="#60a5fa" emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0, 1.32, -0.83]} scale={[0.38, 0.16, 0.42]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#171923" roughness={0.7} />
      </mesh>
      <group position={[0, 1.35, -0.12]} rotation={[0.28, 0, 0]}>
        <mesh position={[0, 0.35, -0.1]} rotation={[0.35, 0, 0]} scale={[0.42, 0.62, 0.34]}>
          <capsuleGeometry args={[0.42, 0.55, 5, 10]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.94, 0.05]}>
          <sphereGeometry args={[0.29, 20, 16]} />
          <meshStandardMaterial color={player ? "#ef4444" : color} metalness={0.2} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.98, 0.29]} scale={[0.22, 0.12, 0.08]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color="#101827" metalness={0.5} roughness={0.2} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.39, 0.38, 0.38]} rotation={[0.9, 0, side * -0.45]}>
            <capsuleGeometry args={[0.095, 0.55, 4, 8]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.22, -0.22, -0.32]} rotation={[-0.8, 0, side * 0.12]}>
            <capsuleGeometry args={[0.12, 0.52, 4, 8]} />
            <meshStandardMaterial color="#202938" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function RoadMarkings() {
  const group = useRef();
  const marks = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  useFrame((state) => {
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      child.position.z = ((-i * 5 + state.clock.elapsedTime * 24) % 120 + 120) % 120 - 60;
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
  const stands = useMemo(() => Array.from({ length: 18 }, (_, i) => i), []);
  return <group position={[side * 15, 0, -38]}>{stands.map((i) => (
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
  useFrame((state, delta) => {
    if (camera.current) {
      camera.current.position.lerp(new THREE.Vector3(0, 4.1, 8.8), 1 - Math.pow(0.001, delta));
      camera.current.lookAt(0, 1.0, -9);
    }
    if (glow.current) glow.current.intensity = boost ? 2.4 + Math.sin(state.clock.elapsedTime * 18) * 0.7 : 0.25;
  });
  return <>
    <PerspectiveCamera ref={camera} makeDefault fov={62} position={[0, 4.1, 8.8]} />
    <color attach="background" args={["#071426"]} />
    <fog attach="fog" args={["#10243b", 35, 115]} />
    <ambientLight intensity={1.05} />
    <directionalLight position={[8, 15, 5]} intensity={2.1} castShadow />
    <pointLight ref={glow} position={[0, 1.5, 1.2]} color="#38bdf8" intensity={0.25} distance={8} />
    <Stars radius={100} depth={35} count={650} factor={3} fade speed={0.3} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, -35]} receiveShadow>
      <planeGeometry args={[25, 150]} /><meshStandardMaterial color="#242d3b" roughness={0.92} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.055, -35]}>
      <planeGeometry args={[18, 150]} /><meshStandardMaterial color="#424b58" roughness={0.85} />
    </mesh>
    {[-6, -2, 2, 6].map((x) => <mesh key={x} position={[x, 0.015, -35]}>
      <boxGeometry args={[0.1, 0.025, 150]} /><meshStandardMaterial color="#f8fafc" emissive="#ffffff" emissiveIntensity={0.18} />
    </mesh>)}
    <RoadMarkings />
    {[-1, 1].map((s) => <group key={s}>
      <mesh position={[s * 9.3, 0.28, -35]}>
        <boxGeometry args={[0.35, 0.55, 150]} /><meshStandardMaterial color={s < 0 ? "#e11d48" : "#f8fafc"} />
      </mesh>
      <StadiumSide side={s} />
    </group>)}
    <group position={[0, 7.2, -26]}>
      <mesh><boxGeometry args={[19, 0.5, 0.7]} /><meshStandardMaterial color="#111827" metalness={0.5} /></mesh>
      <mesh position={[0, -0.42, 0.38]}>
        <boxGeometry args={[5.5, 0.9, 0.12]} /><meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.65} />
      </mesh>
    </group>
    <Bike position={[-5.8, 0, -16]} color="#2563eb" lane={1} speed={1.1} />
    <Bike position={[5.8, 0, -21]} color="#f59e0b" lane={2} speed={1.18} />
    <Bike position={[-2, 0, -31]} color="#16a34a" lane={3} speed={1.06} />
    <Bike position={[2, 0, -39]} color="#a855f7" lane={4} speed={1.22} />
    <Bike position={[0, 0, 0.2]} color="#ef4444" player lane={0} speed={boost ? 1.8 : 1} />
  </>;
}

export default function Race3D({ boost = false, height = "100%", className = "" }) {
  return <div className={className} style={{ width: "100%", height, minHeight: 320, overflow: "hidden", borderRadius: 18, background: "#071426", position: "relative" }}>
    <Canvas dpr={[1, 1.6]} gl={{ antialias: true, powerPreference: "high-performance" }} shadows camera={{ position: [0, 4.1, 8.8], fov: 62 }}>
      <ArenaScene boost={boost} />
    </Canvas>
    <div style={{ position: "absolute", left: 14, top: 12, padding: "7px 12px", borderRadius: 10, color: "white", background: "rgba(3,10,24,.72)", border: "1px solid rgba(96,165,250,.45)", font: "800 12px Orbitron, sans-serif", letterSpacing: 1, pointerEvents: "none" }}>
      MATH RACING · 3D ARENA
    </div>
  </div>;
}
