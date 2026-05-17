import { TopologyAppDto } from '../../../core/api/model/topologyAppDto';
import { TopologyResponseDto } from '../../../core/api/model/topologyResponseDto';

import { cryptoRandom } from './crypto-random';
import { buildScene } from './universe-map.layout';
import {
  AppNode,
  GalaxyNode,
  LabelMode,
  MoonNode,
  ServerNode,
  ShowMode,
  ZoomLevel,
} from './universe-map.types';

export interface UniverseCallbacks {
  onAppHover?: (app: AppNode | null) => void;
  onServerHover?: (server: ServerNode | null) => void;
  onAppDoubleClick?: (app: AppNode) => void;
  onServerDoubleClick?: (server: ServerNode) => void;
  onZoomChange?: (level: ZoomLevel) => void;
}

interface StarBg {
  u: number; // 0..1 across viewport width
  v: number; // 0..1 across viewport height
  r: number;
  tw: number;
}

function lighten(col: string, amt: number): string {
  const c = (col || '#888888').replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  const lr = Math.min(255, Math.round(r + (255 - r) * amt));
  const lg = Math.min(255, Math.round(g + (255 - g) * amt));
  const lb = Math.min(255, Math.round(b + (255 - b) * amt));
  return `rgb(${lr},${lg},${lb})`;
}

function hex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

