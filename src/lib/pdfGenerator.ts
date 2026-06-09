import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { splitLeadingStyleBlock } from './contractHtmlUtils';

/** Split HTML by page-break div (same marker used by editor). */
const PAGE_BREAK_HTML_REGEX = /<div\s+[^>]*class="[^"]*pdf-page-break[^"]*"[^>]*>[\s\S]*?<\/div>\s*/gi;

/** True if segment has no visible content (avoids an extra blank page from trailing empty segment). */
function isSegmentEffectivelyEmpty(segment: string): boolean {
  if (!segment || !segment.trim()) return true;
  const div = document.createElement('div');
  div.innerHTML = segment;
  const text = (div.textContent ?? '').replace(/\s/g, '').replace(/\u00a0/g, '');
  if (text.length > 0) return false;
  if (div.querySelector('img')) return false;
  return true;
}

const MARGIN_X_MM = 15;

/** Convert 1-based index to lower-alpha (a, b, c, ...). */
function toAlpha(n: number): string {
  if (n <= 0) return '';
  let s = '';
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

/** Convert 1-based index to lower-roman (i, ii, iii, iv, v, ... xl, l). */
function toRoman(n: number): string {
  const map: [number, string][] = [
    [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ];
  let s = '';
  for (const [val, sym] of map) {
    while (n >= val) {
      s += sym;
      n -= val;
    }
  }
  return s;
}

/** Bullet character for unordered lists. */
const BULLET = '\u2022';

/**
 * Return indent level 0..8 from list item class (e.g. ql-indent-1 .. ql-indent-8 in stored HTML).
 */
function getIndentLevel(cls: string): number {
  const m = cls.match(/ql-indent-(\d)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Count ancestor list containers (ol, ul, .pdf-ol, .pdf-ul) for nesting depth. */
function getListDepth(el: Element): number {
  let depth = 0;
  let parent = el.parentElement;
  while (parent) {
    const tag = parent.tagName;
    const cls = parent.className ?? '';
    if (tag === 'OL' || tag === 'UL' || (typeof cls === 'string' && (cls.includes('pdf-ol') || cls.includes('pdf-ul')))) {
      depth += 1;
    }
    parent = parent.parentElement;
  }
  return depth;
}

/**
 * Replace all <ol> and <ul> with <div> blocks and inject numbers/bullets as plain text.
 * Removes list semantics so the browser cannot draw list markers (no duplicates in PDF).
 * Resets sub-counters (alpha a,b and roman i,ii) per main section and per letter parent (e.g. under d after c).
 */
function normalizeListsForPdf(segmentHtml: string): string {
  const div = document.createElement('div');
  div.innerHTML = segmentHtml;
  const counters = { num: 0, alpha: 0, roman: 0 };

  const getOlMarker = (indent: number, nested: boolean): string => {
    if (indent >= 3) return `${BULLET} `;
    if (nested) {
      // Sublists under a number (e.g. under "38. Force Majeure") render as bullets like the preview
      if (indent === 2) return '\u25AA '; // square
      return `${BULLET} `;
    }
    if (indent === 2) {
      counters.roman += 1;
      counters.alpha = 0;
      return `${toRoman(counters.roman)}. `;
    }
    if (indent === 1) {
      counters.alpha += 1;
      counters.roman = 0;
      return `${toAlpha(counters.alpha)}. `;
    }
    counters.num += 1;
    counters.alpha = 0;
    counters.roman = 0;
    return `${counters.num}. `;
  };

  const getUlMarker = (indent: number): string => {
    if (indent === 2) return '\u25E6 '; // white bullet
    if (indent >= 1) return '\u25AA ';  // square
    return `${BULLET} `;
  };

  while (true) {
    const list = div.querySelector('ol') ?? div.querySelector('ul');
    if (!list) break;

    const isOl = list.tagName === 'OL';
    const nested = list.parentElement?.closest('.pdf-li') != null;
    const wrapper = document.createElement('div');
    wrapper.className = isOl ? 'pdf-ol' : 'pdf-ul';

    const directLis = Array.from(list.children).filter((c) => c.tagName === 'LI');
    const listDepth = getListDepth(list);
    const indentLevels = directLis.map((li) => {
      const fromClass = getIndentLevel((li as HTMLElement).className ?? '');
      return fromClass > 0 ? fromClass : (nested ? Math.min(listDepth, 2) : 0);
    });
    const hasTopLevel = indentLevels.some((lev) => lev === 0);
    const hasOnlySubItems = isOl && indentLevels.length > 0 && indentLevels.every((lev) => lev >= 2);
    let prevLastIndent: number | null = null;
    let skippedNonListBeforePrev = false;
    let prev = list.previousElementSibling;
    while (prev) {
      if (prev.classList?.contains('pdf-ol') || prev.classList?.contains('pdf-ul')) {
        const v = prev.getAttribute('data-pdf-last-indent');
        if (v != null) prevLastIndent = parseInt(v, 10);
        break;
      }
      if (prev.tagName === 'OL' || prev.tagName === 'UL') {
        break;
      }
      skippedNonListBeforePrev = true;
      prev = prev.previousElementSibling;
    }
    const isNewListStart = !prev || skippedNonListBeforePrev;
    const afterLetterParent = hasOnlySubItems && prevLastIndent !== null && prevLastIndent <= 1;
    if (isOl && ((hasTopLevel && isNewListStart) || afterLetterParent)) {
      counters.alpha = 0;
      counters.roman = 0;
    }
    directLis.forEach((li, i) => {
      const indent = indentLevels[i] ?? 0;
      const marker = isOl ? getOlMarker(indent, nested) : getUlMarker(indent);

      const lineDiv = document.createElement('div');
      lineDiv.className = 'pdf-li';
      if (indent > 0) lineDiv.classList.add(`pdf-li-indent-${indent}`);

      const span = document.createElement('span');
      span.className = 'pdf-list-num';
      span.textContent = marker;
      lineDiv.appendChild(span);

      while (li.firstChild) {
        lineDiv.appendChild(li.firstChild);
      }
      wrapper.appendChild(lineDiv);
    });

    const lastIndent = indentLevels.length > 0 ? indentLevels[indentLevels.length - 1]! : 0;
    wrapper.setAttribute('data-pdf-last-indent', String(lastIndent));
    if (isOl && hasTopLevel) wrapper.setAttribute('data-pdf-had-top-level', 'true');
    list.parentNode!.replaceChild(wrapper, list);
  }

  return div.innerHTML;
}
const MARGIN_Y_MM = 18;
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - 2 * MARGIN_X_MM; // 180mm
const CONTENT_HEIGHT_PER_PAGE_MM = PAGE_HEIGHT_MM - 2 * MARGIN_Y_MM; // 261mm
/** Fixed width for contract content so Preview and PDF wrap the same. */
export const PREVIEW_CONTENT_WIDTH_PX = 800;
const MAX_PAGES = 100;

/**
 * Build a container that matches the Edit Template preview: same padding and font (p-6, 14px, 1.6).
 */
const PDF_CONTENT_CLASS = 'contract-pdf-content';

function createPDFRenderContainer(htmlContent: string): { wrapper: HTMLDivElement; inner: HTMLDivElement } {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.className = 'fixed left-0 top-0 opacity-0 pointer-events-none -z-10';
  wrapper.style.width = `${PREVIEW_CONTENT_WIDTH_PX}px`;
  wrapper.style.overflow = 'hidden';

  const inner = document.createElement('div');
  inner.className = PDF_CONTENT_CLASS;
  inner.style.width = `${PREVIEW_CONTENT_WIDTH_PX}px`;
  inner.style.maxWidth = `${PREVIEW_CONTENT_WIDTH_PX}px`;
  inner.style.overflowX = 'hidden';
  inner.style.padding = '24px';
  inner.style.fontSize = '14px';
  inner.style.lineHeight = '1.6';
  inner.style.color = '#1a1a1a';
  inner.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';
  inner.style.backgroundColor = '#fff';
  inner.style.boxSizing = 'border-box';
  inner.innerHTML = constrainImagesInHtml(htmlContent);
  wrapper.appendChild(inner);
  return { wrapper, inner };
}

/** Class for the wrapper we add around each image so it can't escape or ignore margins. */
const CONTRACT_IMG_WRAP_CLASS = 'contract-img-wrap';

/** True if node is empty or only whitespace/br (no visible content). */
function isEffectivelyEmpty(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) return (node as Text).data.trim() === '';
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    if (el.tagName === 'BR') return true;
    return !el.childNodes.length || Array.from(el.childNodes).every(isEffectivelyEmpty);
  }
  return true;
}

/** Rewrite img tags so they fit in the content area, have spacing, and can't hang off the page (position/float/negative margins from Google Docs). */
export function constrainImagesInHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  const images = Array.from(div.querySelectorAll('img'));
  images.forEach((img) => {
    const i = img as HTMLImageElement;
    if (i.closest(`.${CONTRACT_IMG_WRAP_CLASS}`)) return;
    i.style.setProperty('max-width', '100%', 'important');
    i.style.setProperty('width', 'auto', 'important');
    i.style.setProperty('height', 'auto', 'important');
    i.style.setProperty('display', 'block', 'important');
    i.style.setProperty('margin', '0', 'important');
    i.style.setProperty('padding', '0', 'important');
    i.style.setProperty('position', 'relative', 'important');
    i.style.setProperty('float', 'none', 'important');
    i.style.setProperty('left', 'auto', 'important');
    i.style.setProperty('right', 'auto', 'important');
    i.style.setProperty('top', 'auto', 'important');
    i.style.setProperty('bottom', 'auto', 'important');
    i.removeAttribute('width');
    i.removeAttribute('height');
    const wrap = document.createElement('div');
    wrap.className = CONTRACT_IMG_WRAP_CLASS;
    wrap.style.cssText = 'display:block; margin:0.5em 0 1em 0; padding:0; overflow:hidden; position:relative; left:0; right:0; max-width:100%; box-sizing:border-box;';
    i.parentNode?.insertBefore(wrap, i);
    wrap.appendChild(i);
    // Hoist wrapper out of parents that only contain it (and empty nodes), so we don't inherit
    // margin/padding from Google Docs wrappers or <p> — matches spacing in edit mode.
    let parent = wrap.parentElement;
    while (parent && parent !== div) {
      const otherChildren = Array.from(parent.childNodes).filter((n) => n !== wrap && !isEffectivelyEmpty(n));
      if (otherChildren.length > 0) break;
      const grandparent = parent.parentNode;
      if (!grandparent) break;
      grandparent.insertBefore(wrap, parent);
      parent.remove();
      parent = wrap.parentElement;
    }
    // Zero out margin/padding on parent if it now only contains our wrapper (e.g. single wrapper in a div)
    const p = wrap.parentElement;
    if (p && p !== div && p.childNodes.length === 1 && p.firstChild === wrap) {
      (p as HTMLElement).style.margin = '0';
      (p as HTMLElement).style.padding = '0';
    }
  });
  // Remove empty block elements immediately before image wrappers (e.g. Google Docs empty paragraphs).
  div.querySelectorAll(`.${CONTRACT_IMG_WRAP_CLASS}`).forEach((w) => {
    let prev = w.previousSibling;
    while (prev && prev.nodeType === Node.ELEMENT_NODE && isEffectivelyEmpty(prev)) {
      const tag = (prev as Element).tagName;
      if (tag === 'P' || tag === 'DIV') {
        const toRemove = prev;
        prev = prev.previousSibling;
        toRemove.remove();
      } else break;
    }
  });
  return div.innerHTML;
}

/**
 * Contract content styles — used by both Preview and PDF so they match exactly.
 * Preview injects these in the page; PDF injects them into the html2canvas clone
 * (the clone lives in a new document and doesn't see the page's CSS).
 *
 * When generating PDF, pass a styleHost (e.g. a div that already has this <style>)
 * so segment divs are rendered inside it and get the exact same CSS as the preview.
 */

/** When content has its own <style> (e.g. Google Docs import), only add layout rules. */
const CONTRACT_STYLES_LAYOUT_ONLY = `
  .contract-pdf-content { max-width: 100%; overflow-x: hidden; box-sizing: border-box; }
  .contract-pdf-content * { box-sizing: border-box; }
  .contract-pdf-content br { display: block; content: ""; margin-top: 0.25em; }
  .contract-pdf-content table { border-collapse: collapse; width: 100%; max-width: 100%; margin: 1em 0; }
  .contract-pdf-content table td, .contract-pdf-content table th { border: 1px solid #ccc; padding: 8px 12px; }
  .contract-pdf-content table th { background-color: #f5f5f5; font-weight: bold; }
  .contract-pdf-content hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
  .contract-pdf-content blockquote { border-left: 4px solid #ccc; padding-left: 1em; margin: 1em 0; color: #666; }
  .contract-pdf-content .contract-img-wrap { display: block !important; margin: 0.5em 0 1em 0 !important; padding: 0 !important; overflow: hidden !important; position: relative !important; left: 0 !important; right: 0 !important; max-width: 100% !important; box-sizing: border-box !important; }
  .contract-pdf-content img { display: block !important; max-width: 100% !important; width: auto !important; height: auto !important; margin: 0 !important; padding: 0 !important; position: relative !important; float: none !important; left: auto !important; right: auto !important; object-fit: contain !important; box-sizing: border-box !important; vertical-align: top !important; }
  .contract-pdf-content .pdf-page-break { border: none; border-top: 1px dashed #ccc; margin: 1em 0; padding: 0.25em 0; }
  .contract-pdf-content .pdf-page-break-label { font-size: 12px; color: #999; }
`;

/** Default contract content styles (editor-created templates, no imported <style>). */
const CONTRACT_STYLES_DEFAULT = `
  .contract-pdf-content { max-width: 100%; overflow-x: hidden; box-sizing: border-box; }
  .contract-pdf-content * { box-sizing: border-box; }
  .contract-pdf-content br { display: block; content: ""; margin-top: 0.25em; }
  .contract-pdf-content .ql-pasted-table { margin: 1em 0; }
  .contract-pdf-content table { border-collapse: collapse; width: 100%; max-width: 100%; margin: 1em 0; }
  .contract-pdf-content table td, .contract-pdf-content table th { border: 1px solid #ccc; padding: 8px 12px; }
  .contract-pdf-content table th { background-color: #f5f5f5; font-weight: bold; }
  .contract-pdf-content hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
  .contract-pdf-content p { margin: 0.6em 0; }
  .contract-pdf-content p:first-child { margin-top: 0; }
  .contract-pdf-content h1, .contract-pdf-content h2, .contract-pdf-content h3, .contract-pdf-content h4, .contract-pdf-content h5, .contract-pdf-content h6 { margin: 1em 0 0.5em 0; font-weight: 700; }
  .contract-pdf-content h1, .contract-pdf-content h2 { text-align: center; }
  .contract-pdf-content ul, .contract-pdf-content ol { padding-left: 1.5em; margin: 0.5em 0; }
  .contract-pdf-content ul { list-style-type: disc; }
  .contract-pdf-content ul li { list-style: inherit; }
  .contract-pdf-content ul li.ql-indent-1 { margin-left: 1.5em; list-style-type: circle; }
  .contract-pdf-content ul li.ql-indent-2 { margin-left: 3em; list-style-type: square; }
  /* Use counters + ::before so nested ol (a, b, c / i, ii, iii) renders the same in preview and html2canvas PDF. */
  .contract-pdf-content ol { list-style: none; counter-reset: ol-item; padding-left: 1.5em; }
  .contract-pdf-content ol li { padding-left: 0.25em; }
  .contract-pdf-content ol li::before { counter-increment: ol-item; content: counter(ol-item) ". "; display: inline-block; min-width: 1.6em; }
  .contract-pdf-content ol ol { counter-reset: ol-item; }
  .contract-pdf-content ol ol li::before { content: counter(ol-item, lower-alpha) ". "; }
  .contract-pdf-content ol ol ol { counter-reset: ol-item; }
  .contract-pdf-content ol ol ol li::before { content: counter(ol-item, lower-roman) ". "; }
  .contract-pdf-content ol li.ql-indent-1 { margin-left: 1.5em; }
  .contract-pdf-content ol li.ql-indent-2 { margin-left: 3em; }
  .contract-pdf-content blockquote { border-left: 4px solid #ccc; padding-left: 1em; margin: 1em 0; color: #666; }
  .contract-pdf-content .contract-img-wrap { display: block !important; margin: 0.5em 0 1em 0 !important; padding: 0 !important; overflow: hidden !important; position: relative !important; left: 0 !important; right: 0 !important; max-width: 100% !important; box-sizing: border-box !important; }
  .contract-pdf-content img { display: block !important; max-width: 100% !important; width: auto !important; height: auto !important; margin: 0 !important; padding: 0 !important; position: relative !important; float: none !important; left: auto !important; right: auto !important; object-fit: contain !important; box-sizing: border-box !important; vertical-align: top !important; }
  [style*="text-align: center"], .text-center { text-align: center; }
  .contract-pdf-content { tab-size: 4; }
  .contract-pdf-content .ql-indent-1 { padding-left: 3em; }
  .contract-pdf-content .ql-indent-2 { padding-left: 6em; }
  .contract-pdf-content .ql-indent-3 { padding-left: 9em; }
  .contract-pdf-content .ql-indent-4 { padding-left: 12em; }
  .contract-pdf-content .ql-indent-5 { padding-left: 15em; }
  .contract-pdf-content .ql-indent-6 { padding-left: 18em; }
  .contract-pdf-content .ql-indent-7 { padding-left: 21em; }
  .contract-pdf-content .ql-indent-8 { padding-left: 24em; }
  .contract-pdf-content ol li.ql-indent-1, .contract-pdf-content ol li.ql-indent-2 { padding-left: 0; }
  .contract-pdf-content .ql-align-center { text-align: center; }
  .contract-pdf-content .ql-align-right { text-align: right; }
  .contract-pdf-content .ql-align-justify { text-align: justify; }
  .contract-pdf-content .ql-align-left { text-align: left; }
  .contract-pdf-content .ql-size-small { font-size: 0.75em; }
  .contract-pdf-content .ql-size-large { font-size: 1.25em; }
  .contract-pdf-content .ql-size-huge { font-size: 1.5em; }
  .contract-pdf-content .ql-font-serif { font-family: Georgia, Times New Roman, serif; }
  .contract-pdf-content .ql-font-monospace { font-family: Monaco, Courier New, monospace; }
  .contract-pdf-content .pdf-page-break { border: none; border-top: 1px dashed #ccc; margin: 1em 0; padding: 0.25em 0; }
  .contract-pdf-content .pdf-page-break-label { font-size: 12px; color: #999; }
`;

/** Picks the same styles Preview uses so PDF matches. Used by both ContractPreview and the PDF onclone callback. */
export function getContractPreviewStyles(html: string): string {
  return html.trimStart().toLowerCase().startsWith('<style') ? CONTRACT_STYLES_LAYOUT_ONLY : CONTRACT_STYLES_DEFAULT;
}

export const CONTRACT_PREVIEW_CONTENT_CLASS = PDF_CONTENT_CLASS;

/** Inject into html2canvas clone so the clone renders like the Preview (same styles, same layout). */
function onCloneForPdf(clonedDoc: Document, clonedNode: Node): void {
  const docEl = clonedDoc.documentElement;
  const body = clonedDoc.body;
  docEl.style.width = `${PREVIEW_CONTENT_WIDTH_PX}px`;
  docEl.style.minHeight = '100%';
  body.style.width = `${PREVIEW_CONTENT_WIDTH_PX}px`;
  body.style.minHeight = '100%';
  body.style.margin = '0';
  body.style.background = '#fff';

  const el = clonedNode as HTMLElement;
  const style = clonedDoc.createElement('style');
  style.textContent = getContractPreviewStyles(el.innerHTML);
  clonedDoc.head.appendChild(style);

  const parent = el.parentElement;
  if (parent) {
    parent.style.visibility = 'visible';
    parent.style.opacity = '1';
    parent.style.width = `${PREVIEW_CONTENT_WIDTH_PX}px`;
    parent.style.position = 'relative';
    parent.style.left = '0';
    parent.style.top = '0';
  }
  el.style.visibility = 'visible';
  el.style.opacity = '1';
  el.style.width = `${PREVIEW_CONTENT_WIDTH_PX}px`;
  el.style.maxWidth = `${PREVIEW_CONTENT_WIDTH_PX}px`;
  el.style.overflowX = 'hidden';
  el.style.padding = '24px';
  el.style.backgroundColor = '#fff';
  el.style.color = '#1a1a1a';
  el.style.fontSize = '14px';
  el.style.lineHeight = '1.6';
  el.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';

  // Force all images in the clone to fit and stay in bounds (override any Google Docs positioning/float/negative margin)
  el.querySelectorAll('img').forEach((img) => {
    const i = img as HTMLImageElement;
    i.style.setProperty('max-width', '100%', 'important');
    i.style.setProperty('width', 'auto', 'important');
    i.style.setProperty('height', 'auto', 'important');
    i.style.setProperty('display', 'block', 'important');
    i.style.setProperty('margin', '0', 'important');
    i.style.setProperty('padding', '0', 'important');
    i.style.setProperty('position', 'relative', 'important');
    i.style.setProperty('float', 'none', 'important');
    i.style.setProperty('left', 'auto', 'important');
    i.style.setProperty('right', 'auto', 'important');
    i.removeAttribute('width');
    i.removeAttribute('height');
    // Wrap in container if not already wrapped, so image can't escape
    if (!i.closest(`.${CONTRACT_IMG_WRAP_CLASS}`)) {
      const wrap = clonedDoc.createElement('div');
      wrap.className = CONTRACT_IMG_WRAP_CLASS;
      wrap.style.cssText = 'display:block;margin:0.5em 0 1em 0;padding:0;overflow:hidden;position:relative;left:0;right:0;max-width:100%;box-sizing:border-box;';
      i.parentNode?.insertBefore(wrap, i);
      wrap.appendChild(i);
    }
  });
}

async function renderSegmentToCanvas(
  segmentHtml: string,
  styleHost?: HTMLElement | null
): Promise<HTMLCanvasElement> {
  const { wrapper, inner } = createPDFRenderContainer(segmentHtml);
  const parent = styleHost ?? document.body;
  parent.appendChild(wrapper);
  try {
    const canvas = await html2canvas(inner, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: PREVIEW_CONTENT_WIDTH_PX,
      onclone: onCloneForPdf,
    });
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('Failed to render contract — canvas is empty.');
    }
    return canvas;
  } finally {
    parent.removeChild(wrapper);
  }
}

