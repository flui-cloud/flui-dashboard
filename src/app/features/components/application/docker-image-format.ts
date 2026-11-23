import { DockerHubTagDto } from '../../../core/api/model/dockerHubTagDto';
import { StatusTone } from '../../../ui/primitives/status';

export function formatCount(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return (bytes / 1_073_741_824).toFixed(1) + ' GB';
  if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(1) + ' MB';
  return (bytes / 1_024).toFixed(1) + ' KB';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function deployHintLabel(hint: DockerHubTagDto['deployHint']): string {
  switch (hint) {
    case 'needs-sidecar':
      return 'Requires reverse proxy';
    case 'cli-tool':
      return 'CLI tool only';
    case 'build-image':
      return 'Build image only';
    case 'base-os':
      return 'Base image';
    default:
      return hint;
  }
}

export function deployHintTone(hint: DockerHubTagDto['deployHint']): StatusTone {
  if (hint === 'deployable') return 'success';
  return hint === 'needs-sidecar' ? 'warning' : 'error';
}
