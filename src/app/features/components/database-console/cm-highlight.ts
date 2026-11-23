export async function fluiHighlighting(): Promise<import('@codemirror/state').Extension> {
  const [{ HighlightStyle, syntaxHighlighting }, { tags: t }] = await Promise.all([
    import('@codemirror/language'),
    import('@lezer/highlight'),
  ]);

  const style = HighlightStyle.define([
    {
      tag: [t.propertyName, t.variableName, t.definition(t.variableName), t.labelName],
      color: 'var(--fl-ink)',
    },
    { tag: [t.string, t.special(t.string)], color: 'var(--fl-success)' },
    { tag: [t.number, t.integer, t.float], color: 'var(--fl-accent-strong)' },
    { tag: [t.bool, t.null, t.atom], color: 'var(--fl-warning-text)' },
    {
      tag: [t.keyword, t.operator, t.operatorKeyword, t.function(t.variableName)],
      color: 'var(--fl-accent)',
    },
    {
      tag: [t.punctuation, t.separator, t.brace, t.bracket, t.squareBracket, t.paren],
      color: 'var(--fl-ink-muted)',
    },
    { tag: t.comment, color: 'var(--fl-ink-muted)', fontStyle: 'italic' },
  ]);

  return syntaxHighlighting(style);
}