/** Pixel threshold for "white" (background). Allow antialiasing. */
const WHITE_THRESHOLD = 240;
/** Min proportion of row pixels that must be white to treat as a safe break. */
const WHITE_RATIO = 0.86;
/** How far down from target to search for a safe break (px). */
const SEARCH_DOWN_PX = 320;
/** How far up from target to search for a safe break (px). */
const SEARCH_UP_PX = 150;
/** Min slice height so we don't create tiny strips. */
const MIN_SLICE_PX = 60;
/** Rendered line height in canvas px (scale 2, font 14px, line-height 1.6). Never cut through a line. */
const LINE_HEIGHT_CANVAS_PX = 60;
/** Require this many consecutive white rows so we only break in real paragraph gaps, never through text. */
const CONSECUTIVE_WHITE_ROWS = 8;
/** Max non-white pixel ratio in band around a break – if higher, we're inside an image/table; don't break. */
const MAX_DENSE_RATIO_NEAR_BREAK = 0.22;
/** Half-height of band to sample above/below break (px) to detect image/table. */
const BAND_HALF_HEIGHT_PX = 80;

/**
 * Return true if row y on canvas is mostly white (safe to break between lines).
 */
function isRowMostlyWhite(ctx: CanvasRenderingContext2D, width: number, y: number): boolean {
  const imageData = ctx.getImageData(0, y, width, 1);
  const data = imageData.data;
  let whiteCount = 0;
  const step = 4;
  for (let i = 0; i < data.length; i += step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) whiteCount += 1;
  }
  const total = data.length / step;
  return total > 0 && whiteCount / total >= WHITE_RATIO;
}

