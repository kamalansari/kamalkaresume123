export type InlineRun = { text: string; bold?: boolean };

// Parses **bold** markers into runs. Escape with \** if literal needed.
export function parseInline(input: string): InlineRun[] {
  if (!input) return [];
  const runs: InlineRun[] = [];
  const re = /\*\*([^*]+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) runs.push({ text: input.slice(last, m.index) });
    runs.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < input.length) runs.push({ text: input.slice(last) });
  return runs.length ? runs : [{ text: input }];
}

export function applyBoldToSelection(
  el: HTMLTextAreaElement | null,
): { value: string; start: number; end: number } | null {
  if (!el) return null;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const value = el.value;
  if (start === end) return null;
  const selected = value.slice(start, end);
  // Toggle: if already wrapped, unwrap
  if (selected.startsWith("**") && selected.endsWith("**") && selected.length >= 4) {
    const inner = selected.slice(2, -2);
    const next = value.slice(0, start) + inner + value.slice(end);
    return { value: next, start, end: start + inner.length };
  }
  const wrapped = `**${selected}**`;
  const next = value.slice(0, start) + wrapped + value.slice(end);
  return { value: next, start: start + 2, end: end + 2 };
}