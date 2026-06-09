/**
 * Import content from a Google Docs "Web Page" / ZIP export.
 * Returns body HTML with image srcs as data URLs. No modification of structure or classes.
 */
import JSZip from "jszip";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i;

export interface ImportResult {
  html: string;
  suggestedName: string;
}

/**
 * Parse a Google Docs export ZIP. Returns HTML with:
 * - All <style>...</style> from the export's <head> (so it looks exact)
 * - Body with image srcs as data URLs.
 * Stored and edited as raw HTML; styling remains editable in the body.
 */
export async function importGoogleDocsZip(zipFile: File): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(zipFile);
  const found = findMainHtmlEntry(zip);
  if (!found) {
    throw new Error("ZIP does not contain an HTML file at the root.");
  }
  const { entry: htmlEntry, path: htmlPath } = found;
  const htmlText = await htmlEntry.async("string");
  const imageMap = await buildImageDataUrlMap(zip);
  const headStyles = extractHeadStyles(htmlText);
  const bodyHtml = replaceImageSrcs(extractBodyHtml(htmlText), imageMap);
  const html = headStyles ? headStyles + "\n" + bodyHtml : bodyHtml;
  const suggestedName = suggestNameFromFilename(htmlPath) || "Imported template";
  return { html, suggestedName };
}

function extractHeadStyles(htmlText: string): string {
  const lower = htmlText.toLowerCase();
  const headEnd = lower.indexOf("</head>");
  if (headEnd === -1) return "";
  const head = htmlText.slice(0, headEnd);
  const styles: string[] = [];
  let idx = 0;
  for (;;) {
    const start = lower.indexOf("<style", idx);
    if (start === -1) break;
    const endTag = lower.indexOf("</style>", start);
    if (endTag === -1) break;
    styles.push(htmlText.slice(start, endTag + "</style>".length));
    idx = endTag + 1;
  }
  return styles.join("\n");
}

function findMainHtmlEntry(zip: JSZip): { entry: JSZip.JSZipObject; path: string } | null {
  let found: { entry: JSZip.JSZipObject; path: string } | null = null;
  zip.forEach((relativePath, entry) => {
    if (found) return;
    if (relativePath.includes("/")) return; // only root-level
    if (relativePath.toLowerCase().endsWith(".html")) {
      found = { entry, path: relativePath };
    }
  });
  return found;
}

async function buildImageDataUrlMap(zip: JSZip): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const entries: [string, JSZip.JSZipObject][] = [];
  zip.forEach((path, entry) => {
    if (!entry.dir && IMAGE_EXT.test(path)) entries.push([path, entry]);
  });
  await Promise.all(
    entries.map(async ([path, entry]) => {
      const blob = await entry.async("blob");
      const base64 = await blobToBase64(blob);
      const mime = getMime(path);
      const dataUrl = `data:${mime};base64,${base64}`;
      map.set(path, dataUrl);
      map.set(path.replace(/\//g, "\\"), dataUrl);
      if (!path.startsWith("./")) map.set("./" + path, dataUrl);
    })
  );
  return map;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = r.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function getMime(path: string): string {
  const ext = path.replace(/\?.*$/, "").split(".").pop()?.toLowerCase();
  const mimes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
  };
  return mimes[ext ?? ""] ?? "image/png";
}

function extractBodyHtml(htmlText: string): string {
  const lower = htmlText.toLowerCase();
  const bodyStart = lower.indexOf("<body");
  const bodyEnd = lower.indexOf("</body>");
  if (bodyStart === -1 || bodyEnd === -1) {
    return htmlText;
  }
  const openTagEnd = htmlText.indexOf(">", bodyStart) + 1;
  return htmlText.slice(openTagEnd, bodyEnd).trim();
}

function replaceImageSrcs(html: string, imageMap: Map<string, string>): string {
  let out = html;
  for (const [path, dataUrl] of imageMap) {
    const esc = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(src\\s*=\\s*["'])${esc}(["'])`, "gi");
    out = out.replace(re, `$1${dataUrl}$2`);
  }
  return out;
}

function suggestNameFromFilename(htmlFilename: string): string {
  const base = htmlFilename.replace(/\.html?$/i, "").trim();
  return base.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "";
}

