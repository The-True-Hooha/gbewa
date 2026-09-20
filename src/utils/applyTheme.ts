import { getSettings, onSettingsChanged } from './storage'
import type { Settings } from '../types/settings'

/** Sets `data-theme` on <html> from stored settings, and keeps it in sync with changes. */
export async function applyTheme(): Promise<void> {
  setThemeAttribute((await getSettings()).theme)
  onSettingsChanged((settings) => setThemeAttribute(settings.theme))
}

function setThemeAttribute(theme: Settings['theme']): void {
  const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
  document.documentElement.dataset.theme = resolved
}