/**
 * Return true if there are CONSECUTIVE_WHITE_ROWS white rows starting at y.
 */
function hasConsecutiveWhiteRows(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  y: number
): boolean {
  for (let i = 0; i < CONSECUTIVE_WHITE_ROWS; i += 1) {
    const row = y + i;
    if (row >= height || !isRowMostlyWhite(ctx, width, row)) return false;
  }
  return true;
}

/**
 * Return the proportion of non-white pixels in the vertical band [y0, y1).
 * Used to reject breaks that would slice through an image or table (dense region).
 */
function getNonWhiteRatioInBand(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  y0: number,
  y1: number
): number {
  const top = Math.max(0, Math.floor(y0));
  const bottom = Math.min(height, Math.ceil(y1));
  const h = bottom - top;
  if (h <= 0) return 0;
  const imageData = ctx.getImageData(0, top, width, h);
  const data = imageData.data;
  let nonWhite = 0;
  const step = 4;
  for (let i = 0; i < data.length; i += step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < WHITE_THRESHOLD || g < WHITE_THRESHOLD || b < WHITE_THRESHOLD) nonWhite += 1;
  }
  const total = data.length / step;
  return total > 0 ? nonWhite / total : 0;
}

/**
 * Return true if the band around y looks like a real gap (not inside an image or table).
 * We require the band above and below the white run to not be too dense.
 */
