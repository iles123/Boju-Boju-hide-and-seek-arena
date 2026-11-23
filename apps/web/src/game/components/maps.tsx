import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export type MapId = "market" | "warehouse" | "rooftops" | "garden" | "arcade";

export type MapDef = {
  id: MapId;
  name: string;
  description: string;
  sky: string;
  fog: [string, number, number];
  ambient: number;
  hemi: [string, string, number];
  sun: [number, number, number];
  seekerSpawn: [number, number, number];
  hiderSpawns: [number, number, number][];
};

export const MAPS: MapDef[] = [
  { id: "market", name: "Open-Air Market Street", description: "Stalls, crates, awnings, and colorful props for classic camouflage.", sky: "#bfdbfe", fog: ["#bfdbfe", 25, 110], ambient: 0.75, hemi: ["#dbeafe", "#86a873", 0.35], sun: [10, 20, 10], seekerSpawn: [0, 3, 26], hiderSpawns: [[-12,3,10],[12,3,8],[-20,3,-6],[18,3,-10],[0,3,-18],[24,3,18],[-24,3,18],[6,3,0],[-6,3,-2],[20,3,22]] },
  { id: "warehouse", name: "Dockside Warehouse", description: "Tall crates, pallets, catwalk shadows, and industrial cover.", sky: "#cbd5e1", fog: ["#cbd5e1", 20, 100], ambient: 0.7, hemi: ["#e2e8f0", "#78716c", 0.3], sun: [14, 22, 6], seekerSpawn: [0, 3, 28], hiderSpawns: [[-14,3,12], [14,3,12], [-22,3,-4], [22,3,-4], [0,3,-14], [-8,3,4], [8,3,4], [-26,3,20], [26,3,20], [0,3,0]] },
  { id: "rooftops", name: "Rooftop Relay", description: "Rooftop blocks, vents, billboards, and elevation changes.", sky: "#fde68a", fog: ["#fecaca", 30, 120], ambient: 0.8, hemi: ["#fff7ed", "#64748b", 0.35], sun: [18, 24, 12], seekerSpawn: [0, 8, 24], hiderSpawns: [[-10,8,8],[10,8,8],[-18,8,-8],[18,8,-8],[0,8,-16],[22,4,18],[-22,4,18],[0,4,0],[12,4,-20],[-12,4,-20]] },
  { id: "garden", name: "Overgrown Garden", description: "Hedges, stones, planters, and patchy natural cover.", sky: "#d9f99d", fog: ["#d9f99d", 22, 105], ambient: 0.78, hemi: ["#ecfccb", "#4d7c0f", 0.4], sun: [8, 20, 14], seekerSpawn: [0, 3, 26], hiderSpawns: [[-16,3,12],[16,3,12],[-10,3,-10],[10,3,-10],[0,3,-20],[24,3,6],[-24,3,6],[4,3,2],[-4,3,18],[20,3,-18]] },
  { id: "arcade", name: "Neon Arcade Plaza", description: "Bright booths, cabinets, pillars, and playful hiding spots.", sky: "#ddd6fe", fog: ["#c4b5fd", 24, 115], ambient: 0.76, hemi: ["#ede9fe", "#334155", 0.32], sun: [12, 18, 16], seekerSpawn: [0, 3, 26], hiderSpawns: [[-14,3,14],[14,3,14],[-20,3,-8],[20,3,-8],[0,3,-16],[8,3,6],[-8,3,6],[24,3,20],[-24,3,20],[0,3,2]] },
];

export function getMapDef(id?: string | null): MapDef {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}

export function pickHiderSpawn(map: MapDef, idx: number): [number, number, number] {
  const arr = map.hiderSpawns;
  return arr[idx % arr.length] || map.seekerSpawn;
}

type PatternKind = "wood" | "fabric" | "tile" | "brick" | "grass" | "mural" | "metal" | "neon" | "stone" | "stripe" | "dots";
const patternCache = new Map<string, THREE.CanvasTexture>();

function makePattern(kind: PatternKind, base: string, accent: string, repeat: [number, number] = [1, 1]) {
  const cacheKey = `${kind}|${base}|${accent}|${repeat[0]}x${repeat[1]}`;
  const cached = patternCache.get(cacheKey);
  if (cached) return cached;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;

  if (kind === "wood") {
    for (let x = 0; x <= size; x += 16) {
      ctx.fillStyle = accent;
      ctx.globalAlpha = x % 32 === 0 ? 0.1 : 0.22;
      ctx.fillRect(x, 0, 16, size);
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
    }
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.ellipse(10 + i * 13, 12 + (i % 3) * 18, 3, 6, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (kind === "fabric") {
    for (let x = -size; x < size * 2; x += 16) {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.32;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x + size + 10, size); ctx.lineTo(x + size, size); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = accent;
    for (let y = 6; y < size; y += 12) for (let x = 6; x < size; x += 12) ctx.fillRect(x, y, 2, 2);
  } else if (kind === "tile") {
    for (let y = 0; y < size; y += 16) for (let x = 0; x < size; x += 16) {
      ctx.fillStyle = (x / 16 + y / 16) % 2 === 0 ? base : accent;
      ctx.globalAlpha = 0.5; ctx.fillRect(x + 1, y + 1, 14, 14); ctx.globalAlpha = 1;
      ctx.strokeRect(x, y, 16, 16);
    }
  } else if (kind === "brick") {
    for (let row = 0; row < 4; row++) {
      const offset = row % 2 ? -16 : 0;
      for (let x = offset; x < size; x += 32) {
        ctx.globalAlpha = 0.2; ctx.fillStyle = accent; ctx.fillRect(x + 1, row * 16 + 1, 30, 14); ctx.globalAlpha = 1;
        ctx.strokeRect(x, row * 16, 32, 16);
      }
    }
  } else if (kind === "grass") {
    ctx.fillStyle = accent;
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      ctx.globalAlpha = 0.2 + Math.random() * 0.5;
      ctx.fillRect(x, y, 2, 4 + Math.random() * 4);
    }
    ctx.globalAlpha = 1;
  } else if (kind === "mural") {
    const colors = [accent, "#f472b6", "#fbbf24", "#38bdf8", "#a78bfa", "#34d399"];
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.35 + Math.random() * 0.4;
      ctx.fillRect(Math.random() * size, Math.random() * size, 6 + Math.random() * 16, 6 + Math.random() * 16);
    }
    ctx.globalAlpha = 1;
  } else if (kind === "metal") {
    for (let y = 0; y <= size; y += 16) {
      ctx.globalAlpha = 0.18; ctx.fillStyle = accent; ctx.fillRect(0, y, size, 4); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
      ctx.fillStyle = accent;
      for (let x = 8; x < size; x += 24) { ctx.beginPath(); ctx.arc(x, y + 8, 2, 0, Math.PI * 2); ctx.fill(); }
    }
  } else if (kind === "neon") {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i += 8) {
      ctx.globalAlpha = i % 16 === 0 ? 0.55 : 0.2;
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (kind === "stripe") {
    ctx.fillStyle = accent;
    for (let x = -size; x < size * 2; x += 18) {
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 9, 0);
      ctx.lineTo(x + 9 + size, size);
      ctx.lineTo(x + size, size);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = accent;
    for (let x = 0; x <= size; x += 18) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + size, size); ctx.stroke();
    }
  } else if (kind === "dots") {
    ctx.fillStyle = accent;
    for (let y = 8; y < size; y += 16) {
      for (let x = 8; x < size; x += 16) {
        ctx.globalAlpha = (x / 16 + y / 16) % 2 === 0 ? 0.55 : 0.3;
        ctx.beginPath(); ctx.arc(x, y, (x + y) % 32 === 0 ? 6 : 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  } else {
    for (let y = 0; y < size; y += 16) {
      const offset = (y / 16) % 2 ? -12 : 0;
      for (let x = offset; x < size; x += 24) {
        ctx.globalAlpha = 0.18; ctx.fillStyle = accent; ctx.fillRect(x + 1, y + 1, 22, 14); ctx.globalAlpha = 1;
        ctx.strokeRect(x, y, 24, 16);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  patternCache.set(cacheKey, texture);
  return texture;
}

function BoxProp({ position, args, color = "#8b7355", rotY = 0, texture, emissive, emissiveIntensity = 0 }: { position: [number, number, number]; args: [number, number, number]; color?: string; rotY?: number; texture?: THREE.Texture; emissive?: string; emissiveIntensity?: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotY, 0]}>
      <CuboidCollider args={[args[0] / 2, args[1] / 2, args[2] / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial color={color} map={texture} roughness={0.88} emissive={emissive ?? "#000000"} emissiveIntensity={emissiveIntensity} />
      </mesh>
    </RigidBody>
  );
}

function Ramp({ position, rotation, size, color = "#78716c" }: { position: [number, number, number]; rotation: [number, number, number]; size: [number, number, number]; color?: string }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={rotation}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
      <mesh receiveShadow castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} />
      </mesh>
    </RigidBody>
  );
}

function DecorBox({ position, args, color = "#ffffff", texture, rot = [0, 0, 0], emissive, emissiveIntensity = 0 }: { position: [number, number, number]; args: [number, number, number]; color?: string; texture?: THREE.Texture; rot?: [number, number, number]; emissive?: string; emissiveIntensity?: number }) {
  return (
    <mesh position={position} rotation={rot} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} map={texture} emissive={emissive ?? "#000000"} emissiveIntensity={emissiveIntensity} roughness={0.85} />
    </mesh>
  );
}

function FabricAwning({ position, width = 4, depth = 2.4, height = 2.5, texture, rotY = 0 }: { position: [number, number, number]; width?: number; depth?: number; height?: number; texture: THREE.Texture; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, height, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.12, depth]} />
        <meshStandardMaterial color="#ffffff" map={texture} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 - 0.12), height / 2, -depth / 2 + 0.12]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, height, 6]} />
          <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Barrel({ position, color, texture }: { position: [number, number, number]; color: string; texture: THREE.Texture }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.55, 1.2, 12]} />
        <meshStandardMaterial color={color} map={texture} roughness={0.8} />
      </mesh>
      {[-0.38, 0.38].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.56, 0.045, 6, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function FabricRoll({ position, color, texture, rotY = 0 }: { position: [number, number, number]; color: string; texture: THREE.Texture; rotY?: number }) {
  return (
    <mesh position={position} rotation={[0, rotY, Math.PI / 2]} castShadow receiveShadow>
      <cylinderGeometry args={[0.42, 0.42, 1.5, 12]} />
      <meshStandardMaterial color={color} map={texture} roughness={0.95} />
    </mesh>
  );
}

function SignBoard({ position, color, texture, rotY = 0, width = 3 }: { position: [number, number, number]; color: string; texture: THREE.Texture; rotY?: number; width?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[width + 0.2, 1.7, 0.16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[width, 1.5, 0.06]} />
        <meshStandardMaterial color={color} map={texture} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 - 0.1), -1.15, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 1.5, 6]} />
          <meshStandardMaterial color="#475569" metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Planter({ position, potColor = "#a16207", leafColor = "#16a34a" }: { position: [number, number, number]; potColor?: string; leafColor?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.48, 0.36, 0.7, 8]} />
        <meshStandardMaterial color={potColor} roughness={0.9} />
      </mesh>
      {[[0, 1.05, 0], [-0.28, 0.9, 0.18], [0.3, 0.92, -0.12]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <dodecahedronGeometry args={[0.42, 0]} />
          <meshStandardMaterial color={leafColor} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Lantern({ position, color = "#fbbf24" }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 3.2, 6]} />
        <meshStandardMaterial color="#334155" metalness={0.5} />
      </mesh>
      <mesh position={[0, 3.25, 0]}>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

function Rug({ position, args, texture, rotY = 0 }: { position: [number, number, number]; args: [number, number, number]; texture: THREE.Texture; rotY?: number }) {
  return <DecorBox position={position} args={args} texture={texture} rot={[0, rotY, 0]} />;
}

function Vent({ position, rotY = 0 }: { position: [number, number, number]; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <DecorBox position={[0, 0, 0]} args={[1.6, 1.2, 0.3]} color="#94a3b8" />
      <DecorBox position={[0, 0, 0.18]} args={[1.2, 0.12, 0.08]} color="#475569" />
      <DecorBox position={[0, 0, 0.18]} args={[0.12, 1.2, 0.08]} color="#475569" />
    </group>
  );
}

function Billboard({ position, texture, rotY = 0 }: { position: [number, number, number]; texture: THREE.Texture; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <DecorBox position={[0, 0, 0]} args={[6.5, 3.5, 0.25]} color="#1e293b" />
      <DecorBox position={[0, 0, 0.16]} args={[6.1, 3.1, 0.06]} texture={texture} emissive="#ffffff" emissiveIntensity={0.18} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 2.6, -2.6, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 2, 6]} />
          <meshStandardMaterial color="#475569" metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Atmosphere({ color, count = 48, area = 70, height = 9, speed = 0.6, size = 0.07, opacity = 0.55 }: { color: string; count?: number; area?: number; height?: number; speed?: number; size?: number; opacity?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: Math.sin(i * 12.9898) * area * 0.5,
    z: Math.cos(i * 7.233) * area * 0.5,
    y: Math.abs(Math.sin(i * 4.771)) * height,
    phase: i * 0.73,
    scale: 0.6 + Math.abs(Math.sin(i * 2.13)) * 0.9,
    speed: 0.4 + Math.abs(Math.cos(i * 1.37)) * 1.2,
  })), [count, area, height]);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      dummy.position.set(s.x + Math.sin(t * 0.35 + s.phase) * 0.7, (s.y + t * speed * s.speed) % height, s.z + Math.cos(t * 0.28 + s.phase) * 0.7);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[size, 6, 4]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </instancedMesh>
  );
}

