import type { RankedSource } from '../types/media'

/** Parses an `srcset` attribute value into ranked sources, largest first. */
export function parseSrcset(srcset: string): RankedSource[] {
  return srcset
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [url, descriptor] = entry.split(/\s+/, 2)
      if (!descriptor) return { url }
      if (descriptor.endsWith('w')) return { url, width: parseInt(descriptor, 10) }
      if (descriptor.endsWith('x')) return { url, density: parseFloat(descriptor) }
      return { url }
    })
    .sort(rankDescending)
}

/**
 * Width (px) and density (a multiplier of the image's own base size) aren't
 * comparable units, so they can't be combined into one numeric score. Any
 * source with a known width outranks any density-only source; among
 * density-only sources, higher density wins.
 */
function rankDescending(a: RankedSource, b: RankedSource): number {
  const widthA = a.width ?? -1
  const widthB = b.width ?? -1
  if (widthA !== widthB) return widthB - widthA
  return (b.density ?? 0) - (a.density ?? 0)
}

/** Ranked sources for an <img>: its own srcset, plus any ancestor <picture> <source> sets. */
export function imageSources(img: HTMLImageElement): RankedSource[] {
  const sources: RankedSource[] = []
  const picture = img.closest('picture')
  if (picture) {
    for (const source of picture.querySelectorAll('source')) {
      const srcset = source.getAttribute('srcset')
      if (srcset) sources.push(...parseSrcset(srcset))
    }
  }
  const ownSrcset = img.getAttribute('srcset')
  if (ownSrcset) sources.push(...parseSrcset(ownSrcset))
  if (img.currentSrc) sources.push({ url: img.currentSrc })
  if (img.src) sources.push({ url: img.src })
  return dedupeByUrl(sources).sort(rankDescending)
}

/** Ranked sources for a <video>/<audio>: its <source> children plus a direct src. */
export function mediaElementSources(el: HTMLMediaElement): RankedSource[] {
  const sources: RankedSource[] = []
  for (const source of el.querySelectorAll('source')) {
    const src = source.getAttribute('src')
    if (src) sources.push({ url: new URL(src, document.baseURI).href })
  }
  if (el.currentSrc) sources.push({ url: el.currentSrc })
  return dedupeByUrl(sources).sort(rankDescending)
}

/** CSS `background-image: url(...)`, resolved from computed style. */
export function cssBackgroundUrl(el: Element): string | null {
  const match = getComputedStyle(el).backgroundImage.match(/url\(["']?(.*?)["']?\)/)
  return match ? new URL(match[1], document.baseURI).href : null
}

/** Keeps the first occurrence of each URL — later duplicates are plain fallbacks (currentSrc/src) that carry no width/density metadata. */
function dedupeByUrl(sources: RankedSource[]): RankedSource[] {
  const seen = new Map<string, RankedSource>()
  for (const source of sources) if (!seen.has(source.url)) seen.set(source.url, source)
  return [...seen.values()]
}

/**
 * Breaks a tie between same-declared-size candidates by comparing actual
 * Content-Length via HEAD request. Falls back to the original order on
 * network failure (CORS, no CORS headers) rather than throwing.
 */
export async function probeLargestByContentLength(urls: string[]): Promise<string> {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(url, { method: 'HEAD' })
      const length = parseInt(response.headers.get('content-length') ?? '0', 10)
      return { url, length }
    }),
  )
  const sized = results
    .filter((r): r is PromiseFulfilledResult<{ url: string; length: number }> => r.status === 'fulfilled')
    .map((r) => r.value)
    .sort((a, b) => b.length - a.length)
  return sized[0]?.url ?? urls[0]
}

/** Content-Length of one URL via HEAD, or undefined on any failure (CORS, no header, network error). */
export async function probeContentLength(url: string): Promise<number | undefined> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    const header = response.headers.get('content-length')
    return header ? parseInt(header, 10) : undefined
  } catch {
    return undefined
  }
}