export class FluiUniverseRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly dpr = globalThis.window?.devicePixelRatio ?? 1;
  private W = 0;
  private H = 0;

  // camera (current vs target for easing)
  private cx = 0;
  private cy = 0;
  private cz = 0.36;
  private tx = 0;
  private ty = 0;
  private tz = 0.36;

  private galaxies: GalaxyNode[] = [];
  private appById = new Map<string, AppNode>();
  private starsBg: StarBg[] = [];
  private t = 0;

  private hovered: AppNode | null = null;
  private hoveredServer: ServerNode | null = null;
  private labelMode: LabelMode = 'auto';
  private showMode: ShowMode = 'all';
  private lastZoomLevel: ZoomLevel = 'galaxy';

  private rafId: number | null = null;
  private cleanups: Array<() => void> = [];

  private dragActive = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragCamSx = 0;
  private dragCamSy = 0;
  private didDrag = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly container: HTMLElement,
    private readonly callbacks: UniverseCallbacks = {},
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context not available');
    this.ctx = ctx;
    this.seedStars();
  }

  mount(data: TopologyResponseDto): void {
    this.galaxies = buildScene(data);
    this.indexApps();
    this.handleResize();
    this.fitToViewport();
    this.attachInteractions();
    this.loop();
  }

  /**
   * Bounding box of the "active" content (stars + orbits), in world coordinates.
   * Used both for fit-to-viewport and for clamping pan.
   */
  private getContentBBox(): { cx: number; cy: number; w: number; h: number } | null {
    if (this.galaxies.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const g of this.galaxies) {
      const effR = g.r * 0.6;
      minX = Math.min(minX, g.x - effR);
      minY = Math.min(minY, g.y - effR);
      maxX = Math.max(maxX, g.x + effR);
      maxY = Math.max(maxY, g.y + effR);
    }
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      w: Math.max(1, maxX - minX),
      h: Math.max(1, maxY - minY),
    };
  }

  /**
   * Compute the fit-to-viewport camera target. Few clusters → zoomed in; many → overview.
   */
  private computeFitTarget(): { x: number; y: number; z: number } | null {
    const bbox = this.getContentBBox();
    if (!bbox || !this.W || !this.H) return null;
    const pad = 1.05;
    const fit = Math.min(this.W / (bbox.w * pad), this.H / (bbox.h * pad));
    const z = Math.max(0.25, Math.min(2.8, fit));
    return { x: bbox.cx, y: bbox.cy, z };
  }

  /**
   * Clamp the camera target so the user can't pan into the void or zoom out past
   * the fit-to-viewport level. Drag still updates tx/ty freely, but each frame
   * we pull them back inside the allowed range — easing produces an elastic feel.
   */
  private clampCameraTarget(): void {
    const fit = this.computeFitTarget();
    const bbox = this.getContentBBox();
    if (!fit || !bbox) return;

    // Cap zoom-out at half the fit zoom — enough breathing room around the content
    // but not enough to disappear into the void.
    const minZ = fit.z * 0.5;
    if (this.tz < minZ) this.tz = minZ;
    if (this.cz < minZ * 0.99) this.cz = minZ * 0.99;

    // Soft pan bounds: allow tx/ty to roam within bbox extent plus ~25% of viewport
    const maxOffX = bbox.w / 2 + (this.W / this.tz) * 0.25;
    const maxOffY = bbox.h / 2 + (this.H / this.tz) * 0.25;
    this.tx = Math.max(bbox.cx - maxOffX, Math.min(bbox.cx + maxOffX, this.tx));
    this.ty = Math.max(bbox.cy - maxOffY, Math.min(bbox.cy + maxOffY, this.ty));
  }

  /**
   * Snap both current and target camera to the fit position (used on initial mount).
   */
  private fitToViewport(): void {
    const target = this.computeFitTarget();
    if (!target) return;
    this.cx = target.x;
    this.cy = target.y;
    this.cz = target.z;
    this.tx = target.x;
    this.ty = target.y;
    this.tz = target.z;
  }

  updateData(data: TopologyResponseDto): void {
    const oldByApp = this.appById;
    const next = buildScene(data);
    // Preserve orbital phase for apps that survive
    for (const g of next) {
      for (const a of g.apps) {
        const prev = oldByApp.get(a.id);
        if (prev) {
          a.oA = prev.oA;
          a.oR = prev.oR;
          a.oS = prev.oS;
          a.x = prev.x;
          a.y = prev.y;
          // Map moon phases by index where possible
          for (let i = 0; i < a.moons.length && i < prev.moons.length; i++) {
            a.moons[i].moA = prev.moons[i].moA;
          }
        }
      }
    }
    this.galaxies = next;
    this.indexApps();
    if (this.hovered) {
      const refreshed = this.appById.get(this.hovered.id);
      this.hovered = refreshed ?? null;
      if (!refreshed) this.callbacks.onAppHover?.(null);
    }
  }

  patchApp(appId: string, patch: Partial<TopologyAppDto>): void {
    const app = this.appById.get(appId);
    if (!app) return;
    const next: TopologyAppDto = { ...app.raw, ...patch };
    app.raw = next;
    if (patch.status !== undefined) app.status = next.status;
    if (patch.replicaCount !== undefined) app.replicaCount = next.replicaCount;
    if (patch.ramRequestMB !== undefined) app.ramRequestMB = next.ramRequestMB;
  }

  setLabelMode(mode: LabelMode): void {
    this.labelMode = mode;
  }

  setShowMode(mode: ShowMode): void {
    this.showMode = mode;
  }

  reset(): void {
    // Re-fit to viewport: ease the camera back to the initial fit.
    const target = this.computeFitTarget();
    if (!target) return;
    this.tx = target.x;
    this.ty = target.y;
    this.tz = target.z;
  }

  focusOn(x: number, y: number, zoom: number): void {
    this.tx = x;
    this.ty = y;
    this.tz = zoom;
  }

  focusFirstError(): void {
    for (const g of this.galaxies) {
      for (const a of g.apps) {
        if (a.status === 'error') {
          this.focusOn(a.x, a.y, 2.8);
          return;
        }
      }
    }
  }

  handleResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.W = w;
    this.H = h;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    for (const fn of this.cleanups) fn();
    this.cleanups = [];
  }

  // ---------- internals ----------

  private indexApps(): void {
    this.appById = new Map();
    for (const g of this.galaxies) for (const a of g.apps) this.appById.set(a.id, a);
  }

  private seedStars(): void {
    this.starsBg = [];
    for (let i = 0; i < 260; i++) {
      this.starsBg.push({
        u: cryptoRandom(),
        v: cryptoRandom(),
        r: cryptoRandom() * 1.2 + 0.2,
        tw: cryptoRandom() * Math.PI * 2,
      });
    }
  }

  private w2s(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.cx) * this.cz + this.W / 2, y: (y - this.cy) * this.cz + this.H / 2 };
  }
  private s2w(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.W / 2) / this.cz + this.cx, y: (y - this.H / 2) / this.cz + this.cy };
  }

  private shouldShowApp(a: AppNode): boolean {
    return this.showMode === 'all' || a.kind === 'user';
  }

  private showServerLabel(): boolean {
    if (this.labelMode === 'all') return true;
    if (this.labelMode === 'off') return false;
    return this.cz > 0.55; // auto
  }

  private showGalaxyLabel(): boolean {
    if (this.labelMode === 'all') return true;
    if (this.labelMode === 'off') return false;
    return this.cz < 0.7; // auto (only visible when zoomed out)
  }

  private serverHasError(s: ServerNode): boolean {
    return s.galaxy.apps.some(
      (a) =>
        a.status === 'error' &&
        (a.primaryServer.id === s.id || a.replicaServers.some((rs) => rs.server.id === s.id)),
    );
  }

  private currentZoomLevel(): ZoomLevel {
    const z = this.cz;
    if (z < 0.45) return 'galaxy';
    if (z < 1.2) return 'star';
    if (z < 2.5) return 'orbit';
    return 'world';
  }

  private readonly loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    this.draw();
  };

  private isCanvasEvent(e: Event): boolean {
    return e.target === this.canvas;
  }

  private attachInteractions(): void {
    const onMouseDown = (e: MouseEvent) => {
      if (!this.isCanvasEvent(e)) return;
      this.dragActive = true;
      this.didDrag = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragCamSx = this.tx;
      this.dragCamSy = this.ty;
      this.canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      const rt = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rt.left;
      const my = e.clientY - rt.top;
      if (this.dragActive) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.didDrag = true;
        this.tx = this.dragCamSx - dx / this.cz;
        this.ty = this.dragCamSy - dy / this.cz;
        return;
      }
      if (e.target !== this.canvas) {
        this.setHover(null);
        this.setHoverServer(null);
        return;
      }
      if (mx < 0 || mx > this.W || my < 0 || my > this.H) {
        this.setHover(null);
        this.setHoverServer(null);
        return;
      }
      const w = this.s2w(mx, my);
      const a = this.findApp(w.x, w.y);
      if (a) {
        this.setHover(a);
        this.setHoverServer(null);
        this.canvas.style.cursor = 'pointer';
        return;
      }
      this.setHover(null);
      const sv = this.findServer(w.x, w.y);
      if (sv) {
        this.setHoverServer(sv);
        this.canvas.style.cursor = 'pointer';
        return;
      }
      this.setHoverServer(null);
      this.canvas.style.cursor = 'grab';
    };

    const onMouseUp = () => {
      this.dragActive = false;
      this.canvas.style.cursor = 'grab';
    };

    const onClick = (e: MouseEvent) => {
      if (!this.isCanvasEvent(e)) return;
      if (this.didDrag) return;
      const rt = this.canvas.getBoundingClientRect();
      const w = this.s2w(e.clientX - rt.left, e.clientY - rt.top);
      // Click on an app sphere → no zoom (double-click opens its modal).
      if (this.findApp(w.x, w.y)) return;
      // Single click anywhere else (server, halo, empty space) → zoom-focus.
      this.tx = w.x;
      this.ty = w.y;
      this.tz = Math.min(4, Math.max(this.tz * 1.4, 1.2));
    };

    const onDblClick = (e: MouseEvent) => {
      if (!this.isCanvasEvent(e)) return;
      const rt = this.canvas.getBoundingClientRect();
      const w = this.s2w(e.clientX - rt.left, e.clientY - rt.top);
      const a = this.findApp(w.x, w.y);
      if (a) {
        this.callbacks.onAppDoubleClick?.(a);
        return;
      }
      const sv = this.findServer(w.x, w.y);
      if (sv) {
        this.callbacks.onServerDoubleClick?.(sv);
      }
      // Empty space double-click: do nothing (the prior single click already zoomed).
    };

    const onWheel = (e: WheelEvent) => {
      if (!this.isCanvasEvent(e)) return;
      e.preventDefault();
      const rt = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rt.left;
      const my = e.clientY - rt.top;
      // World point under the cursor at the current camera state
      const before = this.s2w(mx, my);
      const step = e.ctrlKey ? 1.06 : 1.12; // softer zoom; finer with ctrl/pinch
      const f = e.deltaY < 0 ? step : 1 / step;
      // Allow zooming out roughly 2× past the fit-to-viewport level — beyond that
      // we'd just be staring at empty starfield.
      const minZ = (this.computeFitTarget()?.z ?? 0.25) * 0.5;
      const newTz = Math.max(minZ, Math.min(4, this.tz * f));
      this.tz = newTz;
      // After easing converges (cx,cy,cz → tx,ty,tz), the world point under the cursor
      // is (mx-W/2)/tz + tx. Solve for tx so it matches `before`.
      this.tx = before.x - (mx - this.W / 2) / newTz;
      this.ty = before.y - (my - this.H / 2) / newTz;
    };

    this.container.addEventListener('mousedown', onMouseDown);
    globalThis.window.addEventListener('mousemove', onMouseMove);
    globalThis.window.addEventListener('mouseup', onMouseUp);
    this.container.addEventListener('click', onClick);
    this.container.addEventListener('dblclick', onDblClick);
    this.container.addEventListener('wheel', onWheel, { passive: false });

    this.cleanups.push(
      () => this.container.removeEventListener('mousedown', onMouseDown),
      () => globalThis.window.removeEventListener('mousemove', onMouseMove),
      () => globalThis.window.removeEventListener('mouseup', onMouseUp),
      () => this.container.removeEventListener('click', onClick),
      () => this.container.removeEventListener('dblclick', onDblClick),
      () => this.container.removeEventListener('wheel', onWheel),
    );
  }

  private setHover(a: AppNode | null): void {
    if (this.hovered === a) return;
    this.hovered = a;
    this.callbacks.onAppHover?.(a);
  }

  private setHoverServer(s: ServerNode | null): void {
    if (this.hoveredServer === s) return;
    this.hoveredServer = s;
    this.callbacks.onServerHover?.(s);
  }

  private findApp(x: number, y: number): AppNode | null {
    return this.findAppByMoonHit(x, y) ?? this.findAppByBodyHit(x, y);
  }

  private findAppByMoonHit(x: number, y: number): AppNode | null {
    for (const g of this.galaxies) {
      for (const a of g.apps) {
        if (!this.shouldShowApp(a)) continue;
        for (const m of a.moons) {
          const dx = x - m.x;
          const dy = y - m.y;
          if (dx * dx + dy * dy <= (m.r + 3) * (m.r + 3)) return a;
        }
      }
    }
    return null;
  }

  private findAppByBodyHit(x: number, y: number): AppNode | null {
    for (const g of this.galaxies) {
      for (const a of g.apps) {
        if (!this.shouldShowApp(a)) continue;
        const dx = x - a.x;
        const dy = y - a.y;
        if (dx * dx + dy * dy <= (a.r + 4) * (a.r + 4)) return a;
      }
    }
    return null;
  }

  private findServer(x: number, y: number): ServerNode | null {
    for (const g of this.galaxies)
      for (const s of g.servers) {
        const dx = x - s.x;
        const dy = y - s.y;
        if (dx * dx + dy * dy <= (s.r + 5) * (s.r + 5)) return s;
      }
    return null;
  }

  private findGalaxy(x: number, y: number): GalaxyNode | null {
    for (const g of this.galaxies) {
      const dx = x - g.x;
      const dy = y - g.y;
      if (dx * dx + dy * dy <= g.r * g.r) return g;
    }
    return null;
  }

  // ---------- drawing ----------

  private draw(): void {
    if (!this.W || !this.H) return;
    this.t++;
    this.clampCameraTarget();
    this.cx += (this.tx - this.cx) * 0.09;
    this.cy += (this.ty - this.cy) * 0.09;
    this.cz += (this.tz - this.cz) * 0.09;

    const z = this.currentZoomLevel();
    if (z !== this.lastZoomLevel) {
      this.lastZoomLevel = z;
      this.callbacks.onZoomChange?.(z);
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    this.drawStarsBg();
    this.advanceOrbits();
    this.drawGalaxies();
    this.drawStars();
    this.drawTethers();
    this.drawHoverArcs();
    this.drawApps();
  }

  private drawStarsBg(): void {
    const ctx = this.ctx;
    for (const s of this.starsBg) {
      const sx = s.u * this.W;
      const sy = s.v * this.H;
      const tw = Math.sin(this.t * 0.02 + s.tw) * 0.4 + 0.6;
      ctx.fillStyle = `rgba(255,255,255,${tw * 0.5})`;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private advanceOrbits(): void {
    for (const g of this.galaxies) {
      for (const a of g.apps) {
        this.advanceAppOrbit(a);
        for (const m of a.moons) this.advanceMoonOrbit(a, m);
      }
    }
  }

  private advanceAppOrbit(a: AppNode): void {
    if (a.status !== 'stopped') a.oA += a.oS;
    a.x = a.primaryServer.x + Math.cos(a.oA) * a.oR;
    a.y = a.primaryServer.y + Math.sin(a.oA) * a.oR;
    if (a.status === 'error') {
      a.x += Math.sin(this.t * 0.06 + a.oA * 3) * 0.5;
      a.y += Math.cos(this.t * 0.06 + a.oA * 3) * 0.5;
    }
  }

  private advanceMoonOrbit(a: AppNode, m: MoonNode): void {
    m.moA += m.moS;
    const px = a.x;
    const py = a.y;
    if (m.hostServer.id === a.primaryServer.id) {
      m.x = px + Math.cos(m.moA) * m.moR;
      m.y = py + Math.sin(m.moA) * m.moR;
      return;
    }
    const sx = m.hostServer.x;
    const sy = m.hostServer.y;
    const blend = 0.55 + Math.sin(m.moA) * 0.05;
    const baseX = px + (sx - px) * blend;
    const baseY = py + (sy - py) * blend;
    const dx = sx - px;
    const dy = sy - py;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    const wobble = Math.sin(m.moA * 1.4) * 8;
    m.x = baseX + perpX * wobble;
    m.y = baseY + perpY * wobble;
  }

  private drawGalaxies(): void {
    const ctx = this.ctx;
    for (const g of this.galaxies) {
      const p = this.w2s(g.x, g.y);
      const r = g.r * this.cz;
      if (p.x + r < 0 || p.x - r > this.W || p.y + r < 0 || p.y - r > this.H) continue;
      const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      gr.addColorStop(0, g.color + '55');
      gr.addColorStop(0.4, g.color + '22');
      gr.addColorStop(1, g.color + '00');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = g.color + '33';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (this.showGalaxyLabel()) {
        ctx.fillStyle = '#9FE1CB';
        ctx.font = `${Math.max(11, 14 * Math.min(1, this.cz * 1.5))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(g.displayName.toUpperCase(), p.x, p.y - r - 14);
        ctx.fillStyle = 'rgba(159,225,203,0.5)';
        ctx.font = '10px ui-monospace, monospace';
        const ta = g.apps.length;
        const tr = g.apps.reduce((s, a) => s + a.replicaCount, 0);
        ctx.fillText(
          `${g.servers.length} stars · ${ta} apps · ${tr} replicas`,
          p.x,
          p.y - r - 2,
        );
      }
    }
  }

  private drawStars(): void {
    for (const g of this.galaxies) {
      for (const s of g.servers) this.drawStar(s);
    }
  }

  private drawStar(s: ServerNode): void {
    const ctx = this.ctx;
    const p = this.w2s(s.x, s.y);
    const r = s.r * this.cz;
    if (p.x + r < -50 || p.x - r > this.W + 50) return;
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.5);
    glow.addColorStop(0, 'rgba(255,235,180,0.5)');
    glow.addColorStop(0.4, 'rgba(255,200,120,0.15)');
    glow.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.5, 0, Math.PI * 2);
    ctx.fill();
    const pulse = Math.sin(this.t * 0.03 + s.x * 0.01) * 0.06 + 1;
    const bg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    bg.addColorStop(0, '#fff8e0');
    bg.addColorStop(0.6, '#FFC57A');
    bg.addColorStop(1, '#E69437');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * pulse, 0, Math.PI * 2);
    ctx.fill();

    if (this.serverHasError(s)) this.drawStarErrorIndicator(p.x, p.y, r);
    this.drawStarHaloAndLabel(s, p.x, p.y, r);
  }

  private drawStarErrorIndicator(px: number, py: number, r: number): void {
    const ctx = this.ctx;
    const errPulse = Math.sin(this.t * 0.08) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255,90,110,${0.75 + errPulse * 0.2})`;
    ctx.font = `bold ${Math.max(12, 14 * this.cz)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('!', px + r * 0.85, py - r * 0.85);
    ctx.beginPath();
    ctx.arc(px + r * 0.85, py - r * 0.95, 5 + errPulse * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,90,110,${0.12 + errPulse * 0.08})`;
    ctx.fill();
  }

  private drawStarHaloAndLabel(s: ServerNode, px: number, py: number, r: number): void {
    const ctx = this.ctx;
    const isHov = this.hoveredServer === s;
    if (isHov) {
      ctx.strokeStyle = 'rgba(255,235,180,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (this.showServerLabel() || isHov) {
      ctx.fillStyle = isHov ? 'rgba(255,235,180,0.95)' : 'rgba(255,235,180,0.7)';
      ctx.font = `${Math.max(9, 11 * Math.min(1.4, this.cz))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(s.raw.displayName || s.name, px, py - r - 8);
    }
  }

  private drawTethers(): void {
    if (this.cz <= 0.5) return;
    for (const g of this.galaxies) {
      for (const a of g.apps) {
        if (!this.shouldShowApp(a)) continue;
        this.drawAppTethers(a);
      }
    }
  }

  private drawAppTethers(a: AppNode): void {
    const ctx = this.ctx;
    const isHovered = this.hovered === a;
    for (const m of a.moons) {
      if (m.hostServer.id === a.primaryServer.id) continue;
      const mp = this.w2s(m.x, m.y);
      const sp = this.w2s(m.hostServer.x, m.hostServer.y);
      ctx.strokeStyle = isHovered ? a.color + '99' : a.color + '28';
      ctx.lineWidth = isHovered ? 1 : 0.4;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(mp.x, mp.y);
      ctx.lineTo(sp.x, sp.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawHoverArcs(): void {
    const a = this.hovered;
    if (!a || a.replicaCount <= 1 || !this.shouldShowApp(a)) return;
    const ctx = this.ctx;
    const p1 = this.w2s(a.x, a.y);
    for (const m of a.moons) {
      const mp = this.w2s(m.x, m.y);
      const midX = (p1.x + mp.x) / 2;
      const midY = (p1.y + mp.y) / 2;
      const dx = mp.x - p1.x;
      const dy = mp.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const lift = Math.min(40, len * 0.25);
      const ctrlX = midX - (dy / len) * lift;
      const ctrlY = midY + (dx / len) * lift;
      ctx.strokeStyle = a.color + 'AA';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, mp.x, mp.y);
      ctx.stroke();
      const tp = (this.t % 80) / 80;
      const px = (1 - tp) * (1 - tp) * p1.x + 2 * (1 - tp) * tp * ctrlX + tp * tp * mp.x;
      const py = (1 - tp) * (1 - tp) * p1.y + 2 * (1 - tp) * tp * ctrlY + tp * tp * mp.y;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawApps(): void {
    for (const g of this.galaxies) {
      for (const a of g.apps) {
        if (!this.shouldShowApp(a)) continue;
        this.drawPlanet(a);
        for (const m of a.moons) this.drawMoon(a, m);
      }
    }
  }

  private resolveGlowStyle(a: AppNode): { color: string; boost: number } {
    if (a.status === 'error') return { color: '#FF5A6E', boost: 1.15 };
    if (a.status === 'stopped') return { color: '#444444', boost: 0.3 };
    return { color: a.color, boost: 1 };
  }

  private resolveGlowScale(replicas: number): number {
    if (replicas <= 1) return 2;
    if (replicas === 2) return 2.6;
    if (replicas === 3) return 3.2;
    return 3.8;
  }

  private drawPlanetGlow(
    a: AppNode,
    px: number,
    py: number,
    r: number,
    glowColor: string,
    glowScale: number,
  ): void {
    const ctx = this.ctx;
    const replicas = a.replicaCount;
    const alphaMul = a.kind === 'system' ? 0.6 : 1;
    const gl = ctx.createRadialGradient(px, py, 0, px, py, r * glowScale);
    if (replicas <= 1) {
      gl.addColorStop(0, glowColor + hex2(170 * alphaMul));
      gl.addColorStop(0.5, glowColor + hex2(50 * alphaMul));
      gl.addColorStop(1, glowColor + '00');
    } else if (replicas === 2) {
      gl.addColorStop(0, glowColor + hex2(187 * alphaMul));
      gl.addColorStop(0.35, glowColor + hex2(85 * alphaMul));
      gl.addColorStop(0.7, glowColor + hex2(33 * alphaMul));
      gl.addColorStop(1, glowColor + '00');
    } else if (replicas === 3) {
      gl.addColorStop(0, glowColor + hex2(204 * alphaMul));
      gl.addColorStop(0.25, glowColor + hex2(102 * alphaMul));
      gl.addColorStop(0.55, glowColor + hex2(50 * alphaMul));
      gl.addColorStop(0.85, glowColor + hex2(21 * alphaMul));
      gl.addColorStop(1, glowColor + '00');
    } else {
      gl.addColorStop(0, glowColor + hex2(221 * alphaMul));
      gl.addColorStop(0.2, glowColor + hex2(119 * alphaMul));
      gl.addColorStop(0.45, glowColor + hex2(68 * alphaMul));
      gl.addColorStop(0.7, glowColor + hex2(33 * alphaMul));
      gl.addColorStop(0.9, glowColor + hex2(16 * alphaMul));
      gl.addColorStop(1, glowColor + '00');
    }
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(px, py, r * glowScale, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPlanetStatusOverlay(a: AppNode, px: number, py: number, r: number): void {
    const ctx = this.ctx;
    if (a.status === 'warning') {
      ctx.strokeStyle = '#FFD86B';
      ctx.lineWidth = 1.4;
      const dl = Math.sin(this.t * 0.08) * 3 + 5;
      ctx.setLineDash([dl, dl]);
      ctx.beginPath();
      ctx.arc(px, py, r + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    if (a.status === 'error') {
      const pulse = Math.sin(this.t * 0.06) * 0.5 + 0.5;
      ctx.strokeStyle = `rgba(255,90,110,${0.55 + pulse * 0.25})`;
      ctx.lineWidth = 1.2 + pulse * 0.6;
      ctx.beginPath();
      ctx.arc(px, py, r + 4, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (a.status === 'stopped') {
      ctx.strokeStyle = '#888';
      ctx.lineWidth = Math.max(1, r * 0.18);
      const barH = r * 0.5;
      const barX = r * 0.18;
      ctx.beginPath();
      ctx.moveTo(px - barX, py - barH / 2);
      ctx.lineTo(px - barX, py + barH / 2);
      ctx.moveTo(px + barX, py - barH / 2);
      ctx.lineTo(px + barX, py + barH / 2);
      ctx.stroke();
    }
  }

  private shouldShowPlanetLabel(a: AppNode, isHov: boolean, r: number): boolean {
    if (this.labelMode === 'all') return true;
    if (this.labelMode === 'off') return isHov;
    return isHov || (this.cz > 0.6 && r > 5) || this.cz > 1.2;
  }

  private drawPlanetLabel(a: AppNode, px: number, py: number, r: number, isHov: boolean): void {
    const ctx = this.ctx;
    const label = a.slug || a.raw.displayName || a.raw.name;
    if (!label) return;
    const labelOpacity = a.kind === 'system' ? 0.55 : 0.85;
    ctx.fillStyle = `rgba(255,255,255,${labelOpacity})`;
    ctx.font = `${Math.max(9, 10 * Math.min(1.4, this.cz * 0.9))}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, px, py + r + 12);
    if (a.replicaCount > 1 && (this.cz > 1.4 || isHov)) {
      ctx.fillStyle = 'rgba(159,225,203,0.6)';
      ctx.font = `${Math.max(8, 9 * Math.min(1.4, this.cz * 0.9))}px ui-monospace, monospace`;
      ctx.fillText(`×${a.replicaCount}`, px, py + r + 24);
    }
  }

  private drawPlanet(a: AppNode): void {
    const ctx = this.ctx;
    const p = this.w2s(a.x, a.y);
    const r = Math.max(2, a.r * this.cz);
    if (p.x + r < -15 || p.x - r > this.W + 15 || p.y + r < -15 || p.y - r > this.H + 15) return;

    const isHov = this.hovered === a;
    if (isHov) {
      ctx.fillStyle = a.color + '55';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    const { color: glowColor, boost: glowBoost } = this.resolveGlowStyle(a);
    const glowScale = this.resolveGlowScale(a.replicaCount) * glowBoost;
    this.drawPlanetGlow(a, p.x, p.y, r, glowColor, glowScale);

    const bodyCol = a.status === 'stopped' ? '#444444' : a.color;
    const bg = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 0, p.x, p.y, r);
    bg.addColorStop(0, lighten(bodyCol, 0.4));
    bg.addColorStop(1, bodyCol);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    if (a.kind === 'system') {
      ctx.strokeStyle = 'rgba(122,134,152,0.5)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    this.drawPlanetStatusOverlay(a, p.x, p.y, r);

    if (this.shouldShowPlanetLabel(a, isHov, r)) {
      this.drawPlanetLabel(a, p.x, p.y, r, isHov);
    }
  }

  private drawMoon(a: AppNode, m: MoonNode): void {
    const ctx = this.ctx;
    const mp = this.w2s(m.x, m.y);
    const mr = Math.max(1.5, m.r * this.cz);
    if (mp.x + mr < -10 || mp.x - mr > this.W + 10) return;
    const isHov = this.hovered === a;
    if (isHov) {
      ctx.fillStyle = a.color + '77';
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, mr * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    let mCol = a.color;
    if (a.status === 'error') mCol = '#FF5A6E';
    else if (a.status === 'stopped') mCol = '#444444';
    const mg = ctx.createRadialGradient(mp.x, mp.y, 0, mp.x, mp.y, mr * 1.6);
    mg.addColorStop(0, mCol + '99');
    mg.addColorStop(1, mCol + '00');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mp.x, mp.y, mr * 1.6, 0, Math.PI * 2);
    ctx.fill();
    const bg = ctx.createRadialGradient(mp.x - mr * 0.3, mp.y - mr * 0.3, 0, mp.x, mp.y, mr);
    bg.addColorStop(0, lighten(mCol, 0.5));
    bg.addColorStop(1, mCol);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(mp.x, mp.y, mr, 0, Math.PI * 2);
    ctx.fill();
  }
}

export type { AppNode, GalaxyNode, ServerNode, MoonNode } from './universe-map.types';
export { CATEGORY_COLORS, SYSTEM_COLOR } from './universe-map.types';
