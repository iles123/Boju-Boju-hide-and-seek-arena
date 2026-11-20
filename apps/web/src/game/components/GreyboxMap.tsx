import { RigidBody, CuboidCollider } from "@react-three/rapier";

function BoxProp({ position, args, color = "#8b7355" }: { position: [number, number, number]; args: [number, number, number]; color?: string }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[args[0] / 2, args[1] / 2, args[2] / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial color={color} />
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
          <meshStandardMaterial color="#6b7280" />
        </mesh>
      </RigidBody>

      {/* Boundary walls */}
      <BoxProp position={[0, 2.5, -40]} args={[80, 5, 1]} color="#94a3b8" />
      <BoxProp position={[0, 2.5, 40]} args={[80, 5, 1]} color="#94a3b8" />
      <BoxProp position={[-40, 2.5, 0]} args={[1, 5, 80]} color="#94a3b8" />
      <BoxProp position={[40, 2.5, 0]} args={[1, 5, 80]} color="#94a3b8" />

      {/* Interior structures / rooms */}
      <BoxProp position={[-15, 2, -10]} args={[1, 4, 20]} color="#a3a3a3" />
      <BoxProp position={[-5, 2, -20]} args={[20, 4, 1]} color="#a3a3a3" />
      <BoxProp position={[10, 2, 5]} args={[1, 4, 18]} color="#a3a3a3" />
      <BoxProp position={[18, 2, 14]} args={[16, 4, 1]} color="#a3a3a3" />
      <BoxProp position={[26, 2, 0]} args={[1, 4, 28]} color="#a3a3a3" />

      {/* Seeker spawn room (sealed feel, open front for now) */}
      <BoxProp position={[-30, 2, 30]} args={[12, 4, 1]} color="#64748b" />
      <BoxProp position={[-36, 2, 25]} args={[1, 4, 10]} color="#64748b" />
      <BoxProp position={[-24, 2, 25]} args={[1, 4, 10]} color="#64748b" />

      {/* Hider spawn spread markers/platforms */}
      <BoxProp position={[30, 0.25, -30]} args={[6, 0.5, 6]} color="#78716c" />
      <BoxProp position={[20, 0.25, -25]} args={[4, 0.5, 4]} color="#78716c" />

      {/* Hideable props / crates */}
      <BoxProp position={[-10, 0.75, 10]} args={[1.5, 1.5, 1.5]} color="#b45309" />
      <BoxProp position={[-8, 0.5, 12]} args={[1, 1, 1]} color="#92400e" />
      <BoxProp position={[5, 1, -8]} args={[2, 2, 2]} color="#a16207" />
      <BoxProp position={[15, 0.6, -12]} args={[1.2, 1.2, 1.2]} color="#78350f" />
      <BoxProp position={[22, 1, 20]} args={[2, 2, 2]} color="#b45309" />
      <BoxProp position={[-20, 0.75, -25]} args={[1.5, 1.5, 1.5]} color="#92400e" />
      <BoxProp position={[0, 0.5, 25]} args={[1, 1, 1]} color="#a16207" />
      <BoxProp position={[12, 1.25, 28]} args={[2.5, 2.5, 2.5]} color="#78350f" />

      {/* Ramp */}
      <RigidBody type="fixed" colliders={false} position={[0, 0.75, -5]} rotation={[-0.35, 0, 0]}>
        <CuboidCollider args={[2, 0.2, 4]} />
        <mesh receiveShadow castShadow>
          <boxGeometry args={[4, 0.4, 8]} />
          <meshStandardMaterial color="#525252" />
        </mesh>
      </RigidBody>
      <BoxProp position={[0, 1.5, -11]} args={[6, 0.5, 4]} color="#57534e" />

      {/* Stairs (stepped boxes) */}
      <BoxProp position={[-25, 0.25, 0]} args={[4, 0.5, 2]} color="#737373" />
      <BoxProp position={[-25, 0.75, -2]} args={[4, 0.5, 2]} color="#737373" />
      <BoxProp position={[-25, 1.25, -4]} args={[4, 0.5, 2]} color="#737373" />
      <BoxProp position={[-25, 1.5, -7]} args={[4, 0.5, 4]} color="#57534e" />

      {/* Low gap (crouch area) - overhead slab requires crouch to pass under */}
      <BoxProp position={[20, 1.45, -5]} args={[6, 0.3, 6]} color="#78716c" />
      <BoxProp position={[17.2, 0.725, -5]} args={[0.4, 1.45, 6]} color="#a8a29e" />
      <BoxProp position={[22.8, 0.725, -5]} args={[0.4, 1.45, 6]} color="#a8a29e" />

      {/* Small obstacle to step over */}
      <BoxProp position={[8, 0.15, 8]} args={[2, 0.3, 0.6]} color="#44403c" />
    </group>
  );
}
