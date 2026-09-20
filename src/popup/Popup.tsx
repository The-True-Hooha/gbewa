import { useEffect, useState } from 'react'

import packageData from '../../package.json'
import type { BatchItem, BatchSnapshot, DownloadableCandidate, DownloadJob, ScannedMedia } from '../types/media'
import { applyTheme } from '../utils/applyTheme'
import { formatBytes } from '../utils/formatBytes'
import { t } from '../utils/i18n'
import { onMessage, sendToBackground, sendToTab } from '../utils/messaging'
import './Popup.css'

type Filter = 'all' | 'image' | 'video' | 'audio'
type SortOrder = 'largest' | 'smallest' | 'name'

const isVideoKind = (kind: DownloadableCandidate['kind']) => kind === 'video-direct' || kind === 'hls' || kind === 'dash'

const matchesFilter = (filter: Filter, item: ScannedMedia): boolean => {
  switch (filter) {
    case 'all':
      return true
    case 'image':
      return item.candidate.kind === 'image'
    case 'audio':
      return item.candidate.kind === 'audio-direct'
    case 'video':
      return isVideoKind(item.candidate.kind)
  }
}

export const Popup = () => {
  const [tabId, setTabId] = useState<number | null>(null)
  const [tabInfo, setTabInfo] = useState<{ hostname: string; favIconUrl?: string }>({ hostname: '' })
  const [unavailable, setUnavailable] = useState(false)
  const [armed, setArmed] = useState(false)
  const [lastJob, setLastJob] = useState<DownloadJob | null>(null)

  const [scanned, setScanned] = useState<ScannedMedia[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<SortOrder>('largest')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [batch, setBatch] = useState<BatchSnapshot | null>(null)
  const [startingBatch, setStartingBatch] = useState(false)

  useEffect(() => {
    void applyTheme()
    void init()

    onMessage((message) => {
      if (message.type === 'PICKER_STATE_CHANGED') setArmed(message.armed)
      if (message.type === 'DOWNLOAD_JOB_UPDATE') setLastJob(message.job)
      if (message.type === 'BATCH_STATE_UPDATE') setBatch(message.batch)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const init = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return
    setTabId(tab.id)

    try {
      const hostname = tab.url ? new URL(tab.url).hostname : ''
      setTabInfo({ hostname, favIconUrl: tab.favIconUrl })
      const state = await sendToTab<{ armed: boolean }>(tab.id, { type: 'GET_PICKER_STATE' })
      setArmed(state.armed)
    } catch {
      setUnavailable(true)
      return
    }

    const existingBatch = await sendToBackground<BatchSnapshot | null>({ type: 'GET_BATCH_STATE' })
    if (existingBatch) {
      setBatch(existingBatch)
      return
    }
    await runScan(tab.id)
  }

  const runScan = async (id: number) => {
    setScanning(true)
    setSelected(new Set())
    try {
      const found = await sendToTab<ScannedMedia[]>(id, { type: 'SCAN_PAGE_MEDIA' })
      setScanned(found)
      const sizes = await sendToBackground<Record<string, number>>({
        type: 'GET_ASSET_SIZES',
        candidates: found.map((item) => item.candidate),
      })
      setScanned(found.map((item) => (item.candidate.id in sizes ? { ...item, sizeBytes: sizes[item.candidate.id] } : item)))
    } catch {
      setScanned([])
    } finally {
      setScanning(false)
    }
  }

  const toggleArmed = async () => {
    if (tabId === null) return
    try {
      await sendToTab(tabId, { type: armed ? 'DISARM_PICKER' : 'ARM_PICKER' })
    } catch {
      setUnavailable(true)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visible = (scanned ?? []).filter((item) => matchesFilter(filter, item))
  const sorted = [...visible].sort((a, b) => {
    if (sort === 'name') return a.filename.localeCompare(b.filename)
    const diff = (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0)
    return sort === 'largest' ? -diff : diff
  })

  const allVisibleSelected = sorted.length > 0 && sorted.every((item) => selected.has(item.candidate.id))
  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const item of sorted) {
        if (allVisibleSelected) next.delete(item.candidate.id)
        else next.add(item.candidate.id)
      }
      return next
    })
  }

  const selectedItems = (scanned ?? []).filter((item) => selected.has(item.candidate.id))
  const selectedBytes = selectedItems.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0)

  const startDownload = () => {
    // The backend also guards against a duplicate START_BATCH_DOWNLOAD, but
    // disabling here avoids firing the extra round trip (and extra scan
    // request) in the first place on a fast double-click.
    setStartingBatch(true)
    void sendToBackground({ type: 'START_BATCH_DOWNLOAD', items: selectedItems })
  }

  const dismissBatch = async () => {
    await sendToBackground({ type: 'CLEAR_BATCH' })
    setBatch(null)
    if (tabId !== null) void runScan(tabId)
  }

  if (batch) {
    return (
      <BatchView
        batch={batch}
        onTogglePause={() => void sendToBackground({ type: batch.paused ? 'RESUME_BATCH' : 'PAUSE_BATCH' })}
        onOpenFolder={() => void sendToBackground({ type: 'OPEN_LAST_DOWNLOAD_FOLDER' })}
        onDone={dismissBatch}
      />
    )
  }

  return (
    <main className="popup">
      <PopupHeader armed={armed} unavailable={unavailable} onToggleArmed={toggleArmed} />

      {unavailable && (
        <EmptyState title={t('popupUnavailable')} body="" onRescan={undefined} />
      )}

      {!unavailable && armed && <p className="popup-hint">{t('popupArmedHint')}</p>}
      {!unavailable && !armed && lastJob && <JobStatus job={lastJob} />}

      {!unavailable && scanning && scanned === null && (
        <div className="popup-loading">
          <span className="popup-spinner" aria-hidden="true" />
          {t('popupScanning')}
        </div>
      )}

      {!unavailable && !scanning && scanned !== null && scanned.length === 0 && (
        <EmptyState
          title={t('popupEmptyTitle')}
          body={t('popupEmptyBody')}
          onRescan={() => tabId !== null && void runScan(tabId)}
        />
      )}

      {!unavailable && scanned !== null && scanned.length > 0 && (
        <>
          <SiteSummary
            hostname={tabInfo.hostname}
            favIconUrl={tabInfo.favIconUrl}
            count={scanned.length}
            totalBytes={scanned.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0)}
            scanning={scanning}
            onRescan={() => tabId !== null && void runScan(tabId)}
          />

          <FilterTabs scanned={scanned} filter={filter} onChange={setFilter} />

          <div className="popup-list-controls">
            <label className="popup-select-all">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
              {t('popupSelectAll')}
            </label>
            <select className="popup-sort" value={sort} onChange={(e) => setSort(e.target.value as SortOrder)}>
              <option value="largest">{t('popupSortLargest')}</option>
              <option value="smallest">{t('popupSortSmallest')}</option>
              <option value="name">{t('popupSortName')}</option>
            </select>
          </div>

          <div className="popup-grid">
            {sorted.map((item) => (
              <MediaCard
                key={item.candidate.id}
                item={item}
                selected={selected.has(item.candidate.id)}
                onToggle={() => toggleSelect(item.candidate.id)}
              />
            ))}
          </div>

          <SelectionBar count={selected.size} bytes={selectedBytes} onDownload={startDownload} disabled={startingBatch} />
        </>
      )}
    </main>
  )
}

