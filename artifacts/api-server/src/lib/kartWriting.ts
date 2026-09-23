/** Approximate the editor's visible word count without trusting a client score. */
export function visibleKartWords(html: string): number {
  const text = html
    .replace(/<\s*(?:br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, " ");
  return text.match(/\S+/g)?.length ?? 0;
}

/** A race may not award a 250-word item from one pasted or forged packet. */
export function kartWordCeiling(startTime: number | null, now: number): number {
  return 20 + Math.floor(Math.max(0, now - (startTime ?? now)) * 450 / 60_000);
}
