import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore } from "./store";
import {
  BODY_REGIONS, camoLabel, computeCamoScore, computeCompleteness, createRegionTextures, createWhiteCanvas,
  exportPaintDataUrl, PAINT_SIZE_HIGH, POSES, SIZES, type BodyRegionId, type HiderSize, type PoseId, type RegionTextures,
} from "./paint";

type Tool = "brush" | "eraser" | "fill" | "eyedropper";
type CanvasPointerHandler = (e: React.PointerEvent<HTMLCanvasElement>) => void;

export function PaintPanel({
  open,
  onClose,
  canEdit = true,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
  onApply?: (dataUrl: string, completeness: number) => void;
}) {
  const { paintColor, setPaintColor, pose, setPose, hiderSize, setHiderSize, holdUpHelper, setHoldUpHelper } = useGameStore();
  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(18);
  const [softness, setSoftness] = useState(0.4);
  const [symmetry, setSymmetry] = useState(true);
  const [recent, setRecent] = useState<string[]>(["#f8fafc", "#86a873", "#8b7355", "#38bdf8", "#facc15", "#fb7185", "#7c3aed", "#92400e"]);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const [previewRot, setPreviewRot] = useState(0);
  const [paintVersion, setPaintVersion] = useState(0);
  const sampledWorldColor = useGameStore((s) => s.sampledWorldColor);
  const locked = useGameStore((s) => s.locked);
  const [completeness, setCompleteness] = useState<{ total: number; unpainted: string[]; regions: Record<string, number> }>({ total: 0, unpainted: BODY_REGIONS.map(b => b.label), regions: {} });
  const blendScore = computeCamoScore({ pose, size: hiderSize, locked, paintCompleteness: completeness.total, sampledWorldColor });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const inited = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (!canvasRef.current) canvasRef.current = createWhiteCanvas(PAINT_SIZE_HIGH);
    if (!inited.current) { inited.current = true; updateCompleteness(); }
  }, [open]);

  const previewTextures = useMemo<RegionTextures | null>(() => {
    void paintVersion;
    if (!open || !canvasRef.current) return null;
    return createRegionTextures(canvasRef.current);
  }, [open, paintVersion]);
  useEffect(() => () => {
    if (previewTextures) Object.values(previewTextures).forEach((tex) => tex.dispose());
  }, [previewTextures]);

  const getCtx = () => canvasRef.current?.getContext("2d") || null;

  const rememberColor = (hex: string) => {
    setPaintColor(hex);
    setRecent((r) => [hex, ...r.filter((c) => c !== hex)].slice(0, 12));
  };

  const pushUndo = () => {
    const ctx = getCtx(); const c = canvasRef.current; if (!ctx || !c) return;
    const snap = ctx.getImageData(0, 0, c.width, c.height);
    setUndoStack((s) => [...s.slice(-19), snap]);
    setRedoStack([]);
  };

  const updateCompleteness = () => {
    const c = canvasRef.current; if (!c) return;
    const comp = computeCompleteness(c);
    setCompleteness({ total: comp.total, unpainted: comp.unpainted, regions: comp.regions });
    useGameStore.getState().setPaintCompleteness(comp.total);
    setPaintVersion((v) => v + 1);
  };

  const applyAndClose = () => {
    const c = canvasRef.current; if (!c) { onClose(); return; }
    const dataUrl = exportPaintDataUrl(c);
    onApply?.(dataUrl, completeness.total);
    useGameStore.getState().setPaintTextureDataUrl(dataUrl);
    onClose();
  };

  const toCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const c = canvasRef.current!;
    const scaleX = c.width / rect.width; const scaleY = c.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const drawDot = (x: number, y: number, mirror: boolean) => {
    const ctx = getCtx(); const c = canvasRef.current; if (!ctx || !c) return;
    const color = tool === "eraser" ? "#ffffff" : paintColor;
    const r = brushSize;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const edge = Math.max(0, Math.min(1, 1 - softness));
    grad.addColorStop(0, color);
    grad.addColorStop(edge, color);
    grad.addColorStop(1, tool === "eraser" ? "rgba(255,255,255,0)" : hexToRgba(color, 0));
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (symmetry && mirror) {
      const mx = c.width - x;
      const grad2 = ctx.createRadialGradient(mx, y, 0, mx, y, r);
      grad2.addColorStop(0, color); grad2.addColorStop(edge, color);
      grad2.addColorStop(1, tool === "eraser" ? "rgba(255,255,255,0)" : hexToRgba(color, 0));
      ctx.fillStyle = grad2; ctx.beginPath(); ctx.arc(mx, y, r, 0, Math.PI * 2); ctx.fill();
    }
  };

  const drawLine = (a: {x:number;y:number}, b: {x:number;y:number}) => {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const step = Math.max(1, brushSize * 0.25);
    for (let t = 0; t <= dist; t += step) {
      const p = t / (dist || 1);
      drawDot(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, true);
    }
  };

  const floodFill = (x: number, y: number) => {
    const ctx = getCtx(); const c = canvasRef.current; if (!ctx || !c) return;
    const w = c.width, h = c.height;
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const sx = Math.max(0, Math.min(w - 1, Math.floor(x)));
    const sy = Math.max(0, Math.min(h - 1, Math.floor(y)));
    const si = (sy * w + sx) * 4;
    const tr = data[si], tg = data[si + 1], tb = data[si + 2], ta = data[si + 3];
    const fc = hexToRgb(paintColor);
    if (!fc) return;
    if (tr === fc.r && tg === fc.g && tb === fc.b && ta === 255) return;
    const stack: [number, number][] = [[sx, sy]];
    const seen = new Uint8Array(w * h);
    let steps = 0;
    while (stack.length && steps < 300000) {
      steps++;
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
      const idx = cy * w + cx;
      if (seen[idx]) continue;
      const di = idx * 4;
      if (Math.abs(data[di]-tr)>20 || Math.abs(data[di+1]-tg)>20 || Math.abs(data[di+2]-tb)>20 || Math.abs(data[di+3]-ta)>20) continue;
      seen[idx] = 1;
      data[di] = fc.r; data[di+1] = fc.g; data[di+2] = fc.b; data[di+3] = 255;
      stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
    }
    ctx.putImageData(img, 0, 0);
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canEdit) return;
    const p = toCanvasPos(e);
    if (tool === "eyedropper") {
      const ctx = getCtx(); if (!ctx) return;
      const d = ctx.getImageData(Math.max(0,Math.floor(p.x)), Math.max(0,Math.floor(p.y)), 1, 1).data;
      const hex = rgbToHex(d[0], d[1], d[2]);
      rememberColor(hex);
      return;
    }
    pushUndo();
    drawing.current = true;
    last.current = p;
    if (tool === "fill") { floodFill(p.x, p.y); drawing.current = false; updateCompleteness(); return; }
    drawDot(p.x, p.y, true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { drawing.current = false; }
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !canEdit) return;
    const p = toCanvasPos(e);
    if (last.current) drawLine(last.current, p); else drawDot(p.x, p.y, true);
    last.current = p;
  };
  const onUp = () => {
    if (drawing.current) { drawing.current = false; last.current = null; updateCompleteness(); }
  };

  const undo = () => {
    const ctx = getCtx(); const c = canvasRef.current; if (!ctx || !c || undoStack.length === 0) return;
    const cur = ctx.getImageData(0, 0, c.width, c.height);
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, cur]);
    ctx.putImageData(prev, 0, 0);
    updateCompleteness();
  };
  const redo = () => {
    const ctx = getCtx(); const c = canvasRef.current; if (!ctx || !c || redoStack.length === 0) return;
    const cur = ctx.getImageData(0, 0, c.width, c.height);
    const nxt = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, cur]);
    ctx.putImageData(nxt, 0, 0);
    updateCompleteness();
  };

  if (!open) return null;
  const poseList = POSES.slice(0, 15);
  return (
    <div className="paint-overlay" onPointerDown={(e) => e.stopPropagation()} onClick={(e)=>e.stopPropagation()}>
      <div className="paint-panel">
        <div className="paint-header">
          <div>
            <strong>Paint & Pose (Hider)</strong>
            <div className="small muted">F toggles panel. E samples world color (eyedropper). Apply to save your camouflage look.</div>
          </div>
          <div className="row">
            <button className="btn secondary" onClick={undo} disabled={!canEdit || undoStack.length===0}>Undo</button>
            <button className="btn secondary" onClick={redo} disabled={!canEdit || redoStack.length===0}>Redo</button>
            <button className="btn secondary" onClick={onClose}>Close</button>
            <button className="btn" onClick={applyAndClose} disabled={!canEdit}>Apply / Save</button>
          </div>
        </div>
        <div className="paint-body">
          <div className="paint-tools">
            <div className="tool-row">
              {(["brush","eraser","fill","eyedropper"] as Tool[]).map(t => (
                <button key={t} className={`btn secondary ${tool===t?"active":""}`} onClick={()=>setTool(t)}>{t[0].toUpperCase()+t.slice(1)}</button>
              ))}
            </div>
            <label className="small">Brush size {brushSize}<input type="range" min={2} max={72} value={brushSize} onChange={e=>setBrushSize(+e.target.value)} /></label>
            <label className="small">Softness {softness.toFixed(2)}<input type="range" min={0} max={1} step={0.05} value={softness} onChange={e=>setSoftness(+e.target.value)} /></label>
            <label className="small row"><input type="checkbox" checked={symmetry} onChange={e=>setSymmetry(e.target.checked)} /> Symmetry (L/R mirror)</label>
            <label className="small row"><input type="checkbox" checked={holdUpHelper} onChange={e=>setHoldUpHelper(e.target.checked)} /> Hold-up helper overlay</label>
            <div className="small"><strong>Color</strong></div>
            <div className="row" style={{alignItems:"center"}}>
              <input type="color" value={paintColor} onChange={e=>rememberColor(e.target.value)} />
              <span className="code">{paintColor}</span>
            </div>
            <div className="palette-row">
              {recent.map(c => <button key={c} className={`swatch ${paintColor===c?"active":""}`} style={{background:c}} onClick={()=>setPaintColor(c)} title={c} />)}
            </div>
            <div className="small" style={{marginTop:6}}><strong>Pose Wheel</strong> ({poseList.length})</div>
            <div className="pose-grid">
              {poseList.map(p => (
                <button key={p.id} className={`btn secondary pose-btn ${pose===p.id?"active":""}`} onClick={()=>setPose(p.id as PoseId)} title={p.id}>{p.label}</button>
              ))}
            </div>
            <div className="small" style={{marginTop:6}}><strong>Body Size</strong></div>
            <div className="pose-grid">
              {SIZES.map(s => (
                <button key={s.id} className={`btn secondary pose-btn ${hiderSize===s.id?"active":""}`} onClick={()=>setHiderSize(s.id as HiderSize)}>{s.label}</button>
              ))}
            </div>
            <div className="small muted">L locks pose in-game. Moving in seeker sightline can cause shimmer.</div>
          </div>
          <div className="paint-canvas-wrap">
            <div className="preview-ctrl row small"><span>Drag the mirror to rotate; paint the UV canvas below</span><input type="range" min={-180} max={180} value={previewRot} onChange={e=>setPreviewRot(+e.target.value)} /></div>
            <div className="paint-preview-row">
              <div className="paint-mirror">
                <MirrorPreview textures={previewTextures} color={sampledWorldColor || paintColor} rotation={previewRot} />
                <div className="small muted mirror-label">Mirror preview</div>
              </div>
              <PaintCanvasView canvasRef={canvasRef} onDown={onDown} onMove={onMove} onUp={onUp} />
            </div>
            {holdUpHelper && (
              <div className="holdup-overlay">
                Hold-up helper: press <strong>E</strong> at the crosshair to sample the surface behind you.
                {sampledWorldColor && <span className="swatch sampled" style={{ background: sampledWorldColor }} title={sampledWorldColor} />}
                <span>{sampledWorldColor || "No sample yet"}</span>
              </div>
            )}
            <div className="completeness-box">
              <div><strong>Paint completeness:</strong> {completeness.total}% · <strong>Blend:</strong> {blendScore} ({camoLabel(blendScore)})</div>
              {completeness.unpainted.length > 0 ? (
                <div className="warn-text">Unpainted/easy to spot: {completeness.unpainted.join(", ")}</div>
              ) : <div className="ok-text">Great coverage! White-elbow risk reduced.</div>}
              <div className="region-bars">
                {BODY_REGIONS.map(r => (
                  <div key={r.id} className="region-bar"><span>{r.label}</span><div className="bar"><div style={{width:`${Math.min(100, completeness.regions[r.id] ?? 0)}%`}}/></div><span className="pct">{completeness.regions[r.id] ?? 0}%</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MirrorPreview({ textures, color, rotation }: { textures: RegionTextures | null; color: string; rotation: number }) {
  const mat = (region: BodyRegionId) => textures ? { map: textures[region], color } : { color };
  return (
    <Canvas camera={{ position: [0, 1.35, 3.2], fov: 42 }} dpr={[1, 1.5]}>
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} />
      <group rotation={[0, rotation * Math.PI / 180, 0]} position={[0, -0.9, 0]}>
        <mesh position={[0, 0.78, 0]}><boxGeometry args={[0.48, 0.58, 0.32]} /><meshStandardMaterial {...mat("torso")} roughness={0.65} /></mesh>
        <mesh position={[0, 1.24, 0.02]}><sphereGeometry args={[0.19, 20, 20]} /><meshStandardMaterial {...mat("head")} roughness={0.6} /></mesh>
        <mesh position={[-0.34, 0.8, 0]}><boxGeometry args={[0.11, 0.4, 0.13]} /><meshStandardMaterial {...mat("arm_l")} roughness={0.7} /></mesh>
        <mesh position={[0.34, 0.8, 0]}><boxGeometry args={[0.11, 0.4, 0.13]} /><meshStandardMaterial {...mat("arm_r")} roughness={0.7} /></mesh>
        <mesh position={[-0.37, 0.53, 0]}><boxGeometry args={[0.13, 0.14, 0.14]} /><meshStandardMaterial {...mat("hand_l")} roughness={0.75} /></mesh>
        <mesh position={[0.37, 0.53, 0]}><boxGeometry args={[0.13, 0.14, 0.14]} /><meshStandardMaterial {...mat("hand_r")} roughness={0.75} /></mesh>
        <mesh position={[-0.13, 0.32, 0]}><boxGeometry args={[0.15, 0.44, 0.17]} /><meshStandardMaterial {...mat("leg_l")} roughness={0.75} /></mesh>
        <mesh position={[0.13, 0.32, 0]}><boxGeometry args={[0.15, 0.44, 0.17]} /><meshStandardMaterial {...mat("leg_r")} roughness={0.75} /></mesh>
        <mesh position={[-0.13, 0.08, 0.04]}><boxGeometry args={[0.16, 0.14, 0.24]} /><meshStandardMaterial {...mat("foot_l")} roughness={0.8} /></mesh>
        <mesh position={[0.13, 0.08, 0.04]}><boxGeometry args={[0.16, 0.14, 0.24]} /><meshStandardMaterial {...mat("foot_r")} roughness={0.8} /></mesh>
      </group>
      <OrbitControls enablePan={false} enableZoom={false} target={[0, 0, 0]} />
    </Canvas>
  );
}

function PaintCanvasView({ canvasRef, onDown, onMove, onUp }: { canvasRef: React.MutableRefObject<HTMLCanvasElement|null>; onDown: CanvasPointerHandler; onMove: CanvasPointerHandler; onUp: CanvasPointerHandler }) {
  const ref = useRef<HTMLCanvasElement|null>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const src = canvasRef.current; const dst = ref.current;
      if (src && dst) {
        const ctx = dst.getContext("2d");
        if (ctx) { ctx.clearRect(0,0,dst.width,dst.height); ctx.drawImage(src,0,0,dst.width,dst.height); }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef]);
  return <canvas ref={ref} width={512} height={512} className="paint-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp} />;
}

function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) } : null;
}
function hexToRgba(hex: string, a: number) {
  const c = hexToRgb(hex); return c ? `rgba(${c.r},${c.g},${c.b},${a})` : `rgba(255,255,255,${a})`;
}
function rgbToHex(r:number,g:number,b:number){return "#"+[r,g,b].map(x=>x.toString(16).padStart(2,"0")).join("");}

