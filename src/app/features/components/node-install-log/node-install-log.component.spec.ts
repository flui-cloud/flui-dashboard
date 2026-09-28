import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import {
  InstallLogChunk,
  InstallLogService,
} from '../../service/install-log.service';
import { NodeInstallLogComponent } from './node-install-log.component';

const chunk = (over: Partial<InstallLogChunk>): InstallLogChunk => ({
  operationId: 'op-1',
  status: 'IN_PROGRESS',
  text: '',
  since: 0,
  next: 0,
  more: false,
  captured: true,
  truncated: false,
  done: false,
  note: null,
  ...over,
});

describe('a node install log followed live', () => {
  let fixture: ComponentFixture<NodeInstallLogComponent>;
  let asked: number[];

  const build = async (
    answer: (since: number) => Observable<InstallLogChunk>,
  ): Promise<void> => {
    asked = [];
    await TestBed.configureTestingModule({
      imports: [NodeInstallLogComponent],
      providers: [
        {
          provide: InstallLogService,
          useValue: {
            readChunk: (_id: string, since: number) => {
              asked.push(since);
              return answer(since);
            },
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NodeInstallLogComponent);
    fixture.componentRef.setInput('operationId', 'op-1');
    fixture.componentRef.setInput('intervalMs', 10);
    fixture.detectChanges();
  };

  const settle = async (ms = 60): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    fixture.detectChanges();
  };

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  afterEach(() => fixture?.destroy());

  it('reads on from the cursor and stops once the operation is done', async () => {
    const script = [
      chunk({ text: 'one\n', next: 4 }),
      chunk({ text: 'two\n', since: 4, next: 8, more: true }),
      chunk({
        text: 'three\n',
        since: 8,
        next: 14,
        status: 'COMPLETED',
        done: true,
      }),
    ];
    await build(() => of(script.shift() ?? chunk({ done: true })));
    await settle();
    expect(asked).toEqual([0, 4, 8]);
    expect(find('install-log-text')!.textContent).toBe('one\ntwo\nthree\n');
    expect(find('install-log-state')!.textContent).toContain('Finished');
    expect(find('install-log-pause')).toBeNull();
  });

  it('keeps polling while the node installs and stops when paused', async () => {
    await build((since) => of(chunk({ since, next: since })));
    await settle();
    expect(asked.length).toBeGreaterThan(1);
    find('install-log-pause')!.click();
    fixture.detectChanges();
    const count = asked.length;
    await settle();
    expect(asked).toHaveSize(count);
    expect(find('install-log-state')!.textContent).toContain('Paused');
    find('install-log-pause')!.click();
    await settle();
    expect(asked.length).toBeGreaterThan(count);
  });

  it('stops following the end when the person scrolls up, and offers to jump back', async () => {
    const long = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n');
    await build(() => of(chunk({ text: long, next: long.length })));
    await settle(20);
    fixture.componentRef.setInput('intervalMs', 100000);
    const box = find('install-log-text')!;
    box.scrollTop = 0;
    box.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(find('install-log-jump')).not.toBeNull();
    find('install-log-jump')!.click();
    fixture.detectChanges();
    expect(box.scrollTop).toBeGreaterThan(0);
  });

  it('shows the reason when nothing was captured', async () => {
    await build(() =>
      of(
        chunk({
          captured: false,
          done: true,
          status: 'FAILED',
          note: 'No install log was captured',
        }),
      ),
    );
    await settle();
    expect(find('install-log-note')!.textContent).toContain(
      'No install log was captured',
    );
  });

  it('says so when the log cannot be read, and keeps trying', async () => {
    await build(() => throwError(() => new HttpErrorResponse({ status: 502 })));
    await settle();
    expect(find('install-log-error')!.textContent).toContain(
      'could not be read',
    );
    expect(asked.length).toBeGreaterThan(1);
  });

  it('gives up on an operation that does not exist', async () => {
    await build(() => throwError(() => new HttpErrorResponse({ status: 404 })));
    await settle();
    expect(asked).toHaveSize(1);
    expect(find('install-log-error')!.textContent).toContain('not found');
  });
});
