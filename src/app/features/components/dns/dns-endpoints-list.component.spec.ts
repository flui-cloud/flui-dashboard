import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DnsEndpointsListComponent } from './dns-endpoints-list.component';
import { AppEndpointResponseDto } from '../../../core/api/model/appEndpointResponseDto';
import { PermissionService } from '../../../core/services/permission.service';

describe('deleting a published address', () => {
  let fixture: ComponentFixture<DnsEndpointsListComponent>;

  const endpoint = {
    id: 'ep-1',
    fqdn: 'shop.example.com',
    serviceName: 'shop-svc',
    k8sNamespace: 'user-a1b2c3',
    tlsEnabled: true,
    dnsRecordType: 'A',
    reconciliationStatus: 'IN_SYNC',
    certificateRequired: false,
  } as unknown as AppEndpointResponseDto;

  async function mount(options: {
    can: boolean;
    writable?: boolean;
  }): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DnsEndpointsListComponent],
      providers: [
        { provide: PermissionService, useValue: { can: () => options.can } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DnsEndpointsListComponent);
    fixture.componentRef.setInput('endpoints', [endpoint]);
    if (options.writable !== undefined) {
      fixture.componentRef.setInput('writable', options.writable);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const deleteButton = (): HTMLElement | null =>
    fixture.nativeElement.querySelector('[data-testid="endpoint-delete-ep-1"]');

  afterEach(() => TestBed.resetTestingModule());

  // First, so the two refusals below prove gates and not an empty list.
  it('offers the delete control when both halves say yes', async () => {
    await mount({ can: true });
    expect(deleteButton()).not.toBeNull();
  });

  it('withholds it from a principal without app:write', async () => {
    await mount({ can: false });
    expect(fixture.nativeElement.textContent).toContain('shop.example.com');
    expect(deleteButton()).toBeNull();
  });

  it('withholds it on an application the caller may only read', async () => {
    await mount({ can: true, writable: false });
    expect(fixture.nativeElement.textContent).toContain('shop.example.com');
    expect(deleteButton()).toBeNull();
  });

  it('leaves Edit and Sync alone — their routes ask for nothing this can read', async () => {
    await mount({ can: false });
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).map((b) => (b as HTMLButtonElement).textContent?.trim());
    expect(labels).toContain('Edit');
    expect(labels).toContain('Sync');
  });
});
