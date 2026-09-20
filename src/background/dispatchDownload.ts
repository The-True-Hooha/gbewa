import type { DownloadableCandidate, DownloadJob } from '../types/media'
import { reportJob } from '../utils/trackDownload'
import { downloadDirectCandidate } from './downloadDirect'
import { ensureOffscreenDocument } from './offscreenManager'

/**
 * Routes a candidate to the right download path. image/video/audio-direct
 * resolve and download right here; HLS/DASH need a DOM (DOMParser,
 * URL.createObjectURL) unavailable in this service worker, so they're
 * forwarded to the offscreen document under a distinct message type —
 * re-sending RESOLVE_AND_DOWNLOAD would loop back into this same handler,
 * since chrome.runtime.sendMessage also delivers to the sender's own
 * onMessage listeners.
 *
 * ensureOffscreenDocument()/sendMessage() can reject (document creation
 * races, the offscreen page not listening yet). Unlike downloadDirectCandidate,
 * this path has no other try/catch above it — a swallowed rejection here
 * leaves a batch item stuck in 'downloading' forever, so every failure is
 * reported as a terminal job the same way the direct path already does.
 */
export async function dispatchDownload(candidate: DownloadableCandidate): Promise<DownloadJob | void> {
  if (candidate.kind === 'image' || candidate.kind === 'video-direct' || candidate.kind === 'audio-direct') {
    return downloadDirectCandidate(candidate)
  }
  try {
    await ensureOffscreenDocument()
    await chrome.runtime.sendMessage({ type: 'OFFSCREEN_RESOLVE_STREAM', candidate })
  } catch (error) {
    const job: DownloadJob = { id: candidate.id, candidateId: candidate.id, status: 'failed', error: String(error) }
    reportJob(job)
    return job
  }
}