function isGapNotInImageOrTable(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  y: number
): boolean {
  const yAbove = y - BAND_HALF_HEIGHT_PX;
  const yBelow = y + CONSECUTIVE_WHITE_ROWS + BAND_HALF_HEIGHT_PX;
  const ratioAbove = getNonWhiteRatioInBand(ctx, width, height, yAbove, y);
  const ratioBelow = getNonWhiteRatioInBand(ctx, width, height, y + CONSECUTIVE_WHITE_ROWS, yBelow);
  return ratioAbove <= MAX_DENSE_RATIO_NEAR_BREAK && ratioBelow <= MAX_DENSE_RATIO_NEAR_BREAK;
}

/**
 * Find a row near targetEndY that starts a run of white rows in a real gap when possible.
 * If no gap is found, break at the target page boundary (may split images/tables) to avoid
 * large mid-page whitespace and extra pages.
 */
function findSafeBreakRow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  startPx: number,
  targetEndY: number,
  remainingPx: number
): number {
  const maxY = Math.min(height, targetEndY + SEARCH_UP_PX);
  const minY = Math.max(startPx, targetEndY - SEARCH_DOWN_PX);
  const idealSlice = targetEndY - startPx;

  for (let y = targetEndY; y >= minY; y -= 1) {
    if (y >= 0 && hasConsecutiveWhiteRows(ctx, width, height, y) && isGapNotInImageOrTable(ctx, width, height, y)) {
      const slice = y - startPx;
      if (slice >= MIN_SLICE_PX) return slice;
    }
  }
  for (let y = targetEndY + 1; y <= maxY; y += 1) {
    if (y >= 0 && hasConsecutiveWhiteRows(ctx, width, height, y) && isGapNotInImageOrTable(ctx, width, height, y)) {
      return y - startPx;
    }
  }

  // No gap found (e.g. inside/above table): break at target so we don't create a short page + huge whitespace.
  return Math.max(MIN_SLICE_PX, Math.min(idealSlice, remainingPx));
}

