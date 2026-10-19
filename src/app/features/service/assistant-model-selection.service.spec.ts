import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { AssistantModelSelectionService } from './assistant-model-selection.service';
import { InferenceSettingsService } from './inference-settings.service';
import { SandboxService } from '../../core/services/sandbox.service';

describe('AssistantModelSelectionService', () => {
  const inSandbox = signal(false);
  const providers = signal([
    { provider: 'scaleway', configured: true, euDataResidency: true, models: ['deepseek-v4-flash-0731', 'gpt-oss-120b'], defaultModel: 'deepseek-v4-flash-0731' },
  ]);
  const recommendations = signal({
    recommendedProvider: { key: 'scaleway', label: 'Scaleway', reason: 'EU', defaultModel: 'deepseek-v4-flash-0731' },
    groups: [
      {
        key: 'scaleway',
        matchProvider: 'scaleway',
        models: [
          { model: 'deepseek-v4-flash-0731', description: 'default', isDefault: true },
          { model: 'gpt-oss-120b', description: 'alternative' },
        ],
      },
    ],
  });

  const inference = {
    configuredProviders: computed(() => providers()),
    connections: signal([{ id: 'c1', label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', models: ['mistral-small-2603'], isDefault: false }]),
    recommendations,
    groupFor(opts: { provider?: string } | null) {
      return opts?.provider ? recommendations().groups.find((g) => g.matchProvider === opts.provider) : undefined;
    },
    recommendedModelFor(opts: { provider?: string; model?: string } | null) {
      return this.groupFor(opts)?.models.find((m) => m.model === opts?.model);
    },
  };

  function create(): AssistantModelSelectionService {
    TestBed.configureTestingModule({
      providers: [
        AssistantModelSelectionService,
        { provide: InferenceSettingsService, useValue: inference },
        { provide: SandboxService, useValue: { inSandbox } },
      ],
    });
    const service = TestBed.inject(AssistantModelSelectionService);
    TestBed.tick();
    return service;
  }

  beforeEach(() => localStorage.removeItem('flui.assistant.modelSelection'));

  it('preselects the recommended default and keeps a BYO connection selectable', () => {
    inSandbox.set(false);
    const service = create();
    expect(service.selectedOpts()).toEqual({ provider: 'scaleway', model: 'deepseek-v4-flash-0731' });
    expect(service.featuredOptions().map((o) => o.modelId)).toEqual(['deepseek-v4-flash-0731', 'gpt-oss-120b']);
    expect(service.otherOptions().map((o) => o.modelId)).toEqual(['mistral-small-2603']);
  });

  it('gives a demo guest no choice: one option, nothing sent, a stored pick ignored', () => {
    localStorage.setItem('flui.assistant.modelSelection', JSON.stringify({ connectionId: 'c1', model: 'mistral-small-2603' }));
    inSandbox.set(true);
    const service = create();
    expect(service.pickerOptions()).toHaveSize(1);
    expect(service.selectedOpts()).toBeNull();
    expect(service.recommendedHint()).toBeNull();
    service.select(2);
    expect(service.selectedOpts()).toBeNull();
  });
});