function CratePile({ position, texture, color = "#ffffff", count = 5 }: { position: [number, number, number]; texture: THREE.Texture; color?: string; count?: number }) {
  const items: [number, number, number, number][] = [
    [0, 0.5, 0, 1.2], [1.25, 0.4, 0.3, 1], [-1.1, 0.45, -0.4, 1.1], [0.2, 1.35, -0.2, 0.9], [1.1, 1.25, 0.5, 0.85], [-0.8, 1.3, 0.6, 0.8], [0.4, 2.05, 0.1, 0.7],
  ];
  return <group position={position}>{items.slice(0, count).map(([x, y, z, s], i) => (
    <DecorBox key={i} position={[x, y, z]} args={[s * 1.4, s, s * 1.4]} color={color} texture={texture} rot={[0, i * 0.37, 0]} />
  ))}</group>;
}

function StreetCart({ position, canopy, bodyColor = "#f8fafc", rotY = 0 }: { position: [number, number, number]; canopy: THREE.Texture; bodyColor?: string; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <DecorBox position={[0, 0.8, 0]} args={[2.8, 1, 1.4]} color={bodyColor} />
      <DecorBox position={[0, 1.35, 0]} args={[3, 0.12, 1.6]} color="#fef3c7" />
      <DecorBox position={[0, 2.65, 0]} args={[3.2, 0.12, 1.9]} color="#ffffff" texture={canopy} />
      {[-1, 1].map((s) => <mesh key={s} position={[s * 1.45, 1.9, -0.8]} castShadow><cylinderGeometry args={[0.05, 0.05, 2.1, 6]} /><meshStandardMaterial color="#64748b" /></mesh>)}
      {[-1, 1].map((s) => [-0.55, 0.55].map((z) => (
        <mesh key={`${s}-${z}`} position={[s * 1.05, 0.32, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.12, 10]} /><meshStandardMaterial color="#1e293b" />
        </mesh>
      )))}
    </group>
  );
}

function Bench({ position, rotY = 0, color = "#92400e" }: { position: [number, number, number]; rotY?: number; color?: string }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <DecorBox position={[0, 0.55, 0]} args={[2.4, 0.14, 0.7]} color={color} />
      <DecorBox position={[0, 1.05, 0.3]} args={[2.4, 0.7, 0.12]} color={color} />
      {[-0.95, 0.95].map((x) => <DecorBox key={x} position={[x, 0.27, 0]} args={[0.12, 0.55, 0.6]} color="#475569" />)}
    </group>
  );
}

function StreetLamp({ position, color = "#fde68a", height = 4.4 }: { position: [number, number, number]; color?: string; height?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow><cylinderGeometry args={[0.07, 0.09, height, 7]} /><meshStandardMaterial color="#334155" metalness={0.5} /></mesh>
      <DecorBox position={[0.55, height, 0]} args={[1.2, 0.1, 0.1]} color="#334155" />
      <mesh position={[1.05, height - 0.08, 0]}><boxGeometry args={[0.5, 0.18, 0.3]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} /></mesh>
    </group>
  );
}

function TrafficCone({ position, color = "#f97316" }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.06, 0]} castShadow><boxGeometry args={[0.6, 0.12, 0.6]} /><meshStandardMaterial color="#1e293b" /></mesh>
      <mesh position={[0, 0.4, 0]} castShadow><coneGeometry args={[0.27, 0.7, 8]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.2, 0.2, 0.12, 8]} /><meshStandardMaterial color="#f8fafc" /></mesh>
    </group>
  );
}

function FenceLine({ position, length = 8, rotY = 0, color = "#94a3b8" }: { position: [number, number, number]; length?: number; rotY?: number; color?: string }) {
  const posts = Math.max(2, Math.round(length / 2) + 1);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {Array.from({ length: posts }, (_, i) => <DecorBox key={i} position={[-length / 2 + (i * length) / (posts - 1), 0.65, 0]} args={[0.14, 1.3, 0.14]} color={color} />)}
      <DecorBox position={[0, 0.95, 0]} args={[length, 0.1, 0.1]} color={color} />
      <DecorBox position={[0, 0.45, 0]} args={[length, 0.1, 0.1]} color={color} />
    </group>
  );
}

function Tree({ position, leafColor = "#16a34a", scale = 1 }: { position: [number, number, number]; leafColor?: string; scale?: number }) {
  const leaves: [number, number, number][] = [[0, 2.6, 0], [-0.5, 2.2, 0.25], [0.5, 2.3, -0.2], [0.1, 3.25, 0.1]];
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.15, 0]} castShadow><cylinderGeometry args={[0.16, 0.24, 2.3, 7]} /><meshStandardMaterial color="#78350f" /></mesh>
      {leaves.map((p, i) => <mesh key={i} position={p} castShadow><dodecahedronGeometry args={[0.72 - i * 0.06, 0]} /><meshStandardMaterial color={leafColor} roughness={0.95} /></mesh>)}
    </group>
  );
}

