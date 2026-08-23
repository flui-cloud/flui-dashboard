import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ApplicationService, RemovalPreview } from '../../service/application.service';
import { CatalogService } from '../../service/catalog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AppDeleteDialogComponent } from './app-delete-dialog.component';
import { AppGroupView, Application } from '../../model/application.models';

describe('what the delete dialog says will be lost', () => {
  let fixture: ComponentFixture<AppDeleteDialogComponent>;
  let getRemovalPreview: jasmine.Spy;

  const primary = { id: 'app-1', name: 'immich', slug: 'immich' } as Application;
  const group = {
    id: 'g1',
    name: 'immich',
    slug: 'immich',
    type: 'composed',
    status: 'running',
    catalogInstallId: 'inst-1',
    components: [primary],
  } as unknown as AppGroupView;

  const preview: RemovalPreview = {
    removes: 'catalog-install',
    label: 'Uninstall Immich',
    applications: [{ id: 'app-1', name: 'immich', slug: 'immich' }],
    volumes: [
      {
        name: 'data-immich-postgres-0',
        namespace: 'user-dawit',
        applicationId: 'app-1',
        applicationName: 'immich-postgres',
        requested: '10Gi',
        requestedBytes: 10737418240,
        sizeLabel: '10 GiB',
        storageClass: 'flui-local',
        phase: 'Bound',
        attributedBy: 'volume-claim-template',
      },
    ],
    totalBytes: 10737418240,
    totalLabel: '10 GiB',
    volumesKnown: true,
    dataWarning: 'This also deletes 10 GiB of data in 1 volume. It cannot be undone.',
  };

  const build = async (
    answer: () => Promise<RemovalPreview>,
  ): Promise<void> => {
    getRemovalPreview = jasmine.createSpy('getRemovalPreview').and.callFake(answer);
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AppDeleteDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ApplicationService,
          useValue: {
            getRemovalPreview,
            deleteApplication: jasmine.createSpy('deleteApplication'),
            loadApplications: jasmine.createSpy('loadApplications'),
            trackBundleUninstall: jasmine.createSpy('trackBundleUninstall'),
          },
        },
        { provide: CatalogService, useValue: { uninstall: jasmine.createSpy('uninstall') } },
        { provide: NotificationService, useValue: { add: jasmine.createSpy('add') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppDeleteDialogComponent);
    fixture.componentRef.setInput('group', group);
    fixture.componentRef.setInput('primary', primary);
    fixture.detectChanges();
  };

  const openDialog = async (): Promise<string> => {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    buttons.find((b) => b.textContent?.trim() === 'Delete')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return (fixture.nativeElement.textContent ?? '') as string;
  };

  it('names the size before anything is deleted', async () => {
    await build(async () => preview);
    const text = await openDialog();
    expect(text).toContain('This also deletes 10 GiB of data in 1 volume.');
    expect(text).toContain('data-immich-postgres-0');
    expect(text).toContain('10 GiB');
  });

  it('says the volumes could not be read rather than implying there are none', async () => {
    await build(async () => {
      throw new Error('cluster unreachable');
    });
    const text = await openDialog();
    expect(text).toContain('could not be read');
    expect(text).toContain('Assume data will be lost');
    expect(text).not.toContain('there is no stored data to lose');
  });

  it('says outright when there is genuinely nothing stored', async () => {
    await build(async () => ({
      ...preview,
      volumes: [],
      totalBytes: 0,
      totalLabel: '0 B',
      dataWarning: null,
    }));
    const text = await openDialog();
    expect(text).toContain('there is no stored data to lose');
  });

  it('asks before it reads: the preview is only fetched when the dialog opens', async () => {
    await build(async () => preview);
    expect(getRemovalPreview).not.toHaveBeenCalled();
    await openDialog();
    expect(getRemovalPreview).toHaveBeenCalledWith('app-1');
  });
});
