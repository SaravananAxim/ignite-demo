/**
 * Split stored template HTML into an optional leading style block and body.
 * Used so we can keep document-level styles (e.g. from Google Docs import) while
 * only editing the body. No special logic: same format for all templates.
 */
export function splitLeadingStyleBlock(html: string): { styleBlock: string; body: string } {
  const trimmed = html.trimStart();
  if (!trimmed.toLowerCase().startsWith('<style')) {
    return { styleBlock: '', body: html };
  }
  let end = 0;
  const lower = trimmed.toLowerCase();
  for (;;) {
    const close = lower.indexOf('</style>', end);
    if (close === -1) break;
    end = close + '</style>'.length;
    const after = trimmed.slice(end).trimStart();
    if (!after.toLowerCase().startsWith('<style')) {
      return {
        styleBlock: trimmed.slice(0, end),
        body: trimmed.slice(end).trimStart(),
      };
    }
  }
  return { styleBlock: '', body: html };
}
