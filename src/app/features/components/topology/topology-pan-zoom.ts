import { signal } from '@angular/core';

const MIN = 0.2;
const MAX = 3;

/** Pan and zoom of a drawing inside a box: one transform, kept as signals. */
export class PanZoom {
  readonly scale = signal(1);
  readonly offset = signal({ x: 0, y: 0 });
  private from: { x: number; y: number } | null = null;

  readonly transform = () => `translate(${this.offset().x}px,${this.offset().y}px) scale(${this.scale()})`;

  /** The whole drawing in the box, centred, never enlarged past 125 %. */
  fit(box: DOMRect, size: { width: number; height: number }): void {
    if (!size.width || !box.width) return;
    const scale = Math.min(1.25, (box.width - 32) / size.width, (box.height - 72) / size.height);
    this.scale.set(scale);
    this.offset.set({
      x: (box.width - size.width * scale) / 2,
      y: 48 + (box.height - 64 - size.height * scale) / 2,
    });
  }

  step(factor: number): void {
    this.scale.update((s) => clamp(s * factor));
  }

  /** Zooms around the pointer, so what is under it stays under it. */
  wheel(event: WheelEvent, box: DOMRect): void {
    event.preventDefault();
    const before = this.scale();
    const after = clamp(before * (event.deltaY < 0 ? 1.1 : 1 / 1.1));
    const cx = event.clientX - box.left;
    const cy = event.clientY - box.top;
    this.offset.update((o) => ({ x: cx - ((cx - o.x) * after) / before, y: cy - ((cy - o.y) * after) / before }));
    this.scale.set(after);
  }

  start(event: PointerEvent): void {
    this.from = { x: event.clientX - this.offset().x, y: event.clientY - this.offset().y };
  }

  move(event: PointerEvent): void {
    if (this.from) this.offset.set({ x: event.clientX - this.from.x, y: event.clientY - this.from.y });
  }

  end(): void {
    this.from = null;
  }
}

function clamp(scale: number): number {
  return Math.min(MAX, Math.max(MIN, scale));
}
