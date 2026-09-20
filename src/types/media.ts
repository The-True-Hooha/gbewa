/** One entry from an <img> srcset/picture, or a <video>/<audio> <source> list. */
export interface RankedSource {
  url: string
  width?: number
  density?: number
}

export interface ImageCandidate {
  kind: 'image'
  id: string
  sources: RankedSource[]
}

export interface VideoDirectCandidate {
  kind: 'video-direct'
  id: string
  sources: RankedSource[]
}

export interface AudioDirectCandidate {
  kind: 'audio-direct'
  id: string
  sources: RankedSource[]
}

export interface HlsRendition {
  url: string
  bandwidthBps: number
  resolution?: string
}

/**
 * `renditions` is absent until the background worker fetches and parses the
 * manifest (cross-origin, can't happen in the content script). Absence means
 * "not resolved yet", not "no renditions".
 */
export interface HlsCandidate {
  kind: 'hls'
  id: string
  manifestUrl: string
  renditions?: HlsRendition[]
}

export interface DashRendition {
  url: string
  bandwidthBps: number
  width?: number
  height?: number
}

export interface DashCandidate {
  kind: 'dash'
  id: string
  manifestUrl: string
  renditions?: DashRendition[]
}

export interface DrmBlockedCandidate {
  kind: 'drm-blocked'
  id: string
  reason: string
}

export type MediaCandidate =
  | ImageCandidate
  | VideoDirectCandidate
  | AudioDirectCandidate
  | HlsCandidate
  | DashCandidate
  | DrmBlockedCandidate

export type DownloadableCandidate = Exclude<MediaCandidate, DrmBlockedCandidate>

export type DownloadJob =
  | { id: string; candidateId: string; status: 'queued' }
  | { id: string; candidateId: string; status: 'resolving' }
  | { id: string; candidateId: string; status: 'downloading'; chromeDownloadId: number }
  | { id: string; candidateId: string; status: 'done'; chromeDownloadId: number; filename: string }
  | { id: string; candidateId: string; status: 'failed'; error: string }

/** A candidate plus the display info the bulk-scan grid needs. sizeBytes is absent until probed (or for HLS/DASH, never). */
export interface ScannedMedia {
  candidate: DownloadableCandidate
  filename: string
  extension: string
  width?: number
  height?: number
  sizeBytes?: number
  thumbnailUrl?: string
}

export type BatchItemStatus = 'queued' | 'downloading' | 'done' | 'failed'

export interface BatchItem {
  candidateId: string
  filename: string
  sizeBytes?: number
  status: BatchItemStatus
  chromeDownloadId?: number
  error?: string
}

export interface BatchSnapshot {
  items: BatchItem[]
  paused: boolean
}
