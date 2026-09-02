export interface HighlightSegment {
  text: string;
  matched: boolean;
}

export function splitLabelByQuery(label: string, query: string): HighlightSegment[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [{ text: label, matched: false }];
  }

  const lowerLabel = label.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  while (cursor < label.length) {
    const index = lowerLabel.indexOf(lowerQuery, cursor);
    if (index === -1) {
      segments.push({ text: label.slice(cursor), matched: false });
      break;
    }
    if (index > cursor) {
      segments.push({ text: label.slice(cursor, index), matched: false });
    }
    segments.push({ text: label.slice(index, index + trimmed.length), matched: true });
    cursor = index + trimmed.length;
  }

  return segments;
}