const PopupHeader = ({
  armed,
  unavailable,
  onToggleArmed,
}: {
  armed: boolean
  unavailable: boolean
  onToggleArmed: () => void
}) => (
  <header className="popup-header">
    <div className="popup-brand">
      <img src="/icons/gbewa-32px.png" alt="" width={28} height={28} className="popup-brand-icon" />
      <span className="popup-brand-name">gbewa</span>
      <span className="popup-version-badge">{packageData.version}</span>
    </div>
    <div className="popup-header-actions">
      <button
        className={`popup-icon-button ${armed ? 'popup-icon-button-active' : ''}`}
        title={t(armed ? 'popupDisarmButton' : 'popupArmButton')}
        aria-label={t(armed ? 'popupDisarmButton' : 'popupArmButton')}
        onClick={onToggleArmed}
        disabled={unavailable}
      >
        &#8982;
      </button>
      <button
        className="popup-icon-button"
        title={t('popupHistoryLink')}
        aria-label={t('popupHistoryLink')}
        onClick={() => chrome.tabs.create({ url: 'chrome://downloads' })}
      >
        &#8635;
      </button>
      <button
        className="popup-icon-button"
        title={t('popupSettingsLink')}
        aria-label={t('popupSettingsLink')}
        onClick={() => chrome.runtime.openOptionsPage()}
      >
        &#9881;
      </button>
    </div>
  </header>
)

