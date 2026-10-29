import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  NodeResizePreview,
  NodeResizeService,
} from '../../service/node-resize.service';
import { NodeDisksService } from '../../service/node-disks.service';
import { ResizeNodeDialogComponent } from './resize-node-dialog.component';

const preview = (refusal: string | null = null): NodeResizePreview => ({
  node: {
    id: 'n-1',
    name: 'w1',
    nodeType: 'worker',
    currentServerType: 'cx22',
  },
  affectedDedicatedApps: [{ id: 'a', slug: 'orders-db' }],
  expectedDowntimeMs: 240000,
  warning: '',
  candidates: [
    {
      name: 'cx22',
      direction: 'current',
      cores: 2,
      memoryGb: 4,
      diskGb: 40,
      monthlyCostEur: '4.00',
      monthlyDeltaEur: '0.00',
    },
    {
      name: 'cx32',
      direction: 'upgrade',
      cores: 4,
      memoryGb: 8,
      diskGb: 80,
      monthlyCostEur: '7.00',
      monthlyDeltaEur: '3.00',
    },
  ],
  highAvailability: {
    refusal,
    switchovers: [
      { namespace: 'p', cluster: 'orders-db-ha', target: 'orders-db-ha-2' },
    ],
  },
});

describe('ResizeNodeDialogComponent', () => {
  let fixture: ComponentFixture<ResizeNodeDialogComponent>;
  let resize: jasmine.Spy;

  function render(p: NodeResizePreview, provider = 'hetzner', copies = true) {
    resize = jasmine
      .createSpy('resize')
      .and.returnValue(of({ id: 'op-1', status: 'PENDING' }));
    TestBed.configureTestingModule({
      imports: [ResizeNodeDialogComponent],
      providers: [
        {
          provide: NodeResizeService,
          useValue: { preview: () => of(p), resize },
        },
        {
          provide: NodeDisksService,
          useValue: {
            get: () =>
              of({
                measuredAt: 'x',
                warnings: [],
                nodes: [
                  {
                    node: 'w1',
                    zone: 'nbg1',
                    disk: null,
                    copies: copies ? { totalGiB: 20, freeGiB: 10 } : null,
                  },
                ],
              }),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ResizeNodeDialogComponent);
    fixture.componentRef.setInput('clusterId', 'c1');
    fixture.componentRef.setInput('nodeId', 'n-1');
    fixture.componentRef.setInput('nodeName', 'w1');
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('offers the next bigger type, what stops and which primary moves first', () => {
    const el = render(preview());
    expect(fixture.componentInstance.target()).toBe('cx32');
    expect(el.textContent).toContain('Stops while the node is off: orders-db');
    expect(el.textContent).toContain(
      'The primary of orders-db-ha moves to orders-db-ha-2 first',
    );
  });

  it('cannot be confirmed while the cluster refuses it, and says why', () => {
    const el = render(
      preview(
        'w3 is not ready: switching off w1 now would leave the cluster without the majority it needs to keep running.',
      ),
    );
    expect(
      el.querySelector('[data-testid="resize-refusal"]')!.textContent,
    ).toContain('w3 is not ready');
    expect(
      (el.querySelector('[data-testid="resize-confirm"]') as HTMLButtonElement)
        .disabled,
    ).toBeTrue();
  });

  it('offers growing the disk on Hetzner only, and the space for copies only where the node holds some', () => {
    let el = render(preview(), 'scaleway', false);
    expect(el.querySelector('[data-testid="resize-upgrade-disk"]')).toBeNull();
    expect(el.querySelector('[data-testid="resize-copies"]')).toBeNull();
    TestBed.resetTestingModule();
    el = render(preview(), 'hetzner', true);
    expect(
      el.querySelector('[data-testid="resize-upgrade-disk"]'),
    ).not.toBeNull();
    expect(el.querySelector('[data-testid="resize-copies"]')).not.toBeNull();
  });

  it('queues the resize with what was chosen', () => {
    render(preview());
    fixture.componentInstance.upgradeDisk.set(true);
    fixture.componentInstance.copiesGiB.set(40);
    fixture.componentInstance.resize();
    fixture.detectChanges();
    expect(resize).toHaveBeenCalledWith('c1', 'n-1', {
      targetServerType: 'cx32',
      upgradeDisk: true,
      copiesGiB: 40,
    });
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="resize-done"]',
      )!.textContent,
    ).toContain('Resize queued');
  });
});
