export interface TabManifests {
  hls?: string
  dash?: string
}

const tabManifests = new Map<number, TabManifests>()

/**
 * Many video players (YouTube-style, using MediaSource Extensions) never put
 * the manifest URL in the DOM — the page fetches it via JS. Watching network
 * requests is the only way to recover it. Cleared on each top-level navigation.
 */
export function initStreamSniffer(): void {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.tabId < 0) return
      if (details.type === 'main_frame') {
        tabManifests.delete(details.tabId)
        return
      }
      const entry = tabManifests.get(details.tabId) ?? {}
      if (details.url.includes('.m3u8')) entry.hls = details.url
      if (details.url.includes('.mpd')) entry.dash = details.url
      if (entry.hls || entry.dash) tabManifests.set(details.tabId, entry)
    },
    { urls: ['<all_urls>'] },
  )
  chrome.tabs.onRemoved.addListener((tabId) => tabManifests.delete(tabId))
}

export function getTabManifests(tabId: number): TabManifests {
  return tabManifests.get(tabId) ?? {}
}
