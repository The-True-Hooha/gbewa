import type { ScannedMedia } from '../types/media'
import { filenameFromUrl } from '../utils/filename'
import { mapWithConcurrency } from '../utils/mapWithConcurrency'
import { sendToBackground } from '../utils/messaging'
import { candidateFromElement, type TabStreamManifests } from './candidateFromElement'

const SCAN_LIMIT = 300
const SCAN_CONCURRENCY = 8

/** Enumerates every img/video/audio on the page. CSS background-images aren't included — scanning computed style on every DOM node is too expensive to do in bulk (still supported one-at-a-time via the click-to-pick picker). */
export async function scanPageMedia(): Promise<ScannedMedia[]> {
  const elements = [...document.querySelectorAll('img, video, audio')].slice(0, SCAN_LIMIT)

  // Fetched once up front — every sourceless video/audio element in this scan
  // would otherwise ask the background for the same tab-wide answer.
  const manifests = await sendToBackground<TabStreamManifests>({ type: 'GET_TAB_STREAM_MANIFESTS' })

  const counters = { image: 0, video: 0, audio: 0 }
  const built = await mapWithConcurrency(elements, SCAN_CONCURRENCY, async (el) => toScannedMedia(el, manifests, counters))
  return built.filter((item): item is ScannedMedia => item !== null)
}

async function toScannedMedia(
  el: Element,
  manifests: TabStreamManifests,
  counters: Record<'image' | 'video' | 'audio', number>,
): Promise<ScannedMedia | null> {
  const candidate = await candidateFromElement(el, manifests)
  if (!candidate) return null

  const mediaType = candidate.kind === 'image' ? 'image' : candidate.kind === 'audio-direct' ? 'audio' : 'video'
  const sourceUrl = candidate.kind === 'hls' || candidate.kind === 'dash' ? candidate.manifestUrl : candidate.sources[0]?.url
  const { filename, extension } = filenameFromUrl(sourceUrl ?? '', mediaType, counters[mediaType]++)

  return {
    candidate,
    filename,
    extension: candidate.kind === 'hls' || candidate.kind === 'dash' ? candidate.kind.toUpperCase() : extension,
    ...dimensionsAndThumbnail(el),
  }
}

function dimensionsAndThumbnail(el: Element): Pick<ScannedMedia, 'width' | 'height' | 'thumbnailUrl'> {
  if (el instanceof HTMLImageElement) {
    return {
      width: el.naturalWidth || undefined,
      height: el.naturalHeight || undefined,
      thumbnailUrl: el.currentSrc || el.src,
    }
  }
  if (el instanceof HTMLVideoElement) {
    return {
      width: el.videoWidth || undefined,
      height: el.videoHeight || undefined,
      thumbnailUrl: videoThumbnail(el),
    }
  }
  return {}
}

/** Best-effort frame-0 snapshot. Cross-origin video without CORS headers taints the canvas and throws — falls back to `poster`, then nothing. */
function videoThumbnail(video: HTMLVideoElement): string | undefined {
  if (video.readyState < 2) return video.poster || undefined
  try {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return video.poster || undefined
    ctx.drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.6)
  } catch {
    return video.poster || undefined
  }
}
