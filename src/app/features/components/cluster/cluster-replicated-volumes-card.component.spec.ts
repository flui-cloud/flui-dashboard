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
      'Enabling keeps copies on w1 and w2 (fsn1 and nbg1).',
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

  function details(el: HTMLElement): string {
    (
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Details'),
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    return (
      el.querySelector('[data-testid="replicated-volumes-details"]')
        ?.textContent ?? ''
    );
  }

  it('names the node that votes when two locations hold the copies', () => {
    const text = details(render(off));
    expect(text).toContain('master casts the tie-breaking vote');
    expect(text).toContain(
      'One copy in each of 2 locations: it survives losing a server or a location, and every write waits for the other location.',
    );
  });

  it('puts a copy in every location, with no vote, when all three hold data', () => {
    const el = render({
      ...off,
      plan: {
        feasible: true,
        zones: ['a', 'b', 'c'],
        storageNodes: ['s1', 's2', 's3'],
        tieBreakers: [],
      },
    });
    expect(el.textContent).toContain(
      'Enabling keeps copies on s1, s2 and s3 (a, b and c).',
    );
    const text = details(el);
    expect(text).not.toContain('tie-breaking');
    expect(text).toContain(
      'One copy in each of 3 locations: it survives losing a server or a location, and every write waits for the other locations.',
    );
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