/** Diagonal line spacing (px) for reserved-space security pattern. */
const BLANK_FILLER_LINE_SPACING = 18;
/** Color for diagonal lines — visible enough to deter tampering, still professional. */
const BLANK_FILLER_STROKE = '#d1d5db';

/**
 * Draw a reserved-space filler so the area cannot be used for added text after signing.
 * Uses a diagonal security pattern only (no wording); standard for contracts and legal docs.
 */
function drawBlankSpaceFiller(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = BLANK_FILLER_STROKE;
  ctx.lineWidth = 1;
  const spacing = BLANK_FILLER_LINE_SPACING;
  const totalDiag = w + h;
  for (let d = -totalDiag; d <= totalDiag * 2; d += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + d, y);
    ctx.lineTo(x + d + h, y + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + d, y + h);
    ctx.lineTo(x + d + h, y);
    ctx.stroke();
  }
}

function addCanvasPagesToPdf(pdf: jsPDF, canvas: HTMLCanvasElement): void {
  const mmPerPx = CONTENT_WIDTH_MM / canvas.width;
  const pageHeightPx = Math.round(CONTENT_HEIGHT_PER_PAGE_MM / mmPerPx);
  const ctx = canvas.getContext('2d')!;
  const width = canvas.width;
  const height = canvas.height;

  let startPx = 0;
  let pageIndex = 0;
  while (startPx < height && pageIndex < MAX_PAGES) {
    if (pageIndex > 0) pdf.addPage();

    const remainingPx = height - startPx;
    const idealSlicePx = Math.min(pageHeightPx, remainingPx);
    const targetEndY = startPx + idealSlicePx;

    let sliceHeightPx: number;
    if (remainingPx <= pageHeightPx + 20) {
      sliceHeightPx = remainingPx;
    } else {
      const safeHeight = findSafeBreakRow(ctx, width, height, startPx, targetEndY, remainingPx);
      sliceHeightPx = Math.max(
        MIN_SLICE_PX,
        Math.min(safeHeight, remainingPx, pageHeightPx + SEARCH_UP_PX)
      );
      if (sliceHeightPx <= 0) sliceHeightPx = Math.min(idealSlicePx, remainingPx);
    }

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = width;
    sliceCanvas.height = sliceHeightPx;
    const sliceCtx = sliceCanvas.getContext('2d')!;
    sliceCtx.drawImage(canvas, 0, startPx, width, sliceHeightPx, 0, 0, width, sliceHeightPx);

    let imgData: string;
    let heightMm: number;

    const isLastSliceOfSegment = startPx + sliceHeightPx >= height;
    const isShortPartialPage = sliceHeightPx < pageHeightPx;
    if (isShortPartialPage && isLastSliceOfSegment) {
      // Only fill blank space on the final partial page of a segment (e.g. after a page break).
      const fullPageCanvas = document.createElement('canvas');
      fullPageCanvas.width = width;
      fullPageCanvas.height = pageHeightPx;
      const fullCtx = fullPageCanvas.getContext('2d')!;
      fullCtx.fillStyle = '#ffffff';
      fullCtx.fillRect(0, 0, width, pageHeightPx);
      fullCtx.drawImage(sliceCanvas, 0, 0, width, sliceHeightPx, 0, 0, width, sliceHeightPx);
      drawBlankSpaceFiller(fullCtx, 0, sliceHeightPx, width, pageHeightPx - sliceHeightPx);
      imgData = fullPageCanvas.toDataURL('image/jpeg', 0.95);
      heightMm = CONTENT_HEIGHT_PER_PAGE_MM;
    } else {
      imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
      heightMm = sliceHeightPx * mmPerPx;
    }

    pdf.addImage(imgData, 'JPEG', MARGIN_X_MM, MARGIN_Y_MM, CONTENT_WIDTH_MM, heightMm);
    startPx += sliceHeightPx;
    pageIndex += 1;
  }
}

