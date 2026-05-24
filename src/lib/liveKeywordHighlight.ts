// Live in-place keyword highlighter for contentEditable elements.
// Wraps matching tokens in <strong> while preserving caret position so the
// resume preview can show bolded ATS keywords as the user types — without
// waiting for React state to re-sync.

const WORD_RE = /[A-Za-z][A-Za-z0-9+.#-]{2,}/g;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!));

function getCaretCharOffset(el: HTMLElement): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.endContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

function setCaretCharOffset(el: HTMLElement, offset: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node: Node | null = walker.nextNode();
  let target: { node: Node; off: number } | null = null;
  while (node) {
    const len = (node.nodeValue || "").length;
    if (remaining <= len) { target = { node, off: remaining }; break; }
    remaining -= len;
    node = walker.nextNode();
  }
  const range = document.createRange();
  if (target) {
    range.setStart(target.node, target.off);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Rebuilds `el`'s innerHTML so that every token matching `isKeyword` is
 * wrapped in a <strong>, preserving line breaks and caret position.
 * No-ops when the rendered HTML would not change.
 */
export function highlightKeywordsInEditable(
  el: HTMLElement,
  isKeyword: (w: string) => boolean,
): void {
  const text = el.innerText;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  WORD_RE.lastIndex = 0;
  while ((m = WORD_RE.exec(text)) !== null) {
    if (isKeyword(m[0])) {
      out += escapeHtml(text.slice(last, m.index));
      out += `<strong style="font-weight:700">${escapeHtml(m[0])}</strong>`;
      last = m.index + m[0].length;
    }
  }
  out += escapeHtml(text.slice(last));
  out = out.replace(/\n/g, "<br>");

  if (el.innerHTML === out) return;
  const caret = getCaretCharOffset(el);
  el.innerHTML = out;
  if (caret != null) setCaretCharOffset(el, caret);
}