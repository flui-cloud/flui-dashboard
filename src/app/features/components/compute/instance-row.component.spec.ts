import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { mapClusterNodeToInstance } from '../../model/instance.models';
import { InstanceRowComponent } from './instance-row.component';

describe('a server row', () => {
  let fixture: ComponentFixture<InstanceRowComponent>;

  function render(architecture: 'x86' | 'arm' | null): void {
    TestBed.configureTestingModule({
      imports: [InstanceRowComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(InstanceRowComponent);
    fixture.componentInstance.instance = mapClusterNodeToInstance(
      { id: 'n-1', serverName: 'worker', nodeType: 'worker', status: 'ready', serverType: 'cx33', architecture },
      'c-1',
    );
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  const badge = (): HTMLElement | null =>
    fixture.nativeElement.querySelector('[data-testid="architecture-badge"]');

  it('names the architecture the cluster reports for the node', () => {
    render('x86');
    expect(badge()?.textContent?.trim()).toBe('x86');
  });

  it('names an arm node as Arm', () => {
    render('arm');
    expect(badge()?.textContent?.trim()).toBe('Arm');
  });

  it('says nothing where the architecture is not known', () => {
    render(null);
    expect(badge()).toBeNull();
  });
});
