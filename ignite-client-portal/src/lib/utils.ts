import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Decodes HTML entities (e.g. &amp; &nbsp; &lt;) to plain text so Stripe and other
 * plain-text surfaces don't show literal "&amp;" in descriptions.
 */
export function decodeHtmlEntities(html: string): string {
  if (typeof document === "undefined") {
    // SSR or non-DOM: decode common entities manually
    return html
      .replace(/&nbsp;/g, "\u00A0")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'");
  }
  const textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  return textarea.value;
}
