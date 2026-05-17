import { CatalogUserInputPromptDto } from '../../core/api/model/catalogUserInputPromptDto';

export type PromptInputType = 'text' | 'email' | 'url' | 'password';

/**
 * Picks the HTML input type for a catalog user-input prompt. `sensitive` and
 * `format: 'password'` both map to password; native types (email, url) are
 * used when requested to engage browser UA validation as a safety net, but
 * `validatePrompt` is the source of truth for submit-gating.
 */
export function pickInputType(prompt: CatalogUserInputPromptDto): PromptInputType {
  if (prompt.sensitive) return 'password';
  switch (prompt.format) {
    case 'password':
      return 'password';
    case 'email':
      return 'email';
    case 'url':
      return 'url';
    default:
      return 'text';
  }
}

/**
 * Runs the manifest-declared validation rules in spec order:
 *   1. minLength
 *   2. maxLength
 *   3. pattern (regex)
 *   4. confirm match
 * Returns a human-readable error, or null when the value is acceptable.
 *
 * `confirmValue` is only consulted when `prompt.confirm === true`.
 */
export function validatePrompt(
  prompt: CatalogUserInputPromptDto,
  value: string,
  confirmValue?: string,
): string | null {
  const trimmed = value ?? '';
  const hasDefault = prompt.default !== undefined;
  const isEmpty = trimmed.length === 0;

  if (isEmpty) {
    return hasDefault ? null : 'This field is required.';
  }

  if (typeof prompt.minLength === 'number' && trimmed.length < prompt.minLength) {
    return `Must be at least ${prompt.minLength} characters`;
  }

  if (typeof prompt.maxLength === 'number' && trimmed.length > prompt.maxLength) {
    return `Must be at most ${prompt.maxLength} characters`;
  }

  if (prompt.pattern) {
    let re: RegExp | null = null;
    try {
      re = new RegExp(prompt.pattern);
    } catch {
      // Malformed regex in the manifest — skip rather than block the user.
      console.warn(`[catalog] prompt "${prompt.name}" has invalid pattern`, prompt.pattern);
    }
    if (re && !re.test(trimmed)) {
      return prompt.patternDescription?.trim() || 'Invalid format';
    }
  }

  if (prompt.confirm && (confirmValue ?? '') !== trimmed) {
    return 'Fields do not match';
  }

  return null;
}

/**
 * Parses a backend validation payload of shape
 *   { errors: ["FIELD_NAME: message", ...] }
 * into a map keyed by prompt name. Leftover items that don't fit the
 * `FIELD: msg` prefix are returned as the `unparsed` array so the caller can
 * still surface them somewhere (e.g. top-level error box).
 */
export function parseBackendFieldErrors(
  errors: readonly string[] | undefined,
): { perField: Record<string, string>; unparsed: string[] } {
  const perField: Record<string, string> = {};
  const unparsed: string[] = [];
  for (const raw of errors ?? []) {
    const match = /^([A-Z][A-Z0-9_]*)\s*:\s*(.+)$/.exec(raw.trim());
    if (match) {
      perField[match[1]] = match[2];
    } else {
      unparsed.push(raw);
    }
  }
  return { perField, unparsed };
}
