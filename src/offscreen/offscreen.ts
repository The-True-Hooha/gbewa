import { buildDashSegmentPlan, parseDashRepresentations } from '../utils/dashParser'
import { parseHlsMaster, parseHlsMediaPlaylist } from '../utils/hlsParser'
import { reportJob, trackDownloadCompletion } from '../utils/trackDownload'
import type { DashCandidate, HlsCandidate } from '../types/media'
import type { ExtensionMessage } from '../types/messages'

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type !== 'OFFSCREEN_RESOLVE_STREAM') return
  if (message.candidate.kind === 'hls') void resolveAndDownloadHls(message.candidate)
  if (message.candidate.kind === 'dash') void resolveAndDownloadDash(message.candidate)
})

async function resolveAndDownloadHls(candidate: HlsCandidate): Promise<void> {
  const jobId = candidate.id
  try {
    const masterText = await fetchText(candidate.manifestUrl)
    const variants = parseHlsMaster(masterText, candidate.manifestUrl)
    const best = variants[0]
    if (!best) throw new Error('no playable variants in HLS master playlist')

    const variantText = await fetchText(best.url)
    const playlist = parseHlsMediaPlaylist(variantText, best.url)
    if (playlist.encrypted) throw new Error('encrypted HLS segments are not supported')
    if (playlist.segmentUrls.length === 0) throw new Error('no segments in HLS media playlist')

    reportJob({ id: jobId, candidateId: candidate.id, status: 'resolving' })
    const buffers = await Promise.all(
      [...(playlist.mapUri ? [playlist.mapUri] : []), ...playlist.segmentUrls].map(fetchBuffer),
    )
    const blob = new Blob(buffers, { type: playlist.mapUri ? 'video/mp4' : 'video/mp2t' })
    await downloadBlob(jobId, candidate.id, blob, playlist.mapUri ? 'mp4' : 'ts')
  } catch (error) {
    reportJob({ id: jobId, candidateId: candidate.id, status: 'failed', error: String(error) })
  }
}

async function resolveAndDownloadDash(candidate: DashCandidate): Promise<void> {
  const jobId = candidate.id
  try {
    const manifestText = await fetchText(candidate.manifestUrl)
    const { representations, drmProtected } = parseDashRepresentations(manifestText)
    if (drmProtected) throw new Error('DRM-protected DASH stream is not supported')
    const best = representations.sort((a, b) => b.bandwidthBps - a.bandwidthBps)[0]
    if (!best) throw new Error('no representations in DASH manifest')

    const plan = buildDashSegmentPlan(manifestText, candidate.manifestUrl, best.id)
    if (plan.kind === 'unsupported') throw new Error(plan.reason)

    if (plan.kind === 'single-file') {
      const chromeDownloadId = await chrome.downloads.download({ url: plan.url })
      trackDownloadCompletion(jobId, candidate.id, chromeDownloadId)
      reportJob({ id: jobId, candidateId: candidate.id, status: 'downloading', chromeDownloadId })
      return
    }

    reportJob({ id: jobId, candidateId: candidate.id, status: 'resolving' })
    const buffers = await Promise.all([...(plan.initUrl ? [plan.initUrl] : []), ...plan.segmentUrls].map(fetchBuffer))
    const blob = new Blob(buffers, { type: 'video/mp4' })
    await downloadBlob(jobId, candidate.id, blob, 'mp4')
  } catch (error) {
    reportJob({ id: jobId, candidateId: candidate.id, status: 'failed', error: String(error) })
  }
}

async function downloadBlob(jobId: string, candidateId: string, blob: Blob, extension: string): Promise<void> {
  const blobUrl = URL.createObjectURL(blob)
  try {
    const chromeDownloadId = await chrome.downloads.download({ url: blobUrl, filename: `${candidateId}.${extension}` })
    trackDownloadCompletion(jobId, candidateId, chromeDownloadId)
    reportJob({ id: jobId, candidateId, status: 'downloading', chromeDownloadId })
    const revoke = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id !== chromeDownloadId || !delta.state) return
      if (delta.state.current === 'complete' || delta.state.current === 'interrupted') {
        URL.revokeObjectURL(blobUrl)
        chrome.downloads.onChanged.removeListener(revoke)
      }
    }
    chrome.downloads.onChanged.addListener(revoke)
  } catch (error) {
    URL.revokeObjectURL(blobUrl)
    throw error
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`fetch failed (${response.status}): ${url}`)
  return response.text()
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`fetch failed (${response.status}): ${url}`)
  return response.arrayBuffer()
}