const SiteSummary = ({
  hostname,
  favIconUrl,
  count,
  totalBytes,
  scanning,
  onRescan,
}: {
  hostname: string
  favIconUrl?: string
  count: number
  totalBytes: number
  scanning: boolean
  onRescan: () => void
}) => (
  <div className="popup-site-summary">
    {favIconUrl ? <img src={favIconUrl} alt="" className="popup-site-favicon" /> : <span className="popup-site-favicon-placeholder" />}
    <div className="popup-site-text">
      <p className="popup-site-hostname">{hostname}</p>
      <p className="popup-site-meta">
        {count} assets &middot; {formatBytes(totalBytes)} &middot; <span className="popup-site-status">{scanning ? 'scanning' : 'scanned'}</span>
      </p>
    </div>
    <button className="popup-icon-button" onClick={onRescan} disabled={scanning} aria-label={t('popupScanAgain')} title={t('popupScanAgain')}>
      &#8635;
    </button>
  </div>
)

const FilterTabs = ({
  scanned,
  filter,
  onChange,
}: {
  scanned: ScannedMedia[]
  filter: Filter
  onChange: (filter: Filter) => void
}) => {
  const counts = {
    all: scanned.length,
    image: scanned.filter((item) => item.candidate.kind === 'image').length,
    video: scanned.filter((item) => isVideoKind(item.candidate.kind)).length,
    audio: scanned.filter((item) => item.candidate.kind === 'audio-direct').length,
  }
  const tabs: Array<[Filter, string]> = [
    ['all', t('popupFilterAll')],
    ['image', t('popupFilterImages')],
    ['video', t('popupFilterVideo')],
    ['audio', t('popupFilterAudio')],
  ]
  return (
    <div className="popup-filter-tabs">
      {tabs.map(([key, label]) =>
        counts[key] === 0 && key !== 'all' ? null : (
          <button
            key={key}
            className={`popup-filter-tab ${filter === key ? 'popup-filter-tab-active' : ''}`}
            onClick={() => onChange(key)}
          >
            {label} <span className="popup-filter-count">{counts[key]}</span>
          </button>
        ),
      )}
    </div>
  )
}

const MediaCard = ({ item, selected, onToggle }: { item: ScannedMedia; selected: boolean; onToggle: () => void }) => (
  <button className={`popup-card ${selected ? 'popup-card-selected' : ''}`} onClick={onToggle}>
    <div className="popup-card-thumb">
      {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <span className="popup-card-thumb-fallback">{kindGlyph(item.candidate.kind)}</span>}
      <span className="popup-card-ext">{item.extension}</span>
      <span className={`popup-card-check ${selected ? 'popup-card-check-selected' : ''}`}>{selected ? '✓' : ''}</span>
    </div>
    <p className="popup-card-filename">{item.filename}</p>
    <p className="popup-card-meta">
      {item.width && item.height ? `${item.width}×${item.height} · ` : ''}
      {formatBytes(item.sizeBytes)}
    </p>
  </button>
)

function kindGlyph(kind: DownloadableCandidate['kind']): string {
  if (kind === 'audio-direct') return '♫'
  if (isVideoKind(kind)) return '▶'
  return '▣'
}

const SelectionBar = ({
  count,
  bytes,
  onDownload,
  disabled,
}: {
  count: number
  bytes: number
  onDownload: () => void
  disabled: boolean
}) => (
  <div className="popup-selection-bar">
    <p className="popup-selection-summary">
      {count} selected
      {count > 0 && (
        <>
          {' '}
          &middot; {formatBytes(bytes)} &middot; {t('popupSavesTo')} /gbewa
        </>
      )}
    </p>
    <button className="popup-download-button" onClick={onDownload} disabled={count === 0 || disabled}>
      {t('popupDownloadButton')}
    </button>
  </div>
)

