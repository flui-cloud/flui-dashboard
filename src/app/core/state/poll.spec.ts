import { DestroyRef } from '@angular/core';
import { poll } from './poll';

class FakeDestroyRef {
  private callbacks: (() => void)[] = [];
  readonly destroyed = false;
  onDestroy(callback: () => void): () => void {
    this.callbacks.push(callback);
    return () => undefined;
  }
  destroy(): void {
    this.callbacks.forEach((c) => c());
  }
  asRef(): DestroyRef {
    return this as unknown as DestroyRef;
  }
}

describe('poll', () => {
  let hidden = false;

  beforeEach(() => {
    jasmine.clock().install();
    hidden = false;
    spyOnProperty(document, 'hidden', 'get').and.callFake(() => hidden);
  });

  afterEach(() => jasmine.clock().uninstall());

  it('ticks on the interval until destroyed', () => {
    const destroyRef = new FakeDestroyRef();
    const tick = jasmine.createSpy('tick');
    poll(tick, 1000, { destroyRef: destroyRef.asRef() });

    jasmine.clock().tick(3000);
    expect(tick).toHaveBeenCalledTimes(3);

    destroyRef.destroy();
    jasmine.clock().tick(3000);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it('pauses while the tab is hidden and catches up when it shows again', () => {
    const tick = jasmine.createSpy('tick');
    poll(tick, 1000, { destroyRef: new FakeDestroyRef().asRef() });

    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    jasmine.clock().tick(5000);
    expect(tick).not.toHaveBeenCalled();

    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(tick).toHaveBeenCalledTimes(1);
    jasmine.clock().tick(1000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('can tick once right away', () => {
    const tick = jasmine.createSpy('tick');
    poll(tick, 1000, { destroyRef: new FakeDestroyRef().asRef(), immediate: true });
    expect(tick).toHaveBeenCalledTimes(1);
  });
});
