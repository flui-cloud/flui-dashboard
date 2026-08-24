import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { ImageRegistryFeatureService } from './image-registry.service';
import { BuildCacheService } from './build-cache.service';
import { ImageRegistryService } from '../../core/api/api/imageRegistry.service';
import { BuildNamespaceService } from '../../core/api/api/buildNamespace.service';
import { InfrastructureWebSocketService } from './infrastructure-websocket.service';

/**
 * A refusal and a failure must not land on the same signal.
 *
 * Both screens below are closed to a guest of the demo by design, and both used
 * to render the fence's own sentence inside a red destructive banner — which is
 * how a person learns that the product is broken instead of that this is not
 * part of their trial.
 */
const refusal = (message: string) => ({
  status: 403,
  error: { statusCode: 403, code: 'SANDBOX_ROUTE_FORBIDDEN', message },
});

const FENCE_SAYS =
  'This part of Flui is not included in the trial. Your own applications and databases are real and yours to change.';

describe('a refused screen does not look like a broken one', () => {
  describe('the image registry', () => {
    let service: ImageRegistryFeatureService;
    let listImages: jasmine.Spy;

    beforeEach(() => {
      listImages = jasmine.createSpy('listImages');
      TestBed.configureTestingModule({
        providers: [
          {
            provide: ImageRegistryService,
            useValue: { imageRegistryControllerListImages: listImages },
          },
        ],
      });
      service = TestBed.inject(ImageRegistryFeatureService);
    });

    afterEach(() => TestBed.resetTestingModule());

    it('records a refusal as a refusal and leaves the error banner empty', async () => {
      listImages.and.returnValue(throwError(() => refusal(FENCE_SAYS)));

      await service.loadImages().catch(() => undefined);

      expect(service.refused()).toBe(true);
      expect(service.refusalMessage()).toBe(FENCE_SAYS);
      expect(service.errorMessage()).toBeNull();
    });

    it('still shows a genuine failure in the error banner', async () => {
      listImages.and.returnValue(
        throwError(() => ({ status: 500, error: { message: 'Database is down' } })),
      );

      await service.loadImages().catch(() => undefined);

      expect(service.refused()).toBe(false);
      expect(service.errorMessage()).toBe('Database is down');
    });

    it('lets go of the refusal when the state is cleared, so a retry starts clean', async () => {
      listImages.and.returnValue(throwError(() => refusal(FENCE_SAYS)));
      await service.loadImages().catch(() => undefined);
      expect(service.refused()).toBe(true);

      service.clearError();

      expect(service.refused()).toBe(false);
      expect(service.refusalMessage()).toBeNull();
      expect(service.errorMessage()).toBeNull();
    });
  });

  describe('the build cache', () => {
    let service: BuildCacheService;
    let getCacheInfo: jasmine.Spy;

    beforeEach(() => {
      getCacheInfo = jasmine.createSpy('getCacheInfo');
      TestBed.configureTestingModule({
        providers: [
          {
            provide: BuildNamespaceService,
            useValue: { buildNamespaceControllerGetCacheInfo: getCacheInfo },
          },
          {
            provide: InfrastructureWebSocketService,
            useValue: { connect: () => undefined, disconnect: () => undefined },
          },
        ],
      });
      service = TestBed.inject(BuildCacheService);
    });

    afterEach(() => TestBed.resetTestingModule());

    it('records a refusal as a refusal and leaves the error banner empty', async () => {
      getCacheInfo.and.returnValue(throwError(() => refusal(FENCE_SAYS)));

      await service.loadCacheStatus('cluster-1');

      expect(service.refusal()).toBe(FENCE_SAYS);
      expect(service.statusError()).toBeNull();
    });

    it('still shows a genuine failure in the error banner', async () => {
      getCacheInfo.and.returnValue(
        throwError(() => ({ status: 500, error: { message: 'No kubeconfig on file' } })),
      );

      await service.loadCacheStatus('cluster-1');

      expect(service.refusal()).toBeNull();
      expect(service.statusError()).toBe('No kubeconfig on file');
    });
  });
});
