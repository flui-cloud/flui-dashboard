import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ImagesService } from '../../../core/api/api/images.service';
import { ApplicationKind, suggestKindFromImageRef } from '../../model/application.models';
import { DeployWizardForm } from './deploy-wizard.state';

@Injectable()
export class DeployWizardImage {
  private readonly form = inject(DeployWizardForm);
  private readonly imagesApi = inject(ImagesService);

  setKind(kind: ApplicationKind): void {
    this.form.selectedKind.set(kind);
  }

  onImageSelected(imageRef: string): void {
    this.form.selectedImageRef.set(imageRef);
    this.form.selectedKind.set(suggestKindFromImageRef(imageRef));
  }

  clearImageRef(): void {
    this.form.selectedImageRef.set('');
  }

  async inspectImagePorts(): Promise<void> {
    const f = this.form;
    const imageRef = f.selectedImageRef();
    if (!imageRef || imageRef === f.portDiscoveredFrom()) return;

    f.portDiscovering.set(true);
    try {
      const result = await firstValueFrom(this.imagesApi.imagesControllerInspect(imageRef));
      f.portDiscoveredFrom.set(imageRef);
      f.exposedPorts.set(result.exposedPorts ?? []);

      if (f.appPort() === null && result.suggestedPort) {
        f.appPort.set(result.suggestedPort);
        f.portAutoDetected.set(true);
      }
    } catch {
      return;
    } finally {
      f.portDiscovering.set(false);
    }
  }

  async loadProfiles(): Promise<void> {
    const f = this.form;
    f.loadingProfiles.set(true);
    try {
      const res = await firstValueFrom(this.imagesApi.imagesControllerGetProfiles());
      f.availableProfiles.set(res.profiles);
      f.selectedProfile.set(res.defaultProfile);
    } catch {
      return;
    } finally {
      f.loadingProfiles.set(false);
    }
  }

  buildHealthProbe(): object | null {
    const f = this.form;
    const type = f.probeType();
    if (type === 'none') return { type: 'none' };
    if (type === 'http')
      return {
        type: 'http',
        httpPath: f.probeHttpPath(),
        httpPort: f.appPort() ?? undefined,
        initialDelaySeconds: f.probeInitialDelay(),
        periodSeconds: f.probePeriod(),
        failureThreshold: f.probeFailureThreshold(),
      };
    if (type === 'tcp')
      return {
        type: 'tcp',
        tcpPort: f.appPort() ?? undefined,
        initialDelaySeconds: f.probeInitialDelay(),
      };
    return null;
  }
}
