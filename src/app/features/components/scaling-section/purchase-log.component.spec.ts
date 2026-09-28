import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  InstallLogChunk,
  InstallLogService,
} from '../../service/install-log.service';
import { PurchaseLogComponent } from './purchase-log.component';

describe('the install log of a purchase', () => {
  let fixture: ComponentFixture<PurchaseLogComponent>;

  const answer: InstallLogChunk = {
    operationId: 'op-1',
    status: 'COMPLETED',
    text: 'cloud-init running',
    since: 0,
    next: 18,
    more: false,
    captured: true,
    truncated: false,
    done: true,
    note: null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchaseLogComponent],
      providers: [
        {
          provide: InstallLogService,
          useValue: { readChunk: () => of(answer) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PurchaseLogComponent);
    fixture.componentRef.setInput('operationId', 'op-1');
    fixture.detectChanges();
  });

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const click = async (testid: string): Promise<void> => {
    find(testid)!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 20));
    fixture.detectChanges();
  };

  it('opens the log in place instead of only saving a file', async () => {
    await click('purchase-log');
    expect(find('purchase-log-panel')!.textContent).toContain(
      'cloud-init running',
    );
    expect(find('install-log-download')).not.toBeNull();
  });

  it('closes on a second click', async () => {
    await click('purchase-log');
    await click('purchase-log');
    expect(find('purchase-log-panel')).toBeNull();
  });
});