function FlowerPatch({ position, colors = ["#f472b6", "#facc15", "#c084fc", "#fb7185"], count = 14 }: { position: [number, number, number]; colors?: string[]; count?: number }) {
  return (
    <group position={position}>
      {Array.from({ length: count }, (_, i) => {
        const angle = i * 2.399;
        const radius = 0.3 + (i % 5) * 0.28;
        return (
          <group key={i} position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}>
            <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[0.02, 0.02, 0.28, 5]} /><meshStandardMaterial color="#15803d" /></mesh>
            <mesh position={[0, 0.32, 0]}><sphereGeometry args={[0.11, 6, 5]} /><meshStandardMaterial color={colors[i % colors.length]} emissive={colors[i % colors.length]} emissiveIntensity={0.15} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

function PalletStack({ position, texture, levels = 3 }: { position: [number, number, number]; texture: THREE.Texture; levels?: number }) {
  return (
    <group position={position}>
      {Array.from({ length: levels }, (_, i) => (
        <group key={i} position={[0, i * 0.42, 0]}>
          {[-0.7, 0, 0.7].map((x) => <DecorBox key={x} position={[x, 0.12, 0]} args={[0.55, 0.22, 1.8]} color="#ffffff" texture={texture} />)}
          <DecorBox position={[0, 0.3, 0]} args={[2.2, 0.12, 1.9]} color="#92400e" />
        </group>
      ))}
    </group>
  );
}

function Dumpster({ position, color = "#166534", rotY = 0 }: { position: [number, number, number]; color?: string; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <DecorBox position={[0, 0.7, 0]} args={[2.6, 1.4, 1.5]} color={color} />
      <DecorBox position={[0, 1.45, -0.1]} args={[2.7, 0.12, 1.65]} color="#14532d" rot={[-0.12, 0, 0]} />
      {[-1, 1].map((s) => <mesh key={s} position={[s * 1, 0.14, 0.6]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.16, 0.16, 0.12, 8]} /><meshStandardMaterial color="#0f172a" /></mesh>)}
    </group>
  );
}

function WaterTank({ position, color = "#64748b" }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      {[-0.6, 0.6].map((x) => [-0.6, 0.6].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.7, z]} castShadow><cylinderGeometry args={[0.08, 0.08, 1.4, 6]} /><meshStandardMaterial color="#475569" /></mesh>))}
      <mesh position={[0, 2.1, 0]} castShadow><cylinderGeometry args={[1.15, 1.15, 1.5, 12]} /><meshStandardMaterial color={color} metalness={0.25} roughness={0.7} /></mesh>
      <mesh position={[0, 2.92, 0]}><cylinderGeometry args={[1.2, 1.2, 0.12, 12]} /><meshStandardMaterial color="#94a3b8" /></mesh>
    </group>
  );
}

function SatelliteDish({ position, color = "#e2e8f0" }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.8, 0]} castShadow><cylinderGeometry args={[0.08, 0.1, 1.6, 6]} /><meshStandardMaterial color="#64748b" /></mesh>
      <mesh position={[0, 1.7, 0]} rotation={[-0.5, 0.3, 0]} castShadow><cylinderGeometry args={[0.85, 0.2, 0.18, 14]} /><meshStandardMaterial color={color} metalness={0.2} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 1.9, 0]}><sphereGeometry args={[0.1, 8, 6]} /><meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.8} /></mesh>
    </group>
  );
}

function Forklift({ position, color = "#f59e0b", rotY = 0 }: { position: [number, number, number]; color?: string; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <DecorBox position={[0, 0.8, 0]} args={[2, 1.2, 1.3]} color={color} />
      <DecorBox position={[-0.5, 1.7, 0]} args={[0.9, 1, 1.2]} color="#1e293b" />
      <DecorBox position={[0.9, 1.2, 0]} args={[0.14, 2.2, 0.14]} color="#334155" />
      <DecorBox position={[1.2, 0.25, -0.35]} args={[1.4, 0.12, 0.16]} color="#475569" />
      <DecorBox position={[1.2, 0.25, 0.35]} args={[1.4, 0.12, 0.16]} color="#475569" />
      {[-0.6, 0.6].map((x) => [-0.55, 0.55].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.3, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.3, 0.3, 0.16, 10]} /><meshStandardMaterial color="#111827" /></mesh>))}
    </group>
  );
}

function Gazebo({ position, roofColor = "#16a34a" }: { position: [number, number, number]; roofColor?: string }) {
  return (
    <group position={position}>
      {[-1.6, 1.6].map((x) => [-1.6, 1.6].map((z) => <mesh key={`${x}-${z}`} position={[x, 1.4, z]} castShadow><cylinderGeometry args={[0.09, 0.11, 2.8, 7]} /><meshStandardMaterial color="#78350f" /></mesh>))}
      <mesh position={[0, 3.05, 0]} castShadow><coneGeometry args={[2.8, 1.2, 4]} /><meshStandardMaterial color={roofColor} roughness={0.9} /></mesh>
      <Bench position={[0, 0, -1.15]} color="#a16207" />
    </group>
  );
}

function Pond({ position, color = "#38bdf8" }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[3.2, 24]} /><meshStandardMaterial color={color} roughness={0.25} metalness={0.1} transparent opacity={0.88} /></mesh>
      {[[-1.2, 0.08, 0.5], [1.3, 0.08, -0.6], [0.4, 0.08, 1.4]].map((p, i) => <mesh key={i} position={p as [number, number, number]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.42, 10]} /><meshStandardMaterial color="#4ade80" /></mesh>)}
    </group>
  );
}

function NeonCabinet({ position, color = "#22d3ee", texture }: { position: [number, number, number]; color?: string; texture: THREE.Texture }) {
  return (
    <group position={position}>
      <DecorBox position={[0, 1.1, 0]} args={[1.3, 2.2, 1]} color="#111827" />
      <DecorBox position={[0, 1.35, 0.53]} args={[1.05, 1.15, 0.06]} color={color} texture={texture} emissive={color} emissiveIntensity={0.75} />
      <DecorBox position={[0, 2.18, 0.55]} args={[1.2, 0.28, 0.08]} color={color} emissive={color} emissiveIntensity={0.9} />
      <DecorBox position={[0, 0.3, 0.55]} args={[0.9, 0.16, 0.08]} color="#f8fafc" emissive="#f8fafc" emissiveIntensity={0.3} />
    </group>
  );
}

function NeonArch({ position, color = "#f472b6", width = 6, height = 3.6, rotY = 0 }: { position: [number, number, number]; color?: string; width?: number; height?: number; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {[-1, 1].map((s) => <DecorBox key={s} position={[s * width / 2, height / 2, 0]} args={[0.16, height, 0.16]} color={color} emissive={color} emissiveIntensity={0.8} />)}
      <DecorBox position={[0, height, 0]} args={[width + 0.16, 0.16, 0.16]} color={color} emissive={color} emissiveIntensity={0.8} />
    </group>
  );
}

function Jukebox({ position, color = "#f472b6" }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      <DecorBox position={[0, 1.1, 0]} args={[1.4, 2.2, 0.9]} color={color} emissive={color} emissiveIntensity={0.25} />
      <mesh position={[0, 1.45, 0.48]}><circleGeometry args={[0.42, 16]} /><meshStandardMaterial color="#fef08a" emissive="#fde047" emissiveIntensity={0.6} /></mesh>
      <DecorBox position={[0, 0.5, 0.48]} args={[0.9, 0.18, 0.06]} color="#1e293b" />
    </group>
  );
}

function PrizeCounter({ position, texture }: { position: [number, number, number]; texture: THREE.Texture }) {
  return (
    <group position={position}>
      <DecorBox position={[0, 0.75, 0]} args={[5, 1.5, 1.2]} color="#6d28d9" />
      <DecorBox position={[0, 1.55, 0]} args={[5.2, 0.14, 1.4]} color="#f0abfc" texture={texture} emissive="#f0abfc" emissiveIntensity={0.2} />
      {[-1.6, -0.8, 0, 0.8, 1.6].map((x, i) => <mesh key={x} position={[x, 1.85, 0]}><dodecahedronGeometry args={[0.22, 0]} /><meshStandardMaterial color={["#facc15", "#f472b6", "#22d3ee", "#a3e635", "#fb923c"][i]} emissive={["#facc15", "#f472b6", "#22d3ee", "#a3e635", "#fb923c"][i]} emissiveIntensity={0.25} /></mesh>)}
    </group>
  );
}

function StringLights({ from, to, color = "#fde68a", count = 10 }: { from: [number, number, number]; to: [number, number, number]; color?: string; count?: number }) {
  const points: [number, number, number][] = Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - Math.sin(t * Math.PI) * 0.65, from[2] + (to[2] - from[2]) * t];
  });
  return <group>{points.map((p, i) => <mesh key={i} position={p}><sphereGeometry args={[0.12, 7, 6]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} /></mesh>)}</group>;
}

function PatternPanel({ position, width = 2.4, height = 2.2, texture, color = "#ffffff", rotY = 0 }: { position: [number, number, number]; width?: number; height?: number; texture: THREE.Texture; color?: string; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <DecorBox position={[0, height / 2, 0]} args={[width, height, 0.16]} color={color} texture={texture} />
      <DecorBox position={[0, 0.08, 0]} args={[width + 0.2, 0.16, 0.6]} color="#475569" />
      <DecorBox position={[0, height, 0]} args={[width + 0.12, 0.12, 0.34]} color="#e2e8f0" />
    </group>
  );
}

function HangingCurtain({ position, width = 3.2, height = 2.6, texture, rotY = 0 }: { position: [number, number, number]; width?: number; height?: number; texture: THREE.Texture; rotY?: number }) {
  const strips = 6;
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <DecorBox position={[0, height + 0.1, 0]} args={[width + 0.4, 0.12, 0.18]} color="#334155" />
      {Array.from({ length: strips }, (_, i) => {
        const w = width / strips;
        return <DecorBox key={i} position={[-width / 2 + w * (i + 0.5), height / 2, Math.sin(i * 1.7) * 0.06]} args={[w - 0.05, height - (i % 2) * 0.22, 0.08]} color="#ffffff" texture={texture} />;
      })}
    </group>
  );
}

