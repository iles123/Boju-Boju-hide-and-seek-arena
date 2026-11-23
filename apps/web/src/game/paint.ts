import * as THREE from "three";

export type PoseId =
  | "stand" | "lean_wall" | "crouch_ball" | "flat_floor" | "arms_up" | "side_profile"
  | "hug_pillar" | "t_pose" | "sit" | "kneel" | "peek_low" | "stretch" | "crate_huddle" | "wall_press";

export type PoseDef = {
  id: PoseId;
  label: string;
  key?: string;
  halfH: number;
  radius: number;
  eye: number;
  speedMul: number;
  canJump: boolean;
  camoShape: "stand" | "crouch" | "prone" | "tuck" | "wide" | "lean";
};

export const POSES: PoseDef[] = [
  { id: "stand", label: "Stand", key: "1", halfH: 0.6, radius: 0.35, eye: 1.6, speedMul: 1, canJump: true, camoShape: "stand" },
  { id: "lean_wall", label: "Lean Wall", key: "2", halfH: 0.58, radius: 0.34, eye: 1.55, speedMul: 0.9, canJump: true, camoShape: "lean" },
  { id: "crouch_ball", label: "Crouch Ball", key: "3", halfH: 0.28, radius: 0.38, eye: 0.95, speedMul: 0.5, canJump: false, camoShape: "crouch" },
  { id: "flat_floor", label: "Flat Floor", key: "4", halfH: 0.14, radius: 0.34, eye: 0.5, speedMul: 0.35, canJump: false, camoShape: "prone" },
  { id: "arms_up", label: "Arms Up", key: "5", halfH: 0.72, radius: 0.33, eye: 1.85, speedMul: 0.85, canJump: true, camoShape: "wide" },
  { id: "side_profile", label: "Side Profile", key: "6", halfH: 0.58, radius: 0.28, eye: 1.55, speedMul: 0.9, canJump: true, camoShape: "lean" },
  { id: "hug_pillar", label: "Hug Pillar", key: "7", halfH: 0.56, radius: 0.32, eye: 1.45, speedMul: 0.8, canJump: false, camoShape: "tuck" },
  { id: "t_pose", label: "T-Pose", key: "8", halfH: 0.6, radius: 0.5, eye: 1.6, speedMul: 0.75, canJump: true, camoShape: "wide" },
  { id: "sit", label: "Sit", key: "9", halfH: 0.32, radius: 0.36, eye: 1.0, speedMul: 0.45, canJump: false, camoShape: "crouch" },
  { id: "kneel", label: "Kneel", key: "0", halfH: 0.38, radius: 0.34, eye: 1.1, speedMul: 0.5, canJump: false, camoShape: "crouch" },
  { id: "peek_low", label: "Peek Low", halfH: 0.42, radius: 0.32, eye: 1.15, speedMul: 0.55, canJump: false, camoShape: "lean" },
  { id: "stretch", label: "Stretch", halfH: 0.75, radius: 0.3, eye: 1.9, speedMul: 0.8, canJump: true, camoShape: "wide" },
  { id: "crate_huddle", label: "Crate Huddle", halfH: 0.34, radius: 0.4, eye: 0.9, speedMul: 0.4, canJump: false, camoShape: "crouch" },
  { id: "wall_press", label: "Wall Press", halfH: 0.58, radius: 0.26, eye: 1.5, speedMul: 0.85, canJump: false, camoShape: "lean" },
];

export function getPose(id: string): PoseDef {
  return POSES.find((p) => p.id === id) || POSES[0];
}

export type HiderSize = "petite" | "normal" | "plump";
export const SIZE_IDS: HiderSize[] = ["petite", "normal", "plump"];
export const SIZES: { id: HiderSize; label: string; scale: number }[] = [
  { id: "petite", label: "Petite", scale: 0.65 },
  { id: "normal", label: "Normal", scale: 1 },
  { id: "plump", label: "Plump", scale: 1.35 },
];
export function getSizeScale(id?: string): number {
  return SIZES.find((s) => s.id === id)?.scale ?? 1;
}

export type CamoInput = {
  pose: string;
  size: string;
  locked: boolean;
  paintCompleteness: number;
  sampledWorldColor: string | null;
};

export function computeCamoScore({ pose, size, locked, paintCompleteness, sampledWorldColor }: CamoInput): number {
  const shape = getPose(pose).camoShape;
  const shapeBonus = shape === "prone" ? 12 : shape === "crouch" ? 9 : shape === "tuck" || shape === "lean" ? 7 : shape === "wide" ? 5 : 0;
  const sizeBonus = size === "petite" ? 5 : size === "plump" ? 4 : 3;
  const paintBonus = Math.max(0, Math.min(100, paintCompleteness)) * 0.34;
  const sampleBonus = sampledWorldColor ? 14 : 0;
  const lockBonus = locked ? 24 : 0;
  return Math.max(0, Math.min(100, Math.round(8 + paintBonus + lockBonus + sampleBonus + shapeBonus + sizeBonus)));
}

