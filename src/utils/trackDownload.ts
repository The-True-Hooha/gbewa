import type { DownloadJob } from '../types/media'
import type { ExtensionMessage } from '../types/messages'
import { getSettings } from './storage'

export function reportJob(job: DownloadJob): void {
  chrome.runtime.sendMessage({ type: 'DOWNLOAD_JOB_UPDATE', job } satisfies ExtensionMessage)
}

/**
 * Watches one chrome.downloads job to completion and broadcasts the final
 * DOWNLOAD_JOB_UPDATE. Works from both the background service worker and the
 * offscreen document — both have the chrome.downloads API.
 *
 * chrome.downloads.onChanged fires for every download in the browser, not
 * just ours, so this filters by the exact id we started and unsubscribes
 * once it settles — never notifies about a download this extension didn't start.
 */
export function trackDownloadCompletion(jobId: string, candidateId: string, chromeDownloadId: number): void {
  const listener = async (delta: chrome.downloads.DownloadDelta) => {
    if (delta.id !== chromeDownloadId || !delta.state) return
    chrome.downloads.onChanged.removeListener(listener)

    if (delta.state.current === 'interrupted') {
      reportJob({ id: jobId, candidateId, status: 'failed', error: 'download interrupted' })
      return
    }
    if (delta.state.current === 'complete') {
      const [download] = await chrome.downloads.search({ id: chromeDownloadId })
      const filename = download?.filename ?? ''
      reportJob({ id: jobId, candidateId, status: 'done', chromeDownloadId, filename })
      void notifyIfEnabled(filename)
    }
  }
  chrome.downloads.onChanged.addListener(listener)
}

async function notifyIfEnabled(filename: string): Promise<void> {
  const settings = await getSettings()
  if (!settings.notificationsEnabled) return
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/gbewa-48px.png',
    title: chrome.i18n.getMessage('extensionName'),
    message: filename.split('/').pop() ?? filename,
  })
}
