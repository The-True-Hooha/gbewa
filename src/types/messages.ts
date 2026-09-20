import type { BatchSnapshot, DownloadableCandidate, DownloadJob, ScannedMedia } from './media'

export type ExtensionMessage =
  | { type: 'ARM_PICKER' }
  | { type: 'DISARM_PICKER' }
  | { type: 'GET_PICKER_STATE' }
  | { type: 'PICKER_STATE_CHANGED'; armed: boolean }
  | { type: 'RESOLVE_AND_DOWNLOAD'; candidate: DownloadableCandidate }
  | { type: 'OFFSCREEN_RESOLVE_STREAM'; candidate: DownloadableCandidate }
  | { type: 'DOWNLOAD_JOB_UPDATE'; job: DownloadJob }
  | { type: 'GET_TAB_STREAM_MANIFESTS' }
  | { type: 'SCAN_PAGE_MEDIA' }
  | { type: 'GET_ASSET_SIZES'; candidates: DownloadableCandidate[] }
  | { type: 'START_BATCH_DOWNLOAD'; items: ScannedMedia[] }
  | { type: 'GET_BATCH_STATE' }
  | { type: 'BATCH_STATE_UPDATE'; batch: BatchSnapshot }
  | { type: 'PAUSE_BATCH' }
  | { type: 'RESUME_BATCH' }
  | { type: 'CLEAR_BATCH' }
  | { type: 'OPEN_LAST_DOWNLOAD_FOLDER' }

export type MessageOfType<T extends ExtensionMessage['type']> = Extract<ExtensionMessage, { type: T }>
