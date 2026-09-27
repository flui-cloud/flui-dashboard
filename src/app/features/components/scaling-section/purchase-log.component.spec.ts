import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { InstallLogService } from '../../service/install-log.service';
import { PurchaseLogComponent } from './purchase-log.component';

describe('the install log of a purchase', () => {
  let fixture: ComponentFixture<PurchaseLogComponent>;

  const build = async (answer: Observable<Blob>): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [PurchaseLogComponent],
      providers: [
        { provide: InstallLogService, useValue: { download: () => answer } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PurchaseLogComponent);
    fixture.componentRef.setInput('operationId', 'op-1');
    fixture.detectChanges();
  };

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const click = async (testid: string): Promise<void> => {
    find(testid)!.click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 20));
    fixture.detectChanges();
  };

  it('opens the log in place instead of only saving a file', async () => {
    await build(of(new Blob(['cloud-init running'])));
    await click('purchase-log');
    expect(find('purchase-log-panel')!.textContent).toContain(
      'cloud-init running',
    );
    expect(find('purchase-log-download')).not.toBeNull();
  });

  it('says so when the log cannot be read', async () => {
    await build(throwError(() => new Error('502')));
    await click('purchase-log');
    expect(find('purchase-log-panel')!.textContent).toContain(
      'could not be read',
    );
  });

  it('closes on a second click', async () => {
    await build(of(new Blob(['x'])));
    await click('purchase-log');
    await click('purchase-log');
    expect(find('purchase-log-panel')).toBeNull();
  });
});
