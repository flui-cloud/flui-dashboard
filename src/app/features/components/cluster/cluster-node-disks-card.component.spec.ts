import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  NodeDisksService,
  NodeDisksView,
} from '../../service/node-disks.service';
import { ClusterNodeDisksCardComponent } from './cluster-node-disks-card.component';

const view: NodeDisksView = {
  measuredAt: '2026-10-29T14:00:00Z',
  nodes: [
    {
      node: 'lab-worker-1',
      zone: 'nbg1',
      disk: { totalGiB: 40, freeGiB: 4 },
      copies: { totalGiB: 20, freeGiB: 15 },
    },
    {
      node: 'lab-worker-3',
      zone: 'hel1',
      disk: { totalGiB: 40, freeGiB: 30 },
      copies: null,
    },
  ],
  warnings: [
    'lab-worker-1 has 4 of 40 GiB free on its disk: databases and other data kept on the node stop growing when it is full.',
  ],
};

describe('ClusterNodeDisksCardComponent', () => {
  let fixture: ComponentFixture<ClusterNodeDisksCardComponent>;

  function render() {
    TestBed.configureTestingModule({
      imports: [ClusterNodeDisksCardComponent],
      providers: [
        { provide: NodeDisksService, useValue: { get: () => of(view) } },
      ],
    });
    fixture = TestBed.createComponent(ClusterNodeDisksCardComponent);
    fixture.componentRef.setInput('clusterId', 'c1');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists each node with the room left on its disk and for copies', () => {
    const el = render();
    expect(el.textContent).toContain('4 of 40 GiB free');
    expect(el.textContent).toContain('15 of 20 GiB free');
    expect(el.textContent).toContain('—');
  });

  it('shows the warning of a node running short', () => {
    const el = render();
    expect(el.textContent).toContain(
      'lab-worker-1 has 4 of 40 GiB free on its disk',
    );
  });
});
