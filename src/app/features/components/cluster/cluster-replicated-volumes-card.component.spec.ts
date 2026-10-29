import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  ReplicatedVolumesService,
  ReplicatedVolumesView,
} from '../../service/replicated-volumes.service';
import { ClusterReplicatedVolumesCardComponent } from './cluster-replicated-volumes-card.component';

const off: ReplicatedVolumesView = {
  clusterId: 'c1',
  enabled: false,
  storageClass: 'flui-replicated',
  storageNodes: [],
  warnings: [],
  plan: {
    feasible: true,
    zones: ['fsn1', 'nbg1'],
    storageNodes: ['w1', 'w2'],
    tieBreakers: ['master'],
  },
  operation: null,
};

describe('ClusterReplicatedVolumesCardComponent', () => {
  let fixture: ComponentFixture<ClusterReplicatedVolumesCardComponent>;
  let enable: jasmine.Spy;

  function render(view: ReplicatedVolumesView) {
    enable = jasmine.createSpy('enable').and.returnValue(
      of({
        operationId: 'op',
        storageNodes: ['w1', 'w2'],
        sizeGiB: 20,
      }),
    );
    TestBed.configureTestingModule({
      imports: [ClusterReplicatedVolumesCardComponent],
      providers: [
        {
          provide: ReplicatedVolumesService,
          useValue: { get: () => of(view), enable },
        },
      ],
    });
    fixture = TestBed.createComponent(ClusterReplicatedVolumesCardComponent);
    fixture.componentRef.setInput('clusterId', 'c1');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('says where the copies would go and asks twice before enabling', () => {
    const el = render(off);
    expect(el.textContent).toContain(
      'Enabling keeps copies on w1 and w2 (fsn1, nbg1).',
    );
    const button = el.querySelector(
      '[data-testid="replicated-volumes-enable"]',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(enable).not.toHaveBeenCalled();
    expect(button.textContent).toContain('Confirm');
    button.click();
    expect(enable).toHaveBeenCalledWith('c1');
  });

  it('shows the copies and the warnings once on, without an enable button', () => {
    const el = render({
      ...off,
      enabled: true,
      storageNodes: ['w1', 'w2'],
      warnings: ['master holds copies but takes no applications.'],
    });
    expect(el.textContent).toContain(
      'Copies on w1 and w2, one in each location.',
    );
    expect(el.textContent).toContain('takes no applications');
    expect(
      el.querySelector('[data-testid="replicated-volumes-enable"]'),
    ).toBeNull();
  });

  it('gives the reason when it is not possible', () => {
    const el = render({
      ...off,
      plan: { feasible: false, reason: 'No two nodes in one location.' },
    });
    expect(el.textContent).toContain(
      'Not possible yet: No two nodes in one location.',
    );
    expect(
      el.querySelector('[data-testid="replicated-volumes-enable"]'),
    ).toBeNull();
  });
});
