import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { ConfirmOptions, FlConfirmDialog } from './confirm';

function render(options: ConfirmOptions) {
  const close = jasmine.createSpy('close');
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: options },
      { provide: DialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(FlConfirmDialog);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const confirm = () =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === options.confirmLabel)!;
  return { fixture, el, close, confirm };
}

describe('FlConfirmDialog', () => {
  const base = {
    title: 'Delete cluster',
    body: 'Gone.',
    confirmLabel: 'Delete cluster',
    destructive: true,
  };

  it('keeps the action disabled until the resource name is typed', () => {
    const { fixture, el, confirm } = render({ ...base, typeToConfirm: 'prod-eu-1' });
    expect(confirm().disabled).toBeTrue();

    const input = el.querySelector('input')!;
    input.value = 'prod-eu-1';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirm().disabled).toBeFalse();
  });

  it('answers true on confirm and false on cancel', () => {
    const { el, close, confirm } = render(base);
    confirm().click();
    expect(close).toHaveBeenCalledWith(true);
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Cancel')!.click();
    expect(close).toHaveBeenCalledWith(false);
  });
});
