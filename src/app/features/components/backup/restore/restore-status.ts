export function restoreTargetLabel(kind: string | null | undefined): string {
  if (!kind) return 'Unknown';
  const words = String(kind).replaceAll('_', ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