/**
 * Generate PDF from the same HTML and styling as the preview.
 * If styleHost is provided (e.g. a div that already has the preview's <style>),
 * segment divs are rendered inside it so they get the exact same CSS as the preview.
 */
export async function generateContractPDF(
  htmlContent: string,
  _fileName: string,
  styleHost?: HTMLElement | null
): Promise<Blob> {
  const { styleBlock, body } = splitLeadingStyleBlock(htmlContent);
  const segments = body
    .split(PAGE_BREAK_HTML_REGEX)
    .map((s) => s.trim())
    .filter((s) => !isSegmentEffectivelyEmpty(s));

  const pdf = new jsPDF('p', 'mm', 'a4');

  for (let i = 0; i < segments.length; i += 1) {
    if (i > 0) pdf.addPage();
    const segment = segments[i];
    const segmentWithStyles = styleBlock ? styleBlock + '\n' + segment : segment;
    const canvas = await renderSegmentToCanvas(segmentWithStyles, styleHost);
    addCanvasPagesToPdf(pdf, canvas);
  }

  return pdf.output('blob');
}

export function replacePlaceholders(
  htmlContent: string,
  values: Record<string, string>
): string {
  let result = htmlContent;
  
  Object.entries(values).forEach(([placeholder, value]) => {
    // Handle {{placeholder}} format
    const pattern = new RegExp(`\\{\\{${escapeRegExp(placeholder)}\\}\\}`, 'gi');
    result = result.replace(pattern, value);
  });
  
  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove any {{placeholder}} that wasn't replaced so they never appear in the contract.
 * Signature placeholders are intentionally preserved so insertSignatureImages can fill them later.
 */
export function stripUnreplacedPlaceholders(htmlContent: string): string {
  return htmlContent.replace(
    /\{\{(?!(franchiseeSignature|counterSignature|franchiseeSignedDate|counterSignedDate)\}\})[^}]*\}\}/g,
    ''
  );
}

