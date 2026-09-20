import type { AudioDirectCandidate, DownloadJob, ImageCandidate, VideoDirectCandidate } from '../types/media'
import { probeLargestByContentLength } from '../utils/quality'
import { reportJob, trackDownloadCompletion } from '../utils/trackDownload'

type DirectCandidate = ImageCandidate | VideoDirectCandidate | AudioDirectCandidate

/**
 * Resolves the best source for an image/video/audio-direct candidate and
 * starts a chrome.downloads job. The caller (picker.ts) doesn't read the RPC
 * response, so every outcome — including failure — is broadcast via
 * reportJob for the popup to pick up.
 */
export async function downloadDirectCandidate(candidate: DirectCandidate): Promise<DownloadJob> {
  const jobId = candidate.id
  try {
    const url = await resolveBestUrl(candidate)
    const chromeDownloadId = await chrome.downloads.download({ url })
    trackDownloadCompletion(jobId, candidate.id, chromeDownloadId)
    const job: DownloadJob = { id: jobId, candidateId: candidate.id, status: 'downloading', chromeDownloadId }
    reportJob(job)
    return job
  } catch (error) {
    const job: DownloadJob = { id: jobId, candidateId: candidate.id, status: 'failed', error: String(error) }
    reportJob(job)
    return job
  }
}

async function resolveBestUrl(candidate: DirectCandidate): Promise<string> {
  if (candidate.sources.length === 0) throw new Error('no sources found for candidate')
  const top = candidate.sources[0]
  const tiedAtTop = candidate.sources.filter((s) => (s.width ?? s.density) === (top.width ?? top.density))
  if (tiedAtTop.length <= 1) return top.url
  return probeLargestByContentLength(tiedAtTop.map((s) => s.url))
}
