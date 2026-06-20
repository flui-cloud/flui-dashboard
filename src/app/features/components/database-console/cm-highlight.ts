/**
 * Shared CodeMirror syntax highlighting for the document console editors (filter bar + mongo
 * shell). Keys are rendered in the theme foreground so they stay legible in BOTH light and dark
 * mode (the default highlight style paints them a dark blue that vanishes on the dark background);
 * only values are tinted, via theme CSS variables (`--cm-*` in styles.scss) so they track the
 * active theme. Added as a non-fallback style, so it overrides minimalSetup's default highlighter.
 *
 * Lazy-loaded alongside the editor modules; returns the extension to drop into `extensions`.
 */
export async function fluiHighlighting(): Promise<
  import('@codemirror/state').Extension
> {
  const [{ HighlightStyle, syntaxHighlighting }, { tags: t }] = await Promise.all([
    import('@codemirror/language'),
    import('@lezer/highlight'),
  ]);

  const style = HighlightStyle.define([
    // Object keys / identifiers — high-contrast in either theme.
    {
      tag: [t.propertyName, t.variableName, t.definition(t.variableName), t.labelName],
      color: 'hsl(var(--foreground))',
    },
    { tag: [t.string, t.special(t.string)], color: 'hsl(var(--cm-string))' },
    { tag: [t.number, t.integer, t.float], color: 'hsl(var(--cm-number))' },
    { tag: [t.bool, t.null, t.atom], color: 'hsl(var(--cm-atom))' },
    {
      tag: [t.keyword, t.operator, t.operatorKeyword, t.function(t.variableName)],
      color: 'hsl(var(--cm-keyword))',
    },
    {
      tag: [t.punctuation, t.separator, t.brace, t.bracket, t.squareBracket, t.paren],
      color: 'hsl(var(--muted-foreground))',
    },
    { tag: t.comment, color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' },
  ]);

  return syntaxHighlighting(style);
}
