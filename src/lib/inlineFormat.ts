export type InlineRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };

function splitBy(
  runs: InlineRun[],
  re: RegExp,
  flag: "bold" | "italic" | "underline",
): InlineRun[] {
  const out: InlineRun[] = [];
  for (const run of runs) {
    if (run[flag]) { out.push(run); continue; }
    let last = 0;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    let matched = false;
    while ((m = re.exec(run.text)) !== null) {
      matched = true;
      if (m.index > last) out.push({ ...run, text: run.text.slice(last, m.index) });
      out.push({ ...run, text: m[1], [flag]: true });
      last = m.index + m[0].length;
    }
    if (!matched) { out.push(run); continue; }
    if (last < run.text.length) out.push({ ...run, text: run.text.slice(last) });
  }
  return out;
}

// Parses **bold**, __underline__, and *italic* markers into runs.
export function parseInline(input: string): InlineRun[] {
  if (!input) return [];
  let runs: InlineRun[] = [{ text: input }];
  runs = splitBy(runs, /\*\*([^*]+?)\*\*/g, "bold");
  runs = splitBy(runs, /__([^_]+?)__/g, "underline");
  runs = splitBy(runs, /(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "italic");
  return runs.length ? runs : [{ text: input }];
}

export function applyWrapToSelection(
  el: HTMLTextAreaElement | null,
  left: string,
  right: string = left,
): { value: string; start: number; end: number } | null {
  if (!el) return null;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const value = el.value;
  if (start === end) return null;
  const selected = value.slice(start, end);
  if (
    selected.startsWith(left) &&
    selected.endsWith(right) &&
    selected.length >= left.length + right.length
  ) {
    const inner = selected.slice(left.length, selected.length - right.length);
    const next = value.slice(0, start) + inner + value.slice(end);
    return { value: next, start, end: start + inner.length };
  }
  const wrapped = left + selected + right;
  const next = value.slice(0, start) + wrapped + value.slice(end);
  return { value: next, start: start + left.length, end: end + left.length };
}

export function applyBoldToSelection(el: HTMLTextAreaElement | null) {
  return applyWrapToSelection(el, "**");
}

export function applyItalicToSelection(el: HTMLTextAreaElement | null) {
  return applyWrapToSelection(el, "*");
}

export function applyUnderlineToSelection(el: HTMLTextAreaElement | null) {
  return applyWrapToSelection(el, "__");
}

// Toggles a "- " bullet prefix on every line touched by the selection.
export function applyBulletToSelection(
  el: HTMLTextAreaElement | null,
): { value: string; start: number; end: number } | null {
  if (!el) return null;
  const s = el.selectionStart ?? 0;
  const e = el.selectionEnd ?? 0;
  const v = el.value;
  const lineStart = v.lastIndexOf("\n", Math.max(0, s - 1)) + 1;
  const nextNl = v.indexOf("\n", e);
  const lineEnd = nextNl === -1 ? v.length : nextNl;
  const block = v.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const nonEmpty = lines.filter(l => l.trim() !== "");
  const allBulleted = nonEmpty.length > 0 && nonEmpty.every(l => /^\s*-\s/.test(l));
  const newLines = allBulleted
    ? lines.map(l => l.replace(/^(\s*)-\s/, "$1"))
    : lines.map(l => (l.trim() === "" ? l : "- " + l));
  const newBlock = newLines.join("\n");
  const next = v.slice(0, lineStart) + newBlock + v.slice(lineEnd);
  return { value: next, start: lineStart, end: lineStart + newBlock.length };
}