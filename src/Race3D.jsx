import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, Stars } from "@react-three/drei";
import * as THREE from "three";

// MATH RACING — third-person 3D prototype.
// Bike front points toward -Z; camera follows from behind at +Z.
function Bike({ position = [0, 0, 0], color = "#e11d48", player = false, lane = 0, speed = 1 }) {
  const root = useRef();
  const wheels = useRef([]);
  const rider = useRef();

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
    if (rider.current) rider.current.rotation.z = THREE.MathUtils.damp(
      rider.current.rotation.z,
      Math.sin(t * 0.72 + lane) * 0.025,
      3,
      delta
    );
    wheels.current.forEach((wheel) => {
      if (wheel) wheel.rotation.x -= delta * 13 * speed;
    });
  });

  const riderSuit = player ? "#f1f5f9" : "#e2e8f0";
  return (
    // The bike's nose is +Z in the model; rotate it to face down the track (-Z).
    <group ref={root} position={position} rotation={[0, Math.PI, 0]} scale={player ? 1.12 : 0.84}>
      {/* Rear and front racing slicks */}
      {[0.96, -0.96].map((z, i) => (
        <group key={z}>
          <mesh ref={(el) => (wheels.current[i] = el)} position={[0, 0.43, z]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.385, 0.115, 16, 32]} />
            <meshStandardMaterial color="#090d13" roughness={0.92} />
          </mesh>
          <mesh position={[0, 0.43, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.225, 0.225, 0.13, 28]} />
            <meshStandardMaterial color="#aeb8c7" metalness={0.78} roughness={0.28} />
          </mesh>
          <mesh position={[0, 0.43, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.145, 20]} />
            <meshStandardMaterial color="#475569" metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Swingarm, frame and engine */}
      <mesh position={[0, 0.67, -0.08]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.065, 0.09, 1.25, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.76, 0.02]} scale={[0.52, 0.39, 0.58]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#252d38" metalness={0.72} roughness={0.34} />
      </mesh>
      <mesh position={[0.31, 0.69, -0.25]} rotation={[0.08, 0, -0.12]}>
        <cylinderGeometry args={[0.075, 0.11, 0.78, 12]} />
        <meshStandardMaterial color="#a7b0bc" metalness={0.9} roughness={0.22} />
      </mesh>

      {/* MotoGP-style aerodynamic fairings */}
      <mesh position={[0, 1.02, -0.05]} scale={[0.67, 0.47, 1.12]}>
        <sphereGeometry args={[0.72, 28, 20]} />
        <meshStandardMaterial color={color} metalness={0.38} roughness={0.27} />
      </mesh>
      <mesh position={[0, 1.08, 0.73]} rotation={[0.08, 0, 0]} scale={[0.47, 0.35, 0.48]}>
        <coneGeometry args={[0.82, 1.0, 6]} />
        <meshStandardMaterial color={color} metalness={0.35} roughness={0.25} />
      </mesh>
      {/* Windscreen, headlight and rear tail */}
      <mesh position={[0, 1.39, 0.83]} rotation={[-0.28, 0, 0]} scale={[0.3, 0.12, 0.34]}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshPhysicalMaterial color="#b9e7ff" transparent opacity={0.72} roughness={0.12} metalness={0.12} />
      </mesh>
      <mesh position={[0, 1.32, 1.03]} scale={[0.22, 0.07, 0.08]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#f8fafc" emissive="#dbeafe" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, 1.25, -0.91]} rotation={[0.05, 0, 0]} scale={[0.36, 0.16, 0.46]}>
        <coneGeometry args={[0.75, 0.85, 5]} />
        <meshStandardMaterial color={color} metalness={0.28} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.29, -1.22]} scale={[0.16, 0.055, 0.08]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.7} />
      </mesh>

      {/* Forks and handlebars */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.2, 0.91, 0.73]} rotation={[0.1, 0, side * -0.12]}>
          <cylinderGeometry args={[0.035, 0.045, 0.83, 10]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 1.38, 0.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.9, 12]} />
        <meshStandardMaterial color="#171c25" metalness={0.6} />
      </mesh>

      {/* Rider in tucked racing posture: suit, full-face helmet, gloves, boots */}
      <group ref={rider} position={[0, 1.36, -0.1]} rotation={[0.3, 0, 0]}>
        <mesh position={[0, 0.28, 0.02]} rotation={[0.42, 0, 0]} scale={[0.42, 0.58, 0.34]}>
          <capsuleGeometry args={[0.38, 0.55, 6, 12]} />
          <meshStandardMaterial color={riderSuit} roughness={0.72} />
        </mesh>
        {/* back hump */}
        <mesh position={[0, 0.55, -0.19]} scale={[0.28, 0.28, 0.32]}>
          <sphereGeometry args={[1, 18, 14]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
        {/* helmet shell and dark visor */}
        <mesh position={[0, 0.88, 0.15]}>
          <sphereGeometry args={[0.3, 24, 18]} />
          <meshStandardMaterial color={player ? "#dc2626" : color} metalness={0.35} roughness={0.24} />
        </mesh>
        <mesh position={[0, 0.88, 0.405]} scale={[0.225, 0.115, 0.055]}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshPhysicalMaterial color="#07111f" metalness={0.65} roughness={0.12} />
        </mesh>
        {/* arms reach handlebars */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.38, 0.34, 0.36]} rotation={[0.92, 0, side * -0.48]}>
              <capsuleGeometry args={[0.105, 0.55, 5, 10]} />
              <meshStandardMaterial color={riderSuit} />
            </mesh>
            <mesh position={[side * 0.47, 0.17, 0.58]} scale={[0.12, 0.1, 0.13]}>
              <sphereGeometry args={[1, 12, 10]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
            {/* tucked legs and racing boots */}
            <mesh position={[side * 0.22, -0.2, -0.3]} rotation={[-0.78, 0, side * 0.14]}>
              <capsuleGeometry args={[0.13, 0.5, 5, 10]} />
              <meshStandardMaterial color="#202938" />
            </mesh>
            <mesh position={[side * 0.24, -0.43, -0.61]} scale={[0.14, 0.13, 0.23]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#090d13" roughness={0.65} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

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
      <ArenaScene boost={boost} />
    </Canvas>
    <div style={{ position: "absolute", left: 14, top: 12, padding: "7px 12px", borderRadius: 10, color: "white", background: "rgba(3,10,24,.72)", border: "1px solid rgba(96,165,250,.45)", font: "800 12px Orbitron, sans-serif", letterSpacing: 1, pointerEvents: "none" }}>
      MATH RACING · 3D ARENA
    </div>
  </div>;
}