export function EyedropperSampler({ enabled }: { enabled: boolean }) {
  const { gl, scene, camera } = useThree();
  const sampleRequest = useGameStore((s) => s.sampleRequest);
  const lastRequest = useRef(sampleRequest);
  const sampleRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    sampleRef.current = () => {
      const size = new THREE.Vector2();
      gl.getSize(size);
      const glCtx = gl.getContext();
      const x = Math.floor(glCtx.drawingBufferWidth * (size.x > 0 ? 0.5 : 0));
      const y = Math.floor(glCtx.drawingBufferHeight * (size.y > 0 ? 0.5 : 0));
      const buf = new Uint8Array(4);
      try {
        gl.render(scene, camera);
        glCtx.readPixels(x, y, 1, 1, glCtx.RGBA, glCtx.UNSIGNED_BYTE, buf);
      } catch {
        return;
      }
      const hex = rgbToHex(buf[0], buf[1], buf[2]);
      useGameStore.getState().setPaintColor(hex);
      useGameStore.getState().setSampledWorldColor(hex);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyE") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      sampleRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, gl, scene, camera]);

  useEffect(() => {
    if (!enabled || sampleRequest === lastRequest.current) return;
    lastRequest.current = sampleRequest;
    sampleRef.current();
  }, [enabled, sampleRequest]);

  return null;
}