/**
 * Remove any remaining section markers so they never appear in the rendered contract.
 * Handles three formats:
 *   1. New {{}} format:            {{#section:PaidMedia}} / {{/section:PaidMedia}}
 *   2. Legacy entity-encoded:      &lt;!-- section_PaidMedia --&gt; (older editor)
 *   3. Legacy HTML comment format: <!-- section_PaidMedia --> (raw HTML authoring)
 */
export function stripRemainingSectionMarkers(htmlContent: string): string {
  return htmlContent
    .replace(/\{\{[#/]?section:[A-Za-z]+\}\}/gi, '')
    .replace(/&lt;!--\s*\/?section_[A-Za-z]+\s*--&gt;/gi, '')
    .replace(/<!--\s*\/?section_[A-Za-z]+\s*-->/gi, '');
}

/**
 * Sanitize contract HTML after placeholder replacement: strip unreplaced placeholders
 * and any leftover section markers so the final contract never shows raw placeholders or dividers.
 */
export function sanitizeContractHtml(htmlContent: string): string {
  let result = stripUnreplacedPlaceholders(htmlContent);
  result = stripRemainingSectionMarkers(result);
  return result;
}

/**
 * Replace signature placeholders with actual signature images
 */
export function insertSignatureImages(
  htmlContent: string,
  franchiseeSignature: string | null,
  counterSignature: string | null,
  franchiseeSignedDate: string | null,
  counterSignedDate: string | null
): string {
  let result = htmlContent;
  
  // Insert franchisee signature image
  if (franchiseeSignature) {
    const signatureImg = `<img src="${franchiseeSignature}" alt="Franchisee Signature" style="max-width: 220px; height: 70px; object-fit: contain; display: block;" />`;
    result = result.replace(/\{\{franchiseeSignature\}\}/gi, signatureImg);
  } else {
    result = result.replace(/\{\{franchiseeSignature\}\}/gi, '<span style="color: #9ca3af; font-style: italic;">[Awaiting signature]</span>');
  }
  
  // Insert franchisee signed date
  if (franchiseeSignedDate) {
    result = result.replace(/\{\{franchiseeSignedDate\}\}/gi, franchiseeSignedDate);
  } else {
    result = result.replace(/\{\{franchiseeSignedDate\}\}/gi, '<span style="color: #9ca3af; font-style: italic;">[Date pending]</span>');
  }
  
  // Insert counter signature image
  if (counterSignature) {
    const counterImg = `<img src="${counterSignature}" alt="Authorized Signature" style="max-width: 220px; height: 70px; object-fit: contain; display: block;" />`;
    result = result.replace(/\{\{counterSignature\}\}/gi, counterImg);
  } else {
    result = result.replace(/\{\{counterSignature\}\}/gi, '<span style="color: #9ca3af; font-style: italic;">[Awaiting counter-signature]</span>');
  }
  
  // Insert counter signed date
  if (counterSignedDate) {
    result = result.replace(/\{\{counterSignedDate\}\}/gi, counterSignedDate);
  } else {
    result = result.replace(/\{\{counterSignedDate\}\}/gi, '<span style="color: #9ca3af; font-style: italic;">[Date pending]</span>');
  }

  return result;
}

/**
 * Process conditional sections in contract HTML
 * Removes or keeps sections based on options
 */
export function processConditionalSections(
  htmlContent: string,
  options: { includePaidMedia?: boolean }
): string {
  let result = htmlContent;
  
  const paidMediaStartMarker = "<!-- section_PaidMedia -->";
  const paidMediaEndMarker = "<!-- /section_PaidMedia -->";
  
  if (!options.includePaidMedia) {
    // Remove Paid Media section
    const startIdx = result.indexOf(paidMediaStartMarker);
    const endIdx = result.indexOf(paidMediaEndMarker);
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      result = result.substring(0, startIdx) + result.substring(endIdx + paidMediaEndMarker.length);
    }
  } else {
    // Keep section but remove markers
    result = result.replace(paidMediaStartMarker, '');
    result = result.replace(paidMediaEndMarker, '');
  }
  
  return result;
}

/**
 * Generate a signed contract PDF with both signatures
 */
export async function generateSignedContractPDF(
  htmlContent: string,
  franchiseeSignature: string,
  counterSignature: string | null,
  fileName: string
): Promise<Blob> {
  // Append signature section to the HTML
  const signatureHtml = `
    <div style="margin-top: 40px; page-break-inside: avoid;">
      <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 20px;">Signatures</h3>
      <div style="display: flex; justify-content: space-between; gap: 40px;">
        <div style="flex: 1;">
          <p style="font-weight: bold; margin-bottom: 8px;">Franchisee Signature:</p>
          <img src="${franchiseeSignature}" alt="Franchisee Signature" style="max-width: 200px; height: 80px; object-fit: contain; border-bottom: 1px solid #000;" />
          <p style="margin-top: 8px; font-size: 12px; color: #666;">Date: ${new Date().toLocaleDateString()}</p>
        </div>
        ${counterSignature ? `
        <div style="flex: 1;">
          <p style="font-weight: bold; margin-bottom: 8px;">Authorized Representative:</p>
          <img src="${counterSignature}" alt="Counter Signature" style="max-width: 200px; height: 80px; object-fit: contain; border-bottom: 1px solid #000;" />
          <p style="margin-top: 8px; font-size: 12px; color: #666;">Date: ${new Date().toLocaleDateString()}</p>
        </div>
        ` : ''}
      </div>
    </div>
  `;
  
  const fullHtml = htmlContent + signatureHtml;
  return generateContractPDF(fullHtml, fileName);
}
