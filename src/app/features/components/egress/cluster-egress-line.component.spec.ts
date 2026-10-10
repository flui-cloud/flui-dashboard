import { TestBed } from '@angular/core/testing';
import { ClusterEgressLineComponent } from './cluster-egress-line.component';
import { EgressService, EgressView } from '../../service/egress.service';

describe('the outbound line in the cluster summary', () => {
  async function render(view: EgressView): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [ClusterEgressLineComponent],
      providers: [{ provide: EgressService, useValue: { cluster: () => Promise.resolve(view) } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ClusterEgressLineComponent);
    fixture.componentRef.setInput('clusterId', 'cluster-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('says nothing while outbound traffic is open, as it normally is', async () => {
    const el = await render({ open: true, ports: [], summary: '' });
    expect(el.querySelector('[data-testid="cluster-egress-line"]')).toBeNull();
  });

  it('names the ports when it is limited', async () => {
    const el = await render({
      open: false,
      ports: [
        { port: 80, protocol: 'TCP' },
        { port: 443, protocol: 'TCP' },
      ],
      summary: '',
    });
    expect(el.querySelector('[data-testid="cluster-egress-line"]')?.textContent).toContain('ports 80, 443');
  });
});
