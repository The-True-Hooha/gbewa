import { DEFAULT_SETTINGS, type Settings } from '../types/settings'

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get('settings')
  return { ...DEFAULT_SETTINGS, ...(result.settings as Settings | undefined) }
}

export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ settings })
}

export function onSettingsChanged(callback: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.settings) {
      callback({ ...DEFAULT_SETTINGS, ...(changes.settings.newValue as Settings | undefined) })
    }
  })
}

/** Presence of this key means the welcome page has already been shown. */
export async function hasSeenWelcome(): Promise<boolean> {
  const result = await chrome.storage.local.get('welcomeShownAt')
  return result.welcomeShownAt !== undefined
}

export async function markWelcomeSeen(): Promise<void> {
  await chrome.storage.local.set({ welcomeShownAt: Date.now() })
}
