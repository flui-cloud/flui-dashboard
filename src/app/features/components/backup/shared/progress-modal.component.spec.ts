import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BackupService } from '../../../service/backup.service';
import { ActiveOperation } from '../../../model/backup.models';
import { BackupProgressModalComponent } from './progress-modal.component';

const running: ActiveOperation = {
  operationId: 'op-1',
  jobId: 'job-1',
  resourceType: 'backup_job',
  percentage: 0,
  currentStep: '',
  totalSteps: 0,
  message: 'Starting…',
  status: 'running',
  startedAt: 0,
};

describe('BackupProgressModalComponent', () => {
  let fixture: ComponentFixture<BackupProgressModalComponent>;
  const ops = signal<Record<string, ActiveOperation>>({});
  let clearOperation: jasmine.Spy;

  const q = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

  beforeEach(async () => {
    ops.set({ 'op-1': running });
    clearOperation = jasmine.createSpy('clearOperation');
    await TestBed.configureTestingModule({
      imports: [BackupProgressModalComponent],
      providers: [{ provide: BackupService, useValue: { activeOperations: ops, clearOperation } }],
    }).compileComponents();
    fixture = TestBed.createComponent(BackupProgressModalComponent);
    fixture.componentRef.setInput('operationId', 'op-1');
    fixture.detectChanges();
  });

  it('can be dismissed while the run keeps going', () => {
    const closed = jasmine.createSpy('closed');
    fixture.componentInstance.closed.subscribe(closed);
    const button = q('progress-close')!;
    expect(button.textContent).toContain('Keep running in background');
    button.click();
    expect(closed).toHaveBeenCalled();
    expect(clearOperation).toHaveBeenCalledWith('op-1');
  });

  it('shows how the run ended and announces it once', () => {
    const settled = jasmine.createSpy('settled');
    fixture.componentInstance.settled.subscribe(settled);
    ops.set({ 'op-1': { ...running, status: 'completed', partial: true, percentage: 100, detail: 'Left out: data.' } });
    fixture.detectChanges();
    expect(q('progress-partial')!.textContent).toContain('Left out: data.');
    expect(q('progress-close')!.textContent).toContain('Close');
    ops.set({ 'op-1': { ...running, status: 'completed', partial: true, percentage: 100, detail: 'Left out: data.' } });
    fixture.detectChanges();
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('gives the reason a run failed', () => {
    ops.set({ 'op-1': { ...running, status: 'failed', error: 'bucket refused the upload' } });
    fixture.detectChanges();
    expect(q('progress-failed')!.textContent).toContain('bucket refused the upload');
  });
});
