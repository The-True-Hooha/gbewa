import type { BatchItem, BatchSnapshot, DownloadableCandidate, DownloadJob, ScannedMedia } from '../types/media'
import type { ExtensionMessage } from '../types/messages'
import { trackDownloadCompletion } from '../utils/trackDownload'
import { dispatchDownload } from './dispatchDownload'

const CONCURRENCY = 2
const STORAGE_KEY = 'activeBatch'

/**
 * Plain objects/arrays (not Map/Set) so this survives a round trip through
 * chrome.storage.session as-is — needed because the service worker can be
 * torn down mid-batch and this module reloaded from scratch.
 */
interface Batch {
  order: string[]
  items: Record<string, BatchItem>
  candidates: Record<string, DownloadableCandidate>
  active: string[]
  paused: boolean
}

let batch: Batch | null = null

export function startBatch(scanned: ScannedMedia[]): void {
  if (batch && !isSettled(batch)) return // a batch is already running — ignore a duplicate start
  batch = {
    order: scanned.map((s) => s.candidate.id),
    items: Object.fromEntries(
      scanned.map((s) => [
        s.candidate.id,
        { candidateId: s.candidate.id, filename: s.filename, sizeBytes: s.sizeBytes, status: 'queued' as const },
      ]),
    ),
    candidates: Object.fromEntries(scanned.map((s) => [s.candidate.id, s.candidate])),
    active: [],
    paused: false,
  }
  persist()
  broadcastBatch()
  pump()
}

/** Dismisses a finished (or in-progress) batch so the popup can go back to the grid. */
export function clearBatch(): void {
  batch = null
  void chrome.storage.session.remove(STORAGE_KEY)
}

export function getBatchSnapshot(): BatchSnapshot | null {
  if (!batch) return null
  return { items: batch.order.map((id) => batch!.items[id]), paused: batch.paused }
}

export function pauseBatch(): void {
  if (!batch) return
  batch.paused = true
  for (const id of batch.active) {
    const downloadId = batch.items[id]?.chromeDownloadId
    if (downloadId !== undefined) chrome.downloads.pause(downloadId)
  }
  persist()
  broadcastBatch()
}

export function resumeBatch(): void {
  if (!batch) return
  batch.paused = false
  for (const id of batch.active) {
    const downloadId = batch.items[id]?.chromeDownloadId
    if (downloadId !== undefined) chrome.downloads.resume(downloadId)
  }
  persist()
  broadcastBatch()
  pump()
}

export function openLastDownloadFolder(): void {
  if (!batch) return
  const lastDone = [...batch.order]
    .reverse()
    .map((id) => batch!.items[id])
    .find((item) => item.status === 'done' && item.chromeDownloadId !== undefined)
  if (lastDone?.chromeDownloadId !== undefined) chrome.downloads.show(lastDone.chromeDownloadId)
}

/** Advances the queue on every DOWNLOAD_JOB_UPDATE broadcast — a no-op for jobs outside the active batch. */
export function handleJobUpdate(job: DownloadJob): void {
  if (!batch) return
  const item = batch.items[job.candidateId]
  if (!item) return

  if (job.status === 'downloading') item.chromeDownloadId = job.chromeDownloadId
  if (job.status === 'done') {
    item.status = 'done'
    batch.active = batch.active.filter((id) => id !== job.candidateId)
  }
  if (job.status === 'failed') {
    item.status = 'failed'
    item.error = job.error
    batch.active = batch.active.filter((id) => id !== job.candidateId)
  }

  persist()
  broadcastBatch()
  if (job.status === 'done' || job.status === 'failed') pump()
}

function pump(): void {
  if (!batch || batch.paused) return
  while (batch.active.length < CONCURRENCY) {
    const nextId = batch.order.find((id) => batch!.items[id].status === 'queued')
    if (!nextId) break
    batch.active.push(nextId)
    batch.items[nextId].status = 'downloading'
    void dispatchDownload(batch.candidates[nextId])
  }
  persist()
  broadcastBatch()
}

function isSettled(b: Batch): boolean {
  return b.order.every((id) => b.items[id].status === 'done' || b.items[id].status === 'failed')
}

function persist(): void {
  if (batch) void chrome.storage.session.set({ [STORAGE_KEY]: batch })
}

function broadcastBatch(): void {
  const snapshot = getBatchSnapshot()
  if (snapshot) chrome.runtime.sendMessage({ type: 'BATCH_STATE_UPDATE', batch: snapshot } satisfies ExtensionMessage)
}

/**
 * Runs once when this module (re)loads — including after the service worker
 * was torn down and restarted mid-batch. Reconciles anything that was
 * 'downloading' against chrome.downloads' own record (which persists
 * independently of the worker) instead of trusting stale in-memory state.
 */
async function rehydrate(): Promise<void> {
  const stored = (await chrome.storage.session.get(STORAGE_KEY))[STORAGE_KEY] as Batch | undefined
  if (!stored) return
  batch = stored

  for (const id of [...batch.active]) {
    const item = batch.items[id]
    if (item.chromeDownloadId === undefined) {
      item.status = 'failed'
      item.error = 'interrupted before a download could start'
      batch.active = batch.active.filter((x) => x !== id)
      continue
    }
    const [download] = await chrome.downloads.search({ id: item.chromeDownloadId })
    if (!download || download.state === 'interrupted') {
      item.status = 'failed'
      item.error = download?.error ?? 'download record lost'
      batch.active = batch.active.filter((x) => x !== id)
    } else if (download.state === 'complete') {
      item.status = 'done'
      batch.active = batch.active.filter((x) => x !== id)
    } else {
      // still genuinely in progress — the completion listener died with the old
      // worker instance, so re-arm it against the same chrome.downloads id.
      trackDownloadCompletion(item.candidateId, item.candidateId, item.chromeDownloadId)
    }
  }

  persist()
  broadcastBatch()
  pump()
}

void rehydrate()
