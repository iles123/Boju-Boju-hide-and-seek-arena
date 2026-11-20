import { RigidBody, CuboidCollider } from "@react-three/rapier";

function BoxProp({ position, args, color = "#8b7355" }: { position: [number, number, number]; args: [number, number, number]; color?: string }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[args[0] / 2, args[1] / 2, args[2] / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    </RigidBody>
  );
}

export function GreyboxMap() {
  return (
    <group>
      {/* Ground */}
      <RigidBody type="fixed" colliders={false} position={[0, -0.5, 0]}>
        <CuboidCollider args={[40, 0.5, 40]} />
        <mesh receiveShadow>
          <boxGeometry args={[80, 1, 80]} />
          <meshStandardMaterial color="#86a873" roughness={0.95} />
        </mesh>
      </RigidBody>

      {/* Boundary walls */}
      <BoxProp position={[0, 2.5, -40]} args={[80, 5, 1]} color="#8fa3b8" />
      <BoxProp position={[0, 2.5, 40]} args={[80, 5, 1]} color="#8fa3b8" />
      <BoxProp position={[-40, 2.5, 0]} args={[1, 5, 80]} color="#8fa3b8" />
      <BoxProp position={[40, 2.5, 0]} args={[1, 5, 80]} color="#8fa3b8" />

      {/* Interior structures / rooms */}
      <BoxProp position={[-15, 2, -10]} args={[1, 4, 20]} color="#b8c2cc" />
      <BoxProp position={[-5, 2, -20]} args={[20, 4, 1]} color="#b8c2cc" />
      <BoxProp position={[10, 2, 5]} args={[1, 4, 18]} color="#c7d2fe" />
      <BoxProp position={[18, 2, 14]} args={[16, 4, 1]} color="#c7d2fe" />
      <BoxProp position={[26, 2, 0]} args={[1, 4, 28]} color="#fde68a" />

      {/* Seeker spawn room (sealed feel, open front for now) */}
      <BoxProp position={[-30, 2, 30]} args={[12, 4, 1]} color="#fca5a5" />
      <BoxProp position={[-36, 2, 25]} args={[1, 4, 10]} color="#fca5a5" />
      <BoxProp position={[-24, 2, 25]} args={[1, 4, 10]} color="#fca5a5" />

      {/* Hider spawn spread markers/platforms */}
      <BoxProp position={[30, 0.25, -30]} args={[6, 0.5, 6]} color="#a7d8a5" />
      <BoxProp position={[20, 0.25, -25]} args={[4, 0.5, 4]} color="#a7d8a5" />

      {/* Hideable props / crates - varied colors for camouflage */}
      <BoxProp position={[-10, 0.75, 10]} args={[1.5, 1.5, 1.5]} color="#d97706" />
      <BoxProp position={[-8, 0.5, 12]} args={[1, 1, 1]} color="#92400e" />
      <BoxProp position={[5, 1, -8]} args={[2, 2, 2]} color="#65a30d" />
      <BoxProp position={[15, 0.6, -12]} args={[1.2, 1.2, 1.2]} color="#0284c7" />
      <BoxProp position={[22, 1, 20]} args={[2, 2, 2]} color="#f59e0b" />
      <BoxProp position={[-20, 0.75, -25]} args={[1.5, 1.5, 1.5]} color="#7c3aed" />
      <BoxProp position={[0, 0.5, 25]} args={[1, 1, 1]} color="#e5e7eb" />
      <BoxProp position={[12, 1.25, 28]} args={[2.5, 2.5, 2.5]} color="#64748b" />
      <BoxProp position={[-28, 0.8, -5]} args={[1.6, 1.6, 1.6]} color="#16a34a" />
      <BoxProp position={[32, 0.6, 10]} args={[1.2, 1.2, 1.2]} color="#db2777" />

      {/* Ramp */}
      <RigidBody type="fixed" colliders={false} position={[0, 0.75, -5]} rotation={[-0.35, 0, 0]}>
        <CuboidCollider args={[2, 0.2, 4]} />
        <mesh receiveShadow castShadow>
          <boxGeometry args={[4, 0.4, 8]} />
          <meshStandardMaterial color="#78716c" />
        </mesh>
      </RigidBody>
      <BoxProp position={[0, 1.5, -11]} args={[6, 0.5, 4]} color="#a8a29e" />

      {/* Stairs (stepped boxes) */}
      <BoxProp position={[-25, 0.25, 0]} args={[4, 0.5, 2]} color="#94a3b8" />
      <BoxProp position={[-25, 0.75, -2]} args={[4, 0.5, 2]} color="#94a3b8" />
      <BoxProp position={[-25, 1.25, -4]} args={[4, 0.5, 2]} color="#94a3b8" />
      <BoxProp position={[-25, 1.5, -7]} args={[4, 0.5, 4]} color="#cbd5e1" />

      {/* Low gap (crouch area) - overhead slab requires crouch to pass under */}
      <BoxProp position={[20, 1.45, -5]} args={[6, 0.3, 6]} color="#7dd3fc" />
      <BoxProp position={[17.2, 0.725, -5]} args={[0.4, 1.45, 6]} color="#bae6fd" />
      <BoxProp position={[22.8, 0.725, -5]} args={[0.4, 1.45, 6]} color="#bae6fd" />

      {/* Small obstacle to step over */}
      <BoxProp position={[8, 0.15, 8]} args={[2, 0.3, 0.6]} color="#44403c" />
    </group>
  );
}