const EmptyState = ({ title, body, onRescan }: { title: string; body: string; onRescan: (() => void) | undefined }) => (
  <div className="popup-empty">
    <span className="popup-empty-icon" aria-hidden="true">
      &#8981;
    </span>
    <h2>{title}</h2>
    {body && <p>{body}</p>}
    {onRescan && (
      <button className="popup-rescan-button" onClick={onRescan}>
        &#8635; {t('popupScanAgain')}
      </button>
    )}
    {onRescan && <p className="popup-shortcut-hint">{t('popupShortcutHint')}</p>}
  </div>
)

const JobStatus = ({ job }: { job: DownloadJob }) => {
  if (job.status === 'failed') return <p className="popup-job popup-job-failed">{job.error}</p>
  if (job.status === 'done') return <p className="popup-job popup-job-done">{job.filename}</p>
  return <p className="popup-job">{job.status}…</p>
}

const BatchView = ({
  batch,
  onTogglePause,
  onOpenFolder,
  onDone,
}: {
  batch: BatchSnapshot
  onTogglePause: () => void
  onOpenFolder: () => void
  onDone: () => void
}) => {
  const [liveBytes, setLiveBytes] = useState<Record<number, number>>({})

  useEffect(() => {
    const activeIds = batch.items
      .filter((item): item is BatchItem & { chromeDownloadId: number } => item.status === 'downloading' && item.chromeDownloadId !== undefined)
      .map((item) => item.chromeDownloadId)
    if (activeIds.length === 0) return

    const poll = async () => {
      const entries = await Promise.all(
        activeIds.map(async (id) => {
          const [download] = await chrome.downloads.search({ id })
          return [id, download?.bytesReceived ?? 0] as const
        }),
      )
      setLiveBytes(Object.fromEntries(entries))
    }
    void poll()
    const interval = setInterval(poll, 600)
    return () => clearInterval(interval)
  }, [batch])

  const totalBytes = batch.items.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0)
  const receivedBytes = batch.items.reduce((sum, item) => {
    if (item.status === 'done') return sum + (item.sizeBytes ?? 0)
    if (item.status === 'downloading' && item.chromeDownloadId !== undefined) return sum + (liveBytes[item.chromeDownloadId] ?? 0)
    return sum
  }, 0)
  const percent = totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 0
  const allSettled = batch.items.every((item) => item.status === 'done' || item.status === 'failed')
  const doneCount = batch.items.filter((item) => item.status === 'done').length

  return (
    <main className="popup">
      <div className="popup-batch-progress">
        <div className="popup-batch-progress-header">
          <p>
            {allSettled ? `${doneCount} of ${batch.items.length} downloaded` : `Downloading ${batch.items.length} files`}
          </p>
          {totalBytes > 0 && <p className="popup-batch-percent">{percent}%</p>}
        </div>
        {totalBytes > 0 && (
          <div className="popup-progress-track">
            <div className="popup-progress-fill" style={{ width: `${percent}%` }} />
          </div>
        )}
        {totalBytes > 0 && (
          <p className="popup-batch-bytes">
            {formatBytes(receivedBytes)} of {formatBytes(totalBytes)}
          </p>
        )}
      </div>

      <div className="popup-batch-list">
        {batch.items.map((item) => (
          <div key={item.candidateId} className="popup-batch-item">
            <span className={`popup-batch-item-icon popup-batch-item-icon-${item.status}`} aria-hidden="true">
              {item.status === 'done' ? '✓' : item.status === 'failed' ? '✕' : item.status === 'downloading' ? '' : '⧖'}
            </span>
            <div className="popup-batch-item-text">
              <p className="popup-batch-item-filename">{item.filename}</p>
              <p className="popup-batch-item-meta">
                {item.status === 'failed' ? item.error : formatBytes(item.sizeBytes)} &middot; {item.status}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="popup-batch-footer">
        {!allSettled && (
          <button className="popup-pause-button" onClick={onTogglePause}>
            {t(batch.paused ? 'popupResume' : 'popupPause')}
          </button>
        )}
        <button className="popup-pause-button" onClick={onOpenFolder} disabled={doneCount === 0}>
          {t('popupOpenFolder')}
        </button>
        {allSettled && (
          <button className="popup-download-button" onClick={onDone}>
            {t('popupDone')}
          </button>
        )}
      </div>
    </main>
  )
}

export default Popup
