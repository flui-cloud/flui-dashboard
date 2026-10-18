import { PanZoom } from './topology-pan-zoom';

const box = { left: 0, top: 0, width: 1000, height: 600 } as DOMRect;

describe('PanZoom', () => {
  it('fits a drawing in the box, centred, never past 125 %', () => {
    const view = new PanZoom();
    view.fit(box, { width: 100, height: 100 });
    expect(view.scale()).toBe(1.25);
    view.fit(box, { width: 1936, height: 400 });
    expect(view.scale()).toBeCloseTo(0.5);
    expect(view.offset().x).toBeCloseTo((1000 - 1936 * 0.5) / 2);
  });

  it('keeps the zoom between 20 % and 300 %', () => {
    const view = new PanZoom();
    for (let i = 0; i < 40; i++) view.step(1.2);
    expect(view.scale()).toBe(3);
    for (let i = 0; i < 40; i++) view.step(1 / 1.2);
    expect(view.scale()).toBe(0.2);
  });

  it('zooms around the pointer, so the point under it stays put', () => {
    const view = new PanZoom();
    const event = { clientX: 300, clientY: 200, deltaY: -1, preventDefault: () => undefined } as WheelEvent;
    view.wheel(event, box);
    const s = view.scale();
    const o = view.offset();
    expect((300 - o.x) / s).toBeCloseTo(300);
    expect((200 - o.y) / s).toBeCloseTo(200);
  });

  it('drags only between a press and a release', () => {
    const view = new PanZoom();
    view.move({ clientX: 50, clientY: 50 } as PointerEvent);
    expect(view.offset()).toEqual({ x: 0, y: 0 });
    view.start({ clientX: 10, clientY: 10 } as PointerEvent);
    view.move({ clientX: 40, clientY: 30 } as PointerEvent);
    expect(view.offset()).toEqual({ x: 30, y: 20 });
    view.end();
    view.move({ clientX: 90, clientY: 90 } as PointerEvent);
    expect(view.offset()).toEqual({ x: 30, y: 20 });
  });
});