function ShelfWall({ position, texture, colors, rotY = 0, bays = 4 }: { position: [number, number, number]; texture: THREE.Texture; colors: string[]; rotY?: number; bays?: number }) {
  const width = bays * 1.3;
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <DecorBox position={[0, 1.3, -0.28]} args={[width, 2.6, 0.12]} color="#1e293b" texture={texture} />
      {[0.45, 1.25, 2.05].map((y) => <DecorBox key={y} position={[0, y, 0]} args={[width, 0.12, 0.8]} color="#64748b" />)}
      {Array.from({ length: bays }, (_, i) => (
        <group key={i} position={[-width / 2 + 0.65 + i * 1.3, 0, 0]}>
          <DecorBox position={[0, 0.7, 0]} args={[0.85, 0.45, 0.7]} color={colors[i % colors.length]} />
          <DecorBox position={[0.12, 1.5, -0.05]} args={[0.7, 0.55, 0.65]} color="#ffffff" texture={texture} />
          <DecorBox position={[-0.1, 2.3, 0.02]} args={[0.6, 0.4, 0.6]} color={colors[(i + 2) % colors.length]} />
        </group>
      ))}
    </group>
  );
}

function HideNook({ position, texture, accent, rotY = 0 }: { position: [number, number, number]; texture: THREE.Texture; accent: THREE.Texture; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Rug position={[0, 0.07, 0.15]} args={[4.4, 0.1, 3.4]} texture={texture} />
      <PatternPanel position={[0, 0, -1.65]} width={4.4} height={2.5} texture={texture} />
      <PatternPanel position={[-2.2, 0, 0]} width={3.2} height={2.1} texture={accent} rotY={Math.PI / 2} />
      <PatternPanel position={[2.2, 0, 0]} width={3.2} height={2.1} texture={accent} rotY={-Math.PI / 2} />
      <DecorBox position={[1.25, 0.36, 0.9]} args={[0.9, 0.72, 0.9]} color="#ffffff" texture={accent} rot={[0, 0.3, 0]} />
      <DecorBox position={[-1.1, 0.27, 0.75]} args={[0.7, 0.54, 0.7]} color="#ffffff" texture={texture} rot={[0, -0.4, 0]} />
    </group>
  );
}

function Ground({ size = 80, color = "#86a873", texture }: { size?: number; color?: string; texture?: THREE.Texture }) {
  const h = 1;
  return (
    <RigidBody type="fixed" colliders={false} position={[0, -h / 2, 0]}>
      <CuboidCollider args={[size / 2, h / 2, size / 2]} />
      <mesh receiveShadow>
        <boxGeometry args={[size, h, size]} />
        <meshStandardMaterial color={color} map={texture} roughness={0.95} />
      </mesh>
    </RigidBody>
  );
}

function Bounds({ s = 40, h = 5, color = "#8fa3b8" }: { s?: number; h?: number; color?: string }) {
  return (
    <>
      <BoxProp position={[0, h / 2, -s]} args={[s * 2, h, 1]} color={color} />
      <BoxProp position={[0, h / 2, s]} args={[s * 2, h, 1]} color={color} />
      <BoxProp position={[-s, h / 2, 0]} args={[1, h, s * 2]} color={color} />
      <BoxProp position={[s, h / 2, 0]} args={[1, h, s * 2]} color={color} />
    </>
  );
}

function MarketMap() {
  const ground = useMemo(() => makePattern("grass", "#86a873", "#4d7c0f", [16, 16]), []);
  const wood = useMemo(() => makePattern("wood", "#b45309", "#78350f"), []);
  const brick = useMemo(() => makePattern("brick", "#d6d3d1", "#a8a29e", [2, 1]), []);
  const fabricRed = useMemo(() => makePattern("fabric", "#dc2626", "#fef2f2", [3, 1]), []);
  const fabricBlue = useMemo(() => makePattern("fabric", "#2563eb", "#eff6ff", [3, 1]), []);
  const tile = useMemo(() => makePattern("tile", "#f1f5f9", "#94a3b8", [2, 2]), []);
  const mural = useMemo(() => makePattern("mural", "#1e293b", "#fb7185"), []);
  const metal = useMemo(() => makePattern("metal", "#94a3b8", "#475569"), []);
  const stripe = useMemo(() => makePattern("stripe", "#fef3c7", "#dc2626", [2, 1]), []);
  const dots = useMemo(() => makePattern("dots", "#e0f2fe", "#0284c7", [2, 2]), []);
  return <group>
    <Ground color="#ffffff" texture={ground} /><Bounds color="#8fa3b8" />
    <BoxProp position={[-15, 2, -10]} args={[1, 4, 20]} color="#ffffff" texture={brick} />
    <BoxProp position={[-5, 2, -20]} args={[20, 4, 1]} color="#ffffff" texture={brick} />
    <BoxProp position={[10, 2, 5]} args={[1, 4, 18]} color="#c7d2fe" />
    <BoxProp position={[18, 2, 14]} args={[16, 4, 1]} color="#c7d2fe" />
    <BoxProp position={[26, 2, 0]} args={[1, 4, 28]} color="#fde68a" />
    <BoxProp position={[-30, 2, 30]} args={[12, 4, 1]} color="#fca5a5" />
    <BoxProp position={[-36, 2, 25]} args={[1, 4, 10]} color="#fca5a5" />
    <BoxProp position={[-24, 2, 25]} args={[1, 4, 10]} color="#fca5a5" />
    <BoxProp position={[30, 0.25, -30]} args={[6, 0.5, 6]} color="#a7d8a5" />
    <BoxProp position={[20, 0.25, -25]} args={[4, 0.5, 4]} color="#a7d8a5" />
    <BoxProp position={[-10, 0.75, 10]} args={[1.5, 1.5, 1.5]} color="#ffffff" texture={wood} />
    <BoxProp position={[-8, 0.5, 12]} args={[1, 1, 1]} color="#ffffff" texture={wood} />
    <BoxProp position={[5, 1, -8]} args={[2, 2, 2]} color="#ffffff" texture={wood} />
    <BoxProp position={[15, 0.6, -12]} args={[1.2, 1.2, 1.2]} color="#0284c7" texture={metal} />
    <BoxProp position={[22, 1, 20]} args={[2, 2, 2]} color="#ffffff" texture={wood} />
    <BoxProp position={[-20, 0.75, -25]} args={[1.5, 1.5, 1.5]} color="#a78bfa" texture={mural} />
    <BoxProp position={[0, 0.5, 25]} args={[1, 1, 1]} color="#e5e7eb" />
    <BoxProp position={[12, 1.25, 28]} args={[2.5, 2.5, 2.5]} color="#64748b" />
    <BoxProp position={[-28, 0.8, -5]} args={[1.6, 1.6, 1.6]} color="#16a34a" />
    <BoxProp position={[32, 0.6, 10]} args={[1.2, 1.2, 1.2]} color="#db2777" />
    <BoxProp position={[-2, 1.2, -2]} args={[3, 2.4, 1.2]} color="#ffffff" texture={fabricRed} />
    <BoxProp position={[6, 1.2, 14]} args={[3, 2.4, 1.2]} color="#ffffff" texture={fabricBlue} />
    <BoxProp position={[-18, 1.0, 18]} args={[2.2, 2.0, 2.2]} color="#f97316" />
    <Ramp position={[0, 0.75, -5]} rotation={[-0.35, 0, 0]} size={[4, 0.4, 8]} color="#78716c" />
    <BoxProp position={[0, 1.5, -11]} args={[6, 0.5, 4]} color="#a8a29e" />
    <BoxProp position={[-25, 0.25, 0]} args={[4, 0.5, 2]} color="#94a3b8" />
    <BoxProp position={[-25, 0.75, -2]} args={[4, 0.5, 2]} color="#94a3b8" />
    <BoxProp position={[-25, 1.25, -4]} args={[4, 0.5, 2]} color="#94a3b8" />
    <BoxProp position={[-25, 1.5, -7]} args={[4, 0.5, 4]} color="#cbd5e1" />
    <BoxProp position={[20, 1.45, -5]} args={[6, 0.3, 6]} color="#7dd3fc" />
    <BoxProp position={[17.2, 0.725, -5]} args={[0.4, 1.45, 6]} color="#bae6fd" />
    <BoxProp position={[22.8, 0.725, -5]} args={[0.4, 1.45, 6]} color="#bae6fd" />
    <BoxProp position={[8, 0.15, 8]} args={[2, 0.3, 0.6]} color="#44403c" texture={metal} />
    <FabricAwning position={[-2, 0, -2]} width={4.2} depth={3} height={2.9} texture={fabricRed} />
    <FabricAwning position={[6, 0, 14]} width={4.2} depth={3} height={2.9} texture={fabricBlue} />
    <FabricAwning position={[-18, 0, 18]} width={3.6} depth={2.6} height={2.7} texture={fabricRed} rotY={0.5} />
    <Barrel position={[-12.4, 0.6, 11]} color="#ffffff" texture={wood} />
    <Barrel position={[-13.4, 0.6, 9]} color="#ffffff" texture={wood} />
    <Barrel position={[23.5, 0.6, 19]} color="#ffffff" texture={metal} />
    <FabricRoll position={[-25, 1.9, -2.4]} color="#ffffff" texture={fabricBlue} />
    <FabricRoll position={[-25, 2.4, -4.4]} color="#ffffff" texture={fabricRed} />
    <SignBoard position={[-14.3, 3.2, -8]} color="#f97316" texture={mural} rotY={Math.PI / 2} width={3.4} />
    <SignBoard position={[10.3, 3.2, 5]} color="#22c55e" texture={tile} rotY={-Math.PI / 2} width={3} />
    <Billboard position={[-4.8, 6, -20]} texture={mural} />
    <Rug position={[-6, 0.07, 18]} args={[5, 0.08, 4]} texture={tile} />
    <Rug position={[16, 0.07, 8]} args={[4, 0.08, 6]} texture={fabricBlue} rotY={0.4} />
    <Planter position={[-21, 0, 22]} />
    <Planter position={[21, 0, -16]} leafColor="#15803d" />
    <Planter position={[27, 0, 16]} potColor="#7c2d12" leafColor="#65a30d" />
    <Lantern position={[-16, 0, 20]} />
    <Lantern position={[16, 0, -18]} color="#fde68a" />
    <Atmosphere color="#fde68a" count={54} height={8} speed={0.35} size={0.06} />
    <CratePile position={[-9, 0, -14]} texture={wood} count={6} />
    <CratePile position={[24, 0, -14]} texture={wood} count={5} />
    <CratePile position={[-27, 0, 12]} texture={fabricRed} count={4} />
    <CratePile position={[8, 0, 22]} texture={metal} count={5} />
    <StreetCart position={[-20, 0, 5]} canopy={fabricRed} bodyColor="#fef3c7" rotY={0.6} />
    <StreetCart position={[4, 0, -16]} canopy={fabricBlue} bodyColor="#dbeafe" rotY={-0.2} />
    <StreetCart position={[26, 0, 24]} canopy={tile} bodyColor="#ede9fe" rotY={2.4} />
    <Bench position={[-18, 0, -20]} rotY={0.2} />
    <Bench position={[12, 0, 18]} rotY={-0.8} />
    <Bench position={[28, 0, -8]} rotY={1.4} />
    <StreetLamp position={[-28, 0, -14]} />
    <StreetLamp position={[28, 0, 8]} color="#fef08a" />
    <StreetLamp position={[-4, 0, 28]} />
    <StreetLamp position={[14, 0, -24]} color="#fef08a" />
    <TrafficCone position={[-3, 0, 7]} />
    <TrafficCone position={[2, 0, 9]} />
    <TrafficCone position={[19, 0, -12]} color="#fb923c" />
    <TrafficCone position={[24, 0, -9]} color="#fb923c" />
    <FenceLine position={[-30, 0, 8]} length={10} rotY={Math.PI / 2} color="#a16207" />
    <FenceLine position={[30, 0, -18]} length={8} rotY={Math.PI / 2} />
    <FenceLine position={[2, 0, -30]} length={12} color="#a16207" />
    <StringLights from={[-24, 4.2, 2]} to={[-6, 4.2, 2]} color="#fbbf24" count={9} />
    <StringLights from={[6, 4.4, 16]} to={[22, 4.4, 16]} color="#f472b6" count={9} />
    <StringLights from={[-4, 4.2, -18]} to={[14, 4.2, -18]} color="#67e8f9" count={9} />
    <FlowerPatch position={[-22, 0, 26]} />
    <FlowerPatch position={[24, 0, -26]} colors={["#fb7185", "#facc15", "#a78bfa"]} />
    <FlowerPatch position={[0, 0, 12]} colors={["#f472b6", "#fde047", "#38bdf8"]} />
    <Tree position={[-34, 0, -12]} scale={1.2} />
    <Tree position={[34, 0, 12]} leafColor="#65a30d" scale={1.1} />
    <HideNook position={[-30, 0, -16]} texture={fabricRed} accent={tile} rotY={0.4} />
    <HideNook position={[28, 0, 8]} texture={fabricBlue} accent={mural} rotY={-0.5} />
    <HideNook position={[0, 0, -28]} texture={tile} accent={fabricRed} rotY={0.1} />
    <ShelfWall position={[-24, 0, -8]} texture={wood} colors={["#f97316", "#22c55e", "#eab308", "#a855f7"]} rotY={0.5} bays={4} />
    <ShelfWall position={[18, 0, 26]} texture={metal} colors={["#38bdf8", "#fb7185", "#facc15"]} rotY={-0.4} bays={3} />
    <HangingCurtain position={[10, 0, 16]} texture={stripe} rotY={0.2} />
    <HangingCurtain position={[-18, 0, -2]} texture={dots} width={3.8} height={2.4} rotY={1.2} />
    <HangingCurtain position={[24, 0, -22]} texture={fabricRed} rotY={-0.6} />
    <CratePile position={[-12, 0, 24]} texture={dots} count={5} />
    <CratePile position={[28, 0, -2]} texture={stripe} count={5} />
    <StreetCart position={[-26, 0, -24]} canopy={dots} bodyColor="#fed7aa" rotY={-0.5} />
    <Bench position={[18, 0, -26]} rotY={0.7} color="#78350f" />
    <SignBoard position={[-20, 3.2, 8]} color="#22d3ee" texture={dots} rotY={Math.PI / 2} width={3} />
  </group>;
}

