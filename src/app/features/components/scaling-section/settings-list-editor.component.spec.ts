import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListChoice, SettingsListEditorComponent } from './settings-list-editor.component';
import { ARM_WARNING } from '../../../shared/components/architecture-badge.component';

describe('the machine list of a scaling group', () => {
  let fixture: ComponentFixture<SettingsListEditorComponent>;

  const find = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  function render(items: string[], choices: ListChoice[], architectures: Record<string, string | null>): void {
    TestBed.configureTestingModule({ imports: [SettingsListEditorComponent] });
    fixture = TestBed.createComponent(SettingsListEditorComponent);
    fixture.componentRef.setInput('kind', 'machine');
    fixture.componentRef.setInput('ordered', true);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('choices', choices);
    fixture.componentRef.setInput('architectures', architectures);
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('names the architecture beside each listed machine', () => {
    render(['cx33'], [], { cx33: 'x86' });
    expect(find('machine-cx33')?.querySelector('[data-testid="architecture-badge"]')?.textContent?.trim()).toBe('x86');
  });

  it('puts the architecture first in each option', () => {
    render([], [{ value: 'cx33', label: 'cx33', note: '4 vCPU · 8 GB', architecture: 'x86' }], {});
    expect(find('machine-option-cx33')?.textContent?.trim()).toBe('cx33 — x86 · 4 vCPU · 8 GB');
  });

  it('offers an arm machine like any other, with the warning on hover', () => {
    render([], [
      { value: 'cx33', label: 'cx33', architecture: 'x86' },
      { value: 'cax21', label: 'cax21', architecture: 'arm', warning: ARM_WARNING },
    ], {});
    const arm = find('machine-option-cax21') as HTMLOptionElement;
    expect(arm.disabled).toBeFalse();
    expect(arm.getAttribute('title')).toBe(ARM_WARNING);
    expect((find('machine-option-cx33') as HTMLOptionElement).disabled).toBeFalse();
    expect(find('machine-warning')).toBeNull();
  });

  it('counts an arm machine as something left to add', () => {
    render([], [{ value: 'cax21', label: 'cax21', architecture: 'arm', warning: ARM_WARNING }], {});
    expect((find('machine-add') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('says the warning once when an arm machine is listed', () => {
    render(['cax21', 'cax31'], [], { cax21: 'arm', cax31: 'arm' });
    expect(find('machine-warning')?.textContent?.trim()).toBe(ARM_WARNING);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="machine-warning"]').length).toBe(1);
  });

  it('says nothing when only x86 machines are listed', () => {
    render(['cx33'], [], { cx33: 'x86' });
    expect(find('machine-warning')).toBeNull();
  });
});
