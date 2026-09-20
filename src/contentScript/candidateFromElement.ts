import type { DownloadableCandidate } from '../types/media'
import { sendToBackground } from '../utils/messaging'
import { cssBackgroundUrl, imageSources, mediaElementSources } from '../utils/quality'

export type TabStreamManifests = { hls?: string; dash?: string }

/**
 * Builds a downloadable candidate from a clicked (or scanned) DOM element, or
 * null if nothing found. `knownManifests` lets a bulk scan fetch the tab's
 * last-observed HLS/DASH manifest once and reuse it across every element,
 * instead of one GET_TAB_STREAM_MANIFESTS round trip per element — a single
 * click always omits it and fetches its own.
 */
export async function candidateFromElement(
  el: Element,
  knownManifests?: TabStreamManifests,
): Promise<DownloadableCandidate | null> {
  const id = crypto.randomUUID()

  if (el instanceof HTMLImageElement) {
    const sources = imageSources(el)
    return sources.length ? { kind: 'image', id, sources } : null
  }

  if (el instanceof HTMLVideoElement || el instanceof HTMLAudioElement) {
    return mediaCandidateFromMediaElement(el, id, knownManifests)
  }

  const backgroundUrl = cssBackgroundUrl(el)
  return backgroundUrl ? { kind: 'image', id, sources: [{ url: backgroundUrl }] } : null
}

async function mediaCandidateFromMediaElement(
  el: HTMLMediaElement,
  id: string,
  knownManifests?: TabStreamManifests,
): Promise<DownloadableCandidate | null> {
  const directKind = el instanceof HTMLAudioElement ? 'audio-direct' : 'video-direct'
  const sources = mediaElementSources(el)
  const streamSource = sources.find((s) => s.url.includes('.m3u8') || s.url.includes('.mpd'))
  if (streamSource?.url.includes('.m3u8')) return { kind: 'hls', id, manifestUrl: streamSource.url }
  if (streamSource?.url.includes('.mpd')) return { kind: 'dash', id, manifestUrl: streamSource.url }

  if (sources.length > 0 && !sources[0].url.startsWith('blob:')) {
    return { kind: directKind, id, sources }
  }

  // MediaSource-based players (YouTube-style) never expose the manifest URL in
  // the DOM — fall back to whatever was last observed on the network for this tab.
  const manifests = knownManifests ?? (await sendToBackground<TabStreamManifests>({ type: 'GET_TAB_STREAM_MANIFESTS' }))
  if (manifests.hls) return { kind: 'hls', id, manifestUrl: manifests.hls }
  if (manifests.dash) return { kind: 'dash', id, manifestUrl: manifests.dash }

  return null
}