function WarehouseMap() {
  const concrete = useMemo(() => makePattern("stone", "#78716c", "#44403c", [16, 16]), []);
  const wood = useMemo(() => makePattern("wood", "#92400e", "#451a03"), []);
  const metal = useMemo(() => makePattern("metal", "#94a3b8", "#475569", [2, 1]), []);
  const hazard = useMemo(() => makePattern("fabric", "#f59e0b", "#1c1917", [4, 1]), []);
  const stripe = useMemo(() => makePattern("stripe", "#fef08a", "#1c1917", [2, 1]), []);
  const dots = useMemo(() => makePattern("dots", "#334155", "#22d3ee", [2, 2]), []);
  return <group>
    <Ground color="#ffffff" texture={concrete} /><Bounds color="#475569" />
    <BoxProp position={[-18, 1.5, -12]} args={[6, 3, 6]} color="#ffffff" texture={wood} />
    <BoxProp position={[-18, 3.5, -12]} args={[4, 1, 4]} color="#ffffff" texture={wood} />
    <BoxProp position={[18, 1.25, -10]} args={[5, 2.5, 5]} color="#ffffff" texture={wood} />
    <BoxProp position={[18, 3.0, -10]} args={[3, 1, 3]} color="#ffffff" texture={wood} />
    <BoxProp position={[-6, 1, 6]} args={[4, 2, 4]} color="#ffffff" texture={wood} />
    <BoxProp position={[6, 0.75, 10]} args={[3, 1.5, 3]} color="#ffffff" texture={wood} />
    <BoxProp position={[0, 1.5, -22]} args={[10, 3, 2]} color="#334155" />
    <BoxProp position={[0, 1.5, 22]} args={[10, 3, 2]} color="#334155" />
    <BoxProp position={[-28, 2, 0]} args={[2, 4, 14]} color="#475569" />
    <BoxProp position={[28, 2, 0]} args={[2, 4, 14]} color="#475569" />
    <BoxProp position={[0, 0.2, 0]} args={[10, 0.4, 2.4]} color="#ffffff" texture={hazard} />
    <BoxProp position={[0, 0.2, -3]} args={[10, 0.4, 2.4]} color="#ffffff" texture={hazard} />
    <BoxProp position={[0, 0.2, 3]} args={[10, 0.4, 2.4]} color="#ffffff" texture={hazard} />
    <BoxProp position={[-12, 0.75, 20]} args={[2, 1.5, 2]} color="#0284c7" />
    <BoxProp position={[12, 0.75, 20]} args={[2, 1.5, 2]} color="#0284c7" />
    <BoxProp position={[-24, 0.5, 16]} args={[3, 1, 1.2]} color="#94a3b8" />
    <BoxProp position={[24, 0.5, 16]} args={[3, 1, 1.2]} color="#94a3b8" />
    <BoxProp position={[-10, 2.2, -2]} args={[8, 0.4, 3]} color="#64748b" />
    <BoxProp position={[-13.8, 1.1, -2]} args={[0.4, 2.2, 3]} color="#475569" />
    <BoxProp position={[-6.2, 1.1, -2]} args={[0.4, 2.2, 3]} color="#475569" />
    <Ramp position={[10, 0.8, -6]} rotation={[-0.3, 0, 0]} size={[3, 0.4, 6]} color="#525252" />
    <BoxProp position={[10, 1.6, -12]} args={[4, 0.4, 4]} color="#737373" />
    <BoxProp position={[20, 1.4, 8]} args={[6, 0.3, 5]} color="#94a3b8" />
    <BoxProp position={[17.2, 0.7, 8]} args={[0.4, 1.4, 5]} color="#64748b" />
    <BoxProp position={[22.8, 0.7, 8]} args={[0.4, 1.4, 5]} color="#64748b" />
    <BoxProp position={[-30, 2, 30]} args={[10, 4, 1]} color="#ffffff" texture={metal} />
    <BoxProp position={[-35, 2, 25]} args={[1, 4, 10]} color="#ffffff" texture={metal} />
    <BoxProp position={[-25, 2, 25]} args={[1, 4, 10]} color="#ffffff" texture={metal} />
    <Barrel position={[-15.5, 0.6, -8]} color="#0284c7" texture={metal} />
    <Barrel position={[-14.2, 0.6, -9]} color="#b91c1c" texture={metal} />
    <Barrel position={[20, 0.6, -8]} color="#f59e0b" texture={metal} />
    <Barrel position={[10.5, 0.6, 23]} color="#166534" texture={metal} />
    <FabricRoll position={[-6, 2.45, -2]} color="#ffffff" texture={hazard} />
    <FabricRoll position={[20, 1.6, 8]} color="#ffffff" texture={metal} />
    <SignBoard position={[0, 3.4, -20.8]} color="#ef4444" texture={hazard} width={4.5} />
    <SignBoard position={[-27, 3.4, 0]} color="#38bdf8" texture={metal} rotY={Math.PI / 2} width={3.2} />
    <Vent position={[10, 1.8, -12]} />
    <Vent position={[-10, 1.3, -22]} rotY={Math.PI} />
    <Lantern position={[-24, 0, 22]} color="#fde68a" />
    <Lantern position={[24, 0, -22]} />
    <Rug position={[0, 0.42, -3]} args={[10, 0.08, 2.4]} texture={metal} />
    <Atmosphere color="#cbd5e1" count={72} height={10} speed={0.28} size={0.05} opacity={0.4} />
    <PalletStack position={[-22, 0, -4]} texture={wood} levels={4} />
    <PalletStack position={[22, 0, 4]} texture={wood} levels={3} />
    <PalletStack position={[-8, 0, 22]} texture={metal} levels={3} />
    <PalletStack position={[14, 0, -20]} texture={wood} levels={4} />
    <PalletStack position={[26, 0, 24]} texture={hazard} levels={2} />
    <Forklift position={[-4, 0, 16]} rotY={-0.5} />
    <Forklift position={[16, 0, -4]} color="#facc15" rotY={2.2} />
    <Dumpster position={[-30, 0, -22]} color="#1d4ed8" rotY={0.5} />
    <Dumpster position={[30, 0, 22]} color="#166534" rotY={-0.5} />
    <Dumpster position={[26, 0, -26]} color="#b91c1c" rotY={2.6} />
    <WaterTank position={[-32, 0, 6]} color="#64748b" />
    <CratePile position={[10, 0, 26]} texture={wood} count={6} />
    <CratePile position={[-18, 0, 26]} texture={metal} count={5} />
    <StreetLamp position={[-28, 0, -10]} color="#fef08a" height={5.2} />
    <StreetLamp position={[28, 0, 10]} color="#fef08a" height={5.2} />
    <FenceLine position={[-20, 0, -30]} length={14} color="#64748b" />
    <FenceLine position={[20, 0, 30]} length={14} rotY={0} color="#64748b" />
    <TrafficCone position={[-2, 0, -12]} />
    <TrafficCone position={[2, 0, -12]} />
    <TrafficCone position={[-9, 0, 18]} />
    <TrafficCone position={[9, 0, 18]} />
    <StringLights from={[-26, 5, -6]} to={[-6, 5, -6]} color="#fde047" count={11} />
    <StringLights from={[6, 5, 12]} to={[26, 5, 12]} color="#fbbf24" count={11} />
    <HideNook position={[-30, 0, -8]} texture={hazard} accent={metal} rotY={0.5} />
    <HideNook position={[30, 0, 8]} texture={metal} accent={stripe} rotY={-0.5} />
    <HideNook position={[0, 0, -30]} texture={stripe} accent={hazard} rotY={0} />
    <ShelfWall position={[-20, 0, 12]} texture={wood} colors={["#0284c7", "#b91c1c", "#f59e0b"]} rotY={0.3} bays={5} />
    <ShelfWall position={[20, 0, -12]} texture={metal} colors={["#166534", "#facc15", "#475569"]} rotY={-0.3} bays={5} />
    <HangingCurtain position={[-10, 0, -26]} texture={stripe} width={4.2} height={2.8} />
    <HangingCurtain position={[10, 0, 26]} texture={dots} width={4.2} height={2.8} rotY={Math.PI} />
    <CratePile position={[-16, 0, 24]} texture={stripe} count={6} />
    <CratePile position={[16, 0, -24]} texture={dots} count={6} />
    <PalletStack position={[-28, 0, -24]} texture={stripe} levels={4} />
    <PalletStack position={[28, 0, 24]} texture={metal} levels={4} />
    <Forklift position={[0, 0, -26]} color="#f97316" rotY={Math.PI / 2} />
    <Dumpster position={[-30, 0, 0]} color="#1e3a8a" rotY={Math.PI / 2} />
  </group>;
}