export function camoLabel(score: number): string {
  if (score >= 82) return "Prop-perfect";
  if (score >= 62) return "Blended";
  if (score >= 40) return "Noticeable";
  return "Exposed";
}


export const BODY_REGIONS = [
  { id: "head", label: "Head", x: 96, y: 8, w: 64, h: 56 },
  { id: "torso", label: "Torso", x: 84, y: 68, w: 88, h: 84 },
  { id: "arm_l", label: "Left Arm", x: 28, y: 70, w: 52, h: 70 },
  { id: "arm_r", label: "Right Arm", x: 176, y: 70, w: 52, h: 70 },
  { id: "hand_l", label: "Left Hand", x: 20, y: 144, w: 44, h: 36 },
  { id: "hand_r", label: "Right Hand", x: 192, y: 144, w: 44, h: 36 },
  { id: "leg_l", label: "Left Leg", x: 84, y: 156, w: 40, h: 76 },
  { id: "leg_r", label: "Right Leg", x: 132, y: 156, w: 40, h: 76 },
  { id: "foot_l", label: "Left Foot", x: 78, y: 234, w: 46, h: 18 },
  { id: "foot_r", label: "Right Foot", x: 132, y: 234, w: 46, h: 18 },
] as const;

export type BodyRegionId = typeof BODY_REGIONS[number]["id"];

export const PAINT_SIZE_HIGH = 512;
export const PAINT_SIZE_LOW = 256;
export const PAINT_MAX_BYTES = 60 * 1024;

export function createWhiteCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  // draw faint body silhouette guide so players know regions
  ctx.save();
  ctx.strokeStyle = "rgba(148,163,184,0.35)";
  ctx.lineWidth = 2;
  const s = size / 256;
  for (const r of BODY_REGIONS) {
    ctx.strokeRect(r.x * s, r.y * s, r.w * s, r.h * s);
  }
  ctx.restore();
  return c;
}

export type RegionTextures = Record<BodyRegionId, THREE.CanvasTexture>;

export function createRegionTextures(source: HTMLCanvasElement): RegionTextures {
  const textures = {} as RegionTextures;
  for (const r of BODY_REGIONS) {
    const tex = new THREE.CanvasTexture(source);
    tex.offset.set(r.x / 256, 1 - (r.y + r.h) / 256);
    tex.repeat.set(r.w / 256, r.h / 256);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    textures[r.id] = tex;
  }
  return textures;
}

export function canvasFromDataUrl(url: string, size = PAINT_SIZE_HIGH): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.getContext("2d")?.drawImage(img, 0, 0, size, size);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("Failed to load paint texture"));
    img.src = url;
  });
}

function dataUrlSize(url: string): number {
  const comma = url.indexOf(",");
  return comma < 0 ? Infinity : Math.floor(((url.length - comma - 1) * 3) / 4);
}

export function exportPaintDataUrl(canvas: HTMLCanvasElement): string {
  const png = canvas.toDataURL("image/png");
  if (dataUrlSize(png) <= PAINT_MAX_BYTES) return png;
  for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45, 0.35]) {
    const webp = canvas.toDataURL("image/webp", quality);
    if (webp.startsWith("data:image/webp") && dataUrlSize(webp) <= PAINT_MAX_BYTES) return webp;
  }
  const small = document.createElement("canvas");
  small.width = PAINT_SIZE_LOW;
  small.height = PAINT_SIZE_LOW;
  small.getContext("2d")?.drawImage(canvas, 0, 0, PAINT_SIZE_LOW, PAINT_SIZE_LOW);
  const smallPng = small.toDataURL("image/png");
  if (dataUrlSize(smallPng) <= PAINT_MAX_BYTES) return smallPng;
  const smallWebp = small.toDataURL("image/webp", 0.5);
  return smallWebp.startsWith("data:image/webp") ? smallWebp : smallPng;
}

export function computeCompleteness(canvas: HTMLCanvasElement): { total: number; regions: Record<string, number>; unpainted: string[] } {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const s = width / 256;
  const img = ctx.getImageData(0, 0, width, height).data;
  const regions: Record<string, number> = {};
  let sum = 0;
  const unpainted: string[] = [];
  for (const r of BODY_REGIONS) {
    const x0 = Math.max(0, Math.floor(r.x * s));
    const y0 = Math.max(0, Math.floor(r.y * s));
    const x1 = Math.min(width, Math.ceil((r.x + r.w) * s));
    const y1 = Math.min(height, Math.ceil((r.y + r.h) * s));
    let painted = 0; let count = 0;
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * width + x) * 4;
        const rr = img[i], gg = img[i + 1], bb = img[i + 2];
        // "white"/unpainted threshold
        if (!(rr > 245 && gg > 245 && bb > 245)) painted++;
        count++;
      }
    }
    const pct = count ? Math.round((painted / count) * 100) : 0;
    regions[r.id] = pct;
    sum += pct;
    if (pct < 35) unpainted.push(r.label);
  }
  const total = Math.round(sum / BODY_REGIONS.length);
  return { total, regions, unpainted };
}
