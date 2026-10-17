import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ArchitectureBadgeComponent,
  architectureLabel,
  ARM_WARNING,
  architectureWarning,
} from './architecture-badge.component';

describe('the CPU architecture badge', () => {
  let fixture: ComponentFixture<ArchitectureBadgeComponent>;

  const badge = (): HTMLElement | null =>
    fixture.nativeElement.querySelector('[data-testid="architecture-badge"]');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ArchitectureBadgeComponent] }).compileComponents();
    fixture = TestBed.createComponent(ArchitectureBadgeComponent);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('reads x86 as x86', () => {
    fixture.componentRef.setInput('architecture', 'x86');
    fixture.detectChanges();
    expect(badge()?.textContent?.trim()).toBe('x86');
  });

  it('reads arm as Arm', () => {
    fixture.componentRef.setInput('architecture', 'arm');
    fixture.detectChanges();
    expect(badge()?.textContent?.trim()).toBe('Arm');
  });

  it('shows nothing where the architecture is not known', () => {
    fixture.componentRef.setInput('architecture', null);
    fixture.detectChanges();
    expect(badge()).toBeNull();
  });

  it('labels only the two known architectures', () => {
    expect(architectureLabel('x86')).toBe('x86');
    expect(architectureLabel('arm')).toBe('Arm');
    expect(architectureLabel('riscv')).toBeNull();
    expect(architectureLabel(undefined)).toBeNull();
  });

  it('warns about arm servers only', () => {
    expect(ARM_WARNING).toBe(
      'Arm server: apps deployed from a repository are built for x86 and will not run on it. Catalog apps run normally.',
    );
    expect(architectureWarning('arm')).toBe(ARM_WARNING);
    expect(architectureWarning('x86')).toBeNull();
    expect(architectureWarning(null)).toBeNull();
  });
});