function RooftopsMap() {
  const concrete = useMemo(() => makePattern("stone", "#64748b", "#475569", [16, 16]), []);
  const metal = useMemo(() => makePattern("metal", "#94a3b8", "#475569", [2, 1]), []);
  const tile = useMemo(() => makePattern("tile", "#cbd5e1", "#64748b", [2, 2]), []);
  const mural = useMemo(() => makePattern("mural", "#1e293b", "#fbbf24"), []);
  const stripe = useMemo(() => makePattern("stripe", "#e2e8f0", "#f97316", [2, 1]), []);
  const dots = useMemo(() => makePattern("dots", "#334155", "#38bdf8", [2, 2]), []);
  return <group>
    <Ground color="#ffffff" texture={concrete} /><Bounds s={40} h={2} color="#334155" />
    <BoxProp position={[-18, 1.5, -12]} args={[16, 3, 14]} color="#475569" />
    <BoxProp position={[16, 1.0, -14]} args={[14, 2, 12]} color="#64748b" />
    <BoxProp position={[0, 0.75, 8]} args={[18, 1.5, 14]} color="#475569" />
    <BoxProp position={[-22, 0.5, 18]} args={[10, 1, 10]} color="#334155" />
    <BoxProp position={[22, 0.5, 18]} args={[10, 1, 10]} color="#334155" />
    <BoxProp position={[-18, 3.6, -12]} args={[2, 1.2, 2]} color="#94a3b8" />
    <BoxProp position={[16, 2.6, -14]} args={[2.4, 1.2, 1.2]} color="#0ea5e9" />
    <BoxProp position={[0, 2.1, 8]} args={[3, 1.2, 1]} color="#f97316" />
    <BoxProp position={[4, 2.1, 8]} args={[3, 1.2, 1]} color="#22c55e" />
    <BoxProp position={[-8, 0.4, 24]} args={[4, 0.8, 4]} color="#1e293b" />
    <BoxProp position={[8, 0.4, 24]} args={[4, 0.8, 4]} color="#1e293b" />
    <Ramp position={[-8, 1.2, -2]} rotation={[-0.32, Math.PI/2, 0]} size={[3, 0.4, 7]} color="#78716c" />
    <Ramp position={[8, 0.9, -2]} rotation={[-0.28, -Math.PI/2, 0]} size={[3, 0.4, 6]} color="#78716c" />
    <BoxProp position={[0, 1.7, -22]} args={[8, 0.4, 4]} color="#94a3b8" />
    <BoxProp position={[-20, 2.2, 10]} args={[1, 4.4, 6]} color="#475569" />
    <BoxProp position={[20, 2.2, 10]} args={[1, 4.4, 6]} color="#475569" />
    <BoxProp position={[0, 2.5, 0]} args={[1.2, 5, 1.2]} color="#94a3b8" />
    <BoxProp position={[0, 5.2, 0]} args={[5, 0.4, 3]} color="#cbd5e1" />
    <BoxProp position={[24, 0.8, -2]} args={[2, 1.6, 2]} color="#eab308" />
    <BoxProp position={[-24, 0.8, -2]} args={[2, 1.6, 2]} color="#eab308" />
    <BoxProp position={[0, 1.45, 15]} args={[6, 0.3, 5]} color="#7dd3fc" />
    <BoxProp position={[-2.8, 0.725, 15]} args={[0.4, 1.45, 5]} color="#bae6fd" />
    <BoxProp position={[2.8, 0.725, 15]} args={[0.4, 1.45, 5]} color="#bae6fd" />
    <BoxProp position={[-30, 3, 30]} args={[10, 2, 1]} color="#ffffff" texture={metal} />
    <BoxProp position={[-35, 3, 25]} args={[1, 2, 10]} color="#ffffff" texture={metal} />
    <BoxProp position={[-25, 3, 25]} args={[1, 2, 10]} color="#ffffff" texture={metal} />
    <Billboard position={[-18, 5.8, -18.8]} texture={mural} />
    <Billboard position={[16, 4.8, -20]} texture={tile} rotY={-0.25} />
    <Vent position={[-18, 3.8, -12]} />
    <Vent position={[16, 2.8, -14]} rotY={Math.PI / 2} />
    <Vent position={[0, 2.9, 8]} rotY={Math.PI} />
    <SignBoard position={[-20, 5, 10]} color="#f97316" texture={mural} rotY={Math.PI / 2} width={3} />
    <Lantern position={[-24, 0, 22]} />
    <Lantern position={[24, 0, -22]} color="#fde68a" />
    <Rug position={[0, 1.61, -22]} args={[8, 0.08, 4]} texture={tile} />
    <Atmosphere color="#fef3c7" count={62} area={76} height={16} speed={0.45} size={0.055} opacity={0.48} />
    <WaterTank position={[-26, 0, -8]} color="#64748b" />
    <WaterTank position={[26, 0, 8]} color="#94a3b8" />
    <WaterTank position={[0, 0, -28]} color="#475569" />
    <SatelliteDish position={[-18, 4.2, -12]} />
    <SatelliteDish position={[16, 2.8, -14]} color="#cbd5e1" />
    <SatelliteDish position={[0, 1.6, 8]} color="#f8fafc" />
    <Vent position={[-24, 1, 18]} rotY={0.4} />
    <Vent position={[24, 1, -18]} rotY={2.2} />
    <Vent position={[-8, 1, 24]} rotY={Math.PI / 2} />
    <CratePile position={[-26, 0, 18]} texture={metal} count={5} />
    <CratePile position={[26, 0, -18]} texture={tile} count={5} />
    <StreetLamp position={[-30, 0, 0]} color="#fbbf24" height={5.6} />
    <StreetLamp position={[30, 0, 0]} color="#fbbf24" height={5.6} />
    <FenceLine position={[-30, 0, 16]} length={12} rotY={Math.PI / 2} color="#475569" />
    <FenceLine position={[30, 0, -16]} length={12} rotY={Math.PI / 2} color="#475569" />
    <StringLights from={[-22, 5.4, -6]} to={[22, 5.4, -6]} color="#fbbf24" count={13} />
    <StringLights from={[-20, 5.2, 20]} to={[20, 5.2, 20]} color="#f472b6" count={13} />
    <TrafficCone position={[-6, 0, 12]} />
    <TrafficCone position={[6, 0, 12]} />
    <TrafficCone position={[-14, 0, -20]} />
    <TrafficCone position={[14, 0, -20]} />
    <HideNook position={[-28, 0, -10]} texture={metal} accent={dots} rotY={0.5} />
    <HideNook position={[28, 0, 10]} texture={stripe} accent={tile} rotY={-0.5} />
    <HideNook position={[0, 0, -28]} texture={dots} accent={mural} rotY={0} />
    <ShelfWall position={[-18, 0, 18]} texture={metal} colors={["#0ea5e9", "#f97316", "#22c55e"]} rotY={0.4} bays={4} />
    <ShelfWall position={[18, 0, -20]} texture={tile} colors={["#eab308", "#38bdf8", "#ef4444"]} rotY={-0.4} bays={4} />
    <HangingCurtain position={[-10, 0, -26]} texture={stripe} width={4} height={2.4} rotY={0.2} />
    <HangingCurtain position={[10, 0, 26]} texture={dots} width={4} height={2.4} rotY={Math.PI - 0.2} />
    <CratePile position={[-24, 0, 24]} texture={stripe} count={5} />
    <CratePile position={[24, 0, -24]} texture={dots} count={5} />
    <WaterTank position={[-34, 0, 0]} color="#f59e0b" />
    <WaterTank position={[34, 0, 0]} color="#38bdf8" />
    <SatelliteDish position={[-16, 0, -24]} color="#e2e8f0" />
    <SatelliteDish position={[16, 0, 24]} color="#fbbf24" />
  </group>;
}

