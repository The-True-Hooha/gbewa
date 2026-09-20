import type { AudioDirectCandidate, DownloadableCandidate, ImageCandidate, VideoDirectCandidate } from '../types/media'
import { mapWithConcurrency } from '../utils/mapWithConcurrency'
import { probeContentLength } from '../utils/quality'

type DirectCandidate = ImageCandidate | VideoDirectCandidate | AudioDirectCandidate

const PROBE_CONCURRENCY = 6

function isDirectCandidate(candidate: DownloadableCandidate): candidate is DirectCandidate {
  return candidate.kind === 'image' || candidate.kind === 'video-direct' || candidate.kind === 'audio-direct'
}

/**
 * HEAD-probes byte size for image/video/audio-direct candidates only.
 * HLS/DASH size would require fetching and parsing the whole manifest —
 * too expensive to do eagerly for every stream found on a page.
 */
export async function probeSizes(candidates: DownloadableCandidate[]): Promise<Record<string, number>> {
  const probeable = candidates.filter(isDirectCandidate)
  const sizes: Record<string, number> = {}
  await mapWithConcurrency(probeable, PROBE_CONCURRENCY, async (candidate) => {
    const url = candidate.sources[0]?.url
    if (!url) return
    const length = await probeContentLength(url)
    if (length !== undefined) sizes[candidate.id] = length
  })
  return sizes
}
