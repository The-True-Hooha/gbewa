export interface DashRepresentation {
  id: string
  bandwidthBps: number
  width?: number
  height?: number
}

export type DashSegmentPlan =
  | { kind: 'single-file'; url: string }
  | { kind: 'templated'; initUrl?: string; segmentUrls: string[] }
  | { kind: 'unsupported'; reason: string }

/**
 * Requires a DOM (DOMParser) — must run in a document context (the
 * extension's offscreen document), not the background service worker.
 */
export function parseDashRepresentations(xmlText: string): {
  representations: DashRepresentation[]
  drmProtected: boolean
} {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const drmProtected = doc.getElementsByTagName('ContentProtection').length > 0
  const representations: DashRepresentation[] = []
  for (const repEl of Array.from(doc.getElementsByTagName('Representation'))) {
    representations.push({
      id: repEl.getAttribute('id') ?? '',
      bandwidthBps: parseInt(repEl.getAttribute('bandwidth') ?? '0', 10),
      width: numOrUndefined(repEl.getAttribute('width')),
      height: numOrUndefined(repEl.getAttribute('height')),
    })
  }
  return { representations, drmProtected: drmProtected && representations.length > 0 }
}

/** Builds the segment plan for one representation, resolving inherited SegmentTemplate from its AdaptationSet. */
export function buildDashSegmentPlan(xmlText: string, baseUrl: string, representationId: string): DashSegmentPlan {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const repEl = Array.from(doc.getElementsByTagName('Representation')).find(
    (el) => el.getAttribute('id') === representationId,
  )
  if (!repEl) return { kind: 'unsupported', reason: 'representation not found in manifest' }

  const baseUrlEl = repEl.getElementsByTagName('BaseURL')[0]
  if (baseUrlEl?.textContent) {
    return { kind: 'single-file', url: new URL(baseUrlEl.textContent.trim(), baseUrl).href }
  }

  const segmentTemplate = repEl.getElementsByTagName('SegmentTemplate')[0] ?? adaptationSetOf(repEl)?.getElementsByTagName('SegmentTemplate')[0]
  if (!segmentTemplate) return { kind: 'unsupported', reason: 'no BaseURL or SegmentTemplate found' }
  if (segmentTemplate.getElementsByTagName('SegmentTimeline').length > 0) {
    return { kind: 'unsupported', reason: 'SegmentTimeline manifests are not supported' }
  }

  const media = segmentTemplate.getAttribute('media')
  const initialization = segmentTemplate.getAttribute('initialization')
  const duration = parseFloat(segmentTemplate.getAttribute('duration') ?? '0')
  const timescale = parseFloat(segmentTemplate.getAttribute('timescale') ?? '1')
  const startNumber = parseInt(segmentTemplate.getAttribute('startNumber') ?? '1', 10)
  if (!media || !duration) return { kind: 'unsupported', reason: 'SegmentTemplate missing media/duration' }

  const periodDurationSec = parseIsoDuration(doc.getElementsByTagName('MPD')[0]?.getAttribute('mediaPresentationDuration'))
  if (!periodDurationSec) return { kind: 'unsupported', reason: 'cannot determine total duration to count segments' }

  const segmentDurationSec = duration / timescale
  const segmentCount = Math.ceil(periodDurationSec / segmentDurationSec)
  const segmentUrls = Array.from({ length: segmentCount }, (_, i) =>
    new URL(media.replace('$RepresentationID$', representationId).replace('$Number$', String(startNumber + i)), baseUrl).href,
  )
  const initUrl = initialization
    ? new URL(initialization.replace('$RepresentationID$', representationId), baseUrl).href
    : undefined

  return { kind: 'templated', initUrl, segmentUrls }
}

function adaptationSetOf(repEl: Element): Element | null {
  return repEl.parentElement?.tagName === 'AdaptationSet' ? repEl.parentElement : null
}

function numOrUndefined(value: string | null): number | undefined {
  return value ? parseInt(value, 10) : undefined
}

function parseIsoDuration(value: string | null | undefined): number | null {
  if (!value) return null
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/)
  if (!match) return null
  const [, h, m, s] = match
  return (parseInt(h ?? '0', 10) * 3600) + (parseInt(m ?? '0', 10) * 60) + parseFloat(s ?? '0')
}