function GardenMap() {
  const grass = useMemo(() => makePattern("grass", "#4d7c0f", "#a3e635", [16, 16]), []);
  const hedge = useMemo(() => makePattern("grass", "#166534", "#4ade80", [3, 1]), []);
  const wood = useMemo(() => makePattern("wood", "#92400e", "#451a03"), []);
  const stone = useMemo(() => makePattern("stone", "#a8a29e", "#57534e", [2, 1]), []);
  const tile = useMemo(() => makePattern("tile", "#d9f99d", "#4d7c0f", [2, 2]), []);
  const stripe = useMemo(() => makePattern("stripe", "#ecfccb", "#15803d", [2, 1]), []);
  const dots = useMemo(() => makePattern("dots", "#fef9c3", "#e11d48", [2, 2]), []);
  return <group>
    <Ground color="#ffffff" texture={grass} /><Bounds color="#65a30d" />
    <BoxProp position={[-14, 0.9, -10]} args={[8, 1.8, 2]} color="#ffffff" texture={hedge} />
    <BoxProp position={[14, 0.9, -10]} args={[8, 1.8, 2]} color="#ffffff" texture={hedge} />
    <BoxProp position={[-14, 0.9, 10]} args={[8, 1.8, 2]} color="#ffffff" texture={hedge} />
    <BoxProp position={[14, 0.9, 10]} args={[8, 1.8, 2]} color="#ffffff" texture={hedge} />
    <BoxProp position={[0, 0.7, 0]} args={[2.5, 1.4, 2.5]} color="#ffffff" texture={stone} />
    <BoxProp position={[0, 1.6, 0]} args={[1.2, 0.4, 1.2]} color="#ffffff" texture={stone} />
    <BoxProp position={[-24, 0.5, -18]} args={[4, 1, 4]} color="#ffffff" texture={wood} />
    <BoxProp position={[24, 0.5, -18]} args={[4, 1, 4]} color="#ffffff" texture={wood} />
    <BoxProp position={[-24, 0.5, 18]} args={[4, 1, 4]} color="#ffffff" texture={wood} />
    <BoxProp position={[24, 0.5, 18]} args={[4, 1, 4]} color="#ffffff" texture={wood} />
    <BoxProp position={[-6, 0.4, -20]} args={[3, 0.8, 1.5]} color="#d97706" />
    <BoxProp position={[6, 0.4, -20]} args={[3, 0.8, 1.5]} color="#d97706" />
    <BoxProp position={[-6, 0.4, 20]} args={[3, 0.8, 1.5]} color="#ca8a04" />
    <BoxProp position={[6, 0.4, 20]} args={[3, 0.8, 1.5]} color="#ca8a04" />
    <BoxProp position={[-20, 0.6, 0]} args={[2, 1.2, 2]} color="#65a30d" />
    <BoxProp position={[20, 0.6, 0]} args={[2, 1.2, 2]} color="#65a30d" />
    <BoxProp position={[0, 0.3, -8]} args={[6, 0.6, 2]} color="#84cc16" />
    <BoxProp position={[0, 0.3, 8]} args={[6, 0.6, 2]} color="#84cc16" />
    <BoxProp position={[10, 1.0, 24]} args={[5, 2, 1.2]} color="#166534" />
    <BoxProp position={[-10, 1.0, 24]} args={[5, 2, 1.2]} color="#166534" />
    <Ramp position={[-8, 0.6, -2]} rotation={[-0.25, 0, 0]} size={[3, 0.4, 5]} color="#78716c" />
    <BoxProp position={[-8, 1.2, -6]} args={[3.5, 0.4, 3]} color="#a8a29e" />
    <BoxProp position={[18, 1.45, 4]} args={[5, 0.3, 5]} color="#86efac" />
    <BoxProp position={[15.7, 0.725, 4]} args={[0.4, 1.45, 5]} color="#4ade80" />
    <BoxProp position={[20.3, 0.725, 4]} args={[0.4, 1.45, 5]} color="#4ade80" />
    <BoxProp position={[-30, 2, 30]} args={[10, 4, 1]} color="#ffffff" texture={tile} />
    <BoxProp position={[-35, 2, 25]} args={[1, 4, 10]} color="#ffffff" texture={tile} />
    <BoxProp position={[-25, 2, 25]} args={[1, 4, 10]} color="#ffffff" texture={tile} />
    <Planter position={[-6, 0, -16]} />
    <Planter position={[6, 0, -16]} leafColor="#22c55e" />
    <Planter position={[-6, 0, 16]} potColor="#78350f" leafColor="#a3e635" />
    <Planter position={[6, 0, 16]} leafColor="#15803d" />
    <Planter position={[-18, 0, 0]} potColor="#78716c" leafColor="#4ade80" />
    <Planter position={[18, 0, 0]} potColor="#78716c" leafColor="#65a30d" />
    <Barrel position={[-22.5, 0.6, -16]} color="#ffffff" texture={wood} />
    <Barrel position={[22.5, 0.6, 16]} color="#ffffff" texture={wood} />
    <Rug position={[0, 0.07, 8]} args={[6, 0.08, 2]} texture={tile} />
    <Lantern position={[-20, 0, 20]} color="#fde68a" />
    <Lantern position={[20, 0, -20]} />
    <Atmosphere color="#bef264" count={66} height={7} speed={0.3} size={0.055} opacity={0.7} />
    <Tree position={[-30, 0, -10]} scale={1.25} />
    <Tree position={[30, 0, -10]} leafColor="#4ade80" scale={1.2} />
    <Tree position={[-30, 0, 12]} leafColor="#15803d" scale={1.3} />
    <Tree position={[30, 0, 12]} scale={1.15} />
    <Tree position={[0, 0, -30]} leafColor="#65a30d" scale={1.35} />
    <Tree position={[0, 0, 30]} scale={1.2} />
    <FlowerPatch position={[-12, 0, -20]} />
    <FlowerPatch position={[12, 0, -20]} colors={["#fb7185", "#fde047", "#c084fc"]} />
    <FlowerPatch position={[-12, 0, 20]} colors={["#f472b6", "#facc15", "#38bdf8"]} />
    <FlowerPatch position={[12, 0, 20]} />
    <FlowerPatch position={[0, 0, -14]} colors={["#a3e635", "#f472b6", "#fde047"]} />
    <Gazebo position={[0, 0, 24]} roofColor="#16a34a" />
    <Pond position={[-22, 0, -22]} />
    <Bench position={[-24, 0, -12]} rotY={1.2} />
    <Bench position={[24, 0, 12]} rotY={-1.2} />
    <Bench position={[8, 0, -24]} rotY={0.3} color="#a16207" />
    <FenceLine position={[-26, 0, 26]} length={14} color="#a16207" />
    <FenceLine position={[26, 0, -26]} length={14} color="#a16207" />
    <FenceLine position={[0, 0, -34]} length={18} color="#92400e" />
    <StreetLamp position={[-28, 0, 0]} color="#fde68a" height={3.8} />
    <StreetLamp position={[28, 0, 0]} color="#fde68a" height={3.8} />
    <StringLights from={[-18, 4, 18]} to={[18, 4, 18]} color="#fde68a" count={13} />
    <StringLights from={[-16, 4, -18]} to={[16, 4, -18]} color="#a3e635" count={13} />
    <CratePile position={[-22, 0, 18]} texture={wood} count={5} />
    <CratePile position={[22, 0, -18]} texture={stone} count={5} />
    <HideNook position={[-28, 0, -10]} texture={hedge} accent={tile} rotY={0.5} />
    <HideNook position={[28, 0, 10]} texture={stripe} accent={wood} rotY={-0.5} />
    <HideNook position={[0, 0, -28]} texture={dots} accent={hedge} rotY={0} />
    <ShelfWall position={[-20, 0, 16]} texture={wood} colors={["#facc15", "#22c55e", "#f97316"]} rotY={0.4} bays={4} />
    <ShelfWall position={[20, 0, -16]} texture={stone} colors={["#38bdf8", "#fb7185", "#a3e635"]} rotY={-0.4} bays={4} />
    <HangingCurtain position={[-12, 0, -26]} texture={stripe} width={4} height={2.3} rotY={0.2} />
    <HangingCurtain position={[12, 0, 26]} texture={dots} width={4} height={2.3} rotY={Math.PI - 0.2} />
    <CratePile position={[-26, 0, 24]} texture={stripe} count={5} />
    <CratePile position={[26, 0, -24]} texture={dots} count={5} />
    <Gazebo position={[-20, 0, -24]} roofColor="#e11d48" />
    <Pond position={[22, 0, 22]} />
    <FlowerPatch position={[-16, 0, 4]} colors={["#a3e635", "#f472b6", "#fde047"]} />
    <FlowerPatch position={[16, 0, -4]} />
  </group>;
}

function ArcadeMap() {
  const floor = useMemo(() => makePattern("tile", "#1e293b", "#6366f1", [16, 16]), []);
  const neon = useMemo(() => makePattern("neon", "#0f172a", "#22d3ee", [2, 2]), []);
  const mural = useMemo(() => makePattern("mural", "#1e1b4b", "#f472b6"), []);
  const metal = useMemo(() => makePattern("metal", "#475569", "#22d3ee"), []);
  const stripe = useMemo(() => makePattern("stripe", "#1e1b4b", "#f0abfc", [2, 1]), []);
  const dots = useMemo(() => makePattern("dots", "#172554", "#22d3ee", [2, 2]), []);
  return <group>
    <Ground color="#ffffff" texture={floor} /><Bounds color="#6366f1" />
    <BoxProp position={[-12, 1, -8]} args={[2.5, 2, 2]} color="#ffffff" texture={mural} emissive="#ec4899" emissiveIntensity={0.3} />
    <BoxProp position={[-8, 1, -8]} args={[2.5, 2, 2]} color="#ffffff" texture={neon} emissive="#8b5cf6" emissiveIntensity={0.35} />
    <BoxProp position={[-4, 1, -8]} args={[2.5, 2, 2]} color="#ffffff" texture={neon} emissive="#06b6d4" emissiveIntensity={0.35} />
    <BoxProp position={[12, 1, -8]} args={[2.5, 2, 2]} color="#ffffff" texture={mural} emissive="#f59e0b" emissiveIntensity={0.3} />
    <BoxProp position={[8, 1, -8]} args={[2.5, 2, 2]} color="#ffffff" texture={neon} emissive="#22c55e" emissiveIntensity={0.35} />
    <BoxProp position={[4, 1, -8]} args={[2.5, 2, 2]} color="#ffffff" texture={mural} emissive="#ef4444" emissiveIntensity={0.3} />
    <BoxProp position={[-18, 1.2, 10]} args={[3, 2.4, 1.2]} color="#3b82f6" />
    <BoxProp position={[18, 1.2, 10]} args={[3, 2.4, 1.2]} color="#e11d48" />
    <BoxProp position={[0, 1.2, 18]} args={[3, 2.4, 1.2]} color="#a855f7" />
    <BoxProp position={[0, 0.5, 0]} args={[6, 1, 6]} color="#ffffff" texture={metal} />
    <BoxProp position={[0, 1.6, 0]} args={[1, 1.2, 1]} color="#facc15" />
    <BoxProp position={[-24, 1.5, -18]} args={[2, 3, 2]} color="#0ea5e9" />
    <BoxProp position={[24, 1.5, -18]} args={[2, 3, 2]} color="#0ea5e9" />
    <BoxProp position={[-24, 1.5, 18]} args={[2, 3, 2]} color="#f43f5e" />
    <BoxProp position={[24, 1.5, 18]} args={[2, 3, 2]} color="#f43f5e" />
    <BoxProp position={[-10, 0.4, 22]} args={[4, 0.8, 2]} color="#64748b" />
    <BoxProp position={[10, 0.4, 22]} args={[4, 0.8, 2]} color="#64748b" />
    <BoxProp position={[-28, 2, 4]} args={[1, 4, 12]} color="#4f46e5" />
    <BoxProp position={[28, 2, 4]} args={[1, 4, 12]} color="#4f46e5" />
    <Ramp position={[-14, 0.7, -2]} rotation={[-0.3, 0, 0]} size={[3, 0.4, 5]} color="#475569" />
    <BoxProp position={[-14, 1.4, -6]} args={[4, 0.4, 3]} color="#64748b" />
    <BoxProp position={[14, 1.45, 4]} args={[5, 0.3, 5]} color="#22d3ee" />
    <BoxProp position={[11.7, 0.725, 4]} args={[0.4, 1.45, 5]} color="#0891b2" />
    <BoxProp position={[16.3, 0.725, 4]} args={[0.4, 1.45, 5]} color="#0891b2" />
    <BoxProp position={[0, 0.2, 10]} args={[8, 0.4, 1.2]} color="#84cc16" />
    <BoxProp position={[0, 0.2, 12]} args={[8, 0.4, 1.2]} color="#84cc16" />
    <BoxProp position={[-30, 2, 30]} args={[10, 4, 1]} color="#ffffff" texture={neon} emissive="#f472b6" emissiveIntensity={0.4} />
    <BoxProp position={[-35, 2, 25]} args={[1, 4, 10]} color="#ffffff" texture={neon} emissive="#22d3ee" emissiveIntensity={0.4} />
    <BoxProp position={[-25, 2, 25]} args={[1, 4, 10]} color="#ffffff" texture={neon} emissive="#a78bfa" emissiveIntensity={0.4} />
    <Billboard position={[0, 5.2, -20.8]} texture={mural} />
    <Billboard position={[-20, 4.6, 24]} texture={neon} rotY={Math.PI} />
    <SignBoard position={[-28, 3.4, 4]} color="#22d3ee" texture={neon} rotY={Math.PI / 2} width={3.5} />
    <SignBoard position={[28, 3.4, 4]} color="#f472b6" texture={mural} rotY={-Math.PI / 2} width={3.5} />
    <Vent position={[-24, 1.8, -18]} />
    <Vent position={[24, 1.8, 18]} rotY={Math.PI} />
    <Lantern position={[-22, 0, -22]} color="#f472b6" />
    <Lantern position={[22, 0, 22]} color="#22d3ee" />
    <Rug position={[0, 0.41, 10]} args={[8, 0.08, 1.2]} texture={neon} />
    <Atmosphere color="#67e8f9" count={74} height={9} speed={0.55} size={0.055} opacity={0.7} />
    <Atmosphere color="#f472b6" count={48} area={58} height={7} speed={0.42} size={0.05} opacity={0.6} />
    <NeonCabinet position={[-28, 0, -8]} color="#22d3ee" texture={neon} />
    <NeonCabinet position={[-28, 0, -4]} color="#f472b6" texture={mural} />
    <NeonCabinet position={[-28, 0, 0]} color="#a78bfa" texture={metal} />
    <NeonCabinet position={[28, 0, -8]} color="#facc15" texture={mural} />
    <NeonCabinet position={[28, 0, -4]} color="#34d399" texture={neon} />
    <NeonCabinet position={[28, 0, 0]} color="#fb7185" texture={metal} />
    <NeonCabinet position={[-8, 0, 28]} color="#38bdf8" texture={neon} />
    <NeonCabinet position={[8, 0, 28]} color="#c084fc" texture={mural} />
    <NeonArch position={[0, 0, -16]} color="#f472b6" width={9} height={4.2} />
    <NeonArch position={[0, 0, 16]} color="#22d3ee" width={9} height={4.2} />
    <NeonArch position={[-20, 0, 0]} color="#a78bfa" width={6} height={3.4} rotY={0} />
    <Jukebox position={[-6, 0, 20]} color="#f472b6" />
    <Jukebox position={[6, 0, 20]} color="#22d3ee" />
    <PrizeCounter position={[0, 0, -26]} texture={neon} />
    <StreetLamp position={[-30, 0, 14]} color="#f472b6" height={5} />
    <StreetLamp position={[30, 0, -14]} color="#22d3ee" height={5} />
    <FenceLine position={[-20, 0, -30]} length={14} color="#4f46e5" />
    <FenceLine position={[20, 0, 30]} length={14} color="#4f46e5" />
    <StringLights from={[-26, 5, -18]} to={[26, 5, -18]} color="#22d3ee" count={15} />
    <StringLights from={[-26, 5, 18]} to={[26, 5, 18]} color="#f472b6" count={15} />
    <StringLights from={[0, 5, -26]} to={[0, 5, 26]} color="#a78bfa" count={15} />
    <Dumpster position={[-26, 0, 14]} color="#4338ca" rotY={0.6} />
    <Dumpster position={[26, 0, -14]} color="#7e22ce" rotY={-0.6} />
    <TrafficCone position={[-10, 0, 8]} color="#22d3ee" />
    <TrafficCone position={[10, 0, 8]} color="#f472b6" />
    <HideNook position={[-28, 0, -10]} texture={neon} accent={dots} rotY={0.5} />
    <HideNook position={[28, 0, 10]} texture={stripe} accent={metal} rotY={-0.5} />
    <HideNook position={[0, 0, -28]} texture={dots} accent={mural} rotY={0} />
    <ShelfWall position={[-20, 0, 16]} texture={metal} colors={["#22d3ee", "#f472b6", "#a78bfa"]} rotY={0.4} bays={4} />
    <ShelfWall position={[20, 0, -16]} texture={neon} colors={["#facc15", "#34d399", "#fb7185"]} rotY={-0.4} bays={4} />
    <HangingCurtain position={[-12, 0, -26]} texture={stripe} width={4} height={2.5} rotY={0.2} />
    <HangingCurtain position={[12, 0, 26]} texture={dots} width={4} height={2.5} rotY={Math.PI - 0.2} />
    <CratePile position={[-26, 0, 24]} texture={stripe} count={5} />
    <CratePile position={[26, 0, -24]} texture={dots} count={5} />
    <NeonCabinet position={[-16, 0, -24]} color="#f0abfc" texture={stripe} />
    <NeonCabinet position={[16, 0, 24]} color="#22d3ee" texture={dots} />
    <Jukebox position={[-20, 0, 8]} color="#a78bfa" />
    <PrizeCounter position={[20, 0, -8]} texture={dots} />
  </group>;
}

export function ArenaMap({ mapId }: { mapId?: string | null }) {
  const id = (mapId as MapId) || "market";
  const Comp = useMemo(() => {
    switch (id) {
      case "warehouse": return WarehouseMap;
      case "rooftops": return RooftopsMap;
      case "garden": return GardenMap;
      case "arcade": return ArcadeMap;
      case "market":
      default: return MarketMap;
    }
  }, [id]);
  return <Comp />;
}

// Back-compat export
export function GreyboxMap() { return <ArenaMap mapId="market" />; }
