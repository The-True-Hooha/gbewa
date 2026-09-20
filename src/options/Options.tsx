import { useEffect, useState } from 'react'

import { applyTheme } from '../utils/applyTheme'
import { t } from '../utils/i18n'
import { getSettings, setSettings } from '../utils/storage'
import { DEFAULT_SETTINGS, type Settings } from '../types/settings'
import './Options.css'

const THEME_OPTIONS: Array<[Settings['theme'], string]> = [
  ['light', 'optionsThemeLight'],
  ['dark', 'optionsThemeDark'],
  ['system', 'optionsThemeSystem'],
]

export const Options = () => {
  const [settings, setLocalSettings] = useState<Settings>(DEFAULT_SETTINGS)

  useEffect(() => {
    void applyTheme()
    getSettings().then(setLocalSettings)
  }, [])

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch }
    setLocalSettings(next)
    void setSettings(next)
  }

  return (
    <main className="options">
      <h1>{t('optionsHeading')}</h1>

      <fieldset>
        <legend>{t('optionsThemeLabel')}</legend>
        {THEME_OPTIONS.map(([theme, labelKey]) => (
          <label key={theme} className="options-radio">
            <input
              type="radio"
              name="theme"
              checked={settings.theme === theme}
              onChange={() => updateSettings({ theme })}
            />
            {t(labelKey)}
          </label>
        ))}
      </fieldset>

      <label className="options-toggle">
        <input
          type="checkbox"
          checked={settings.notificationsEnabled}
          onChange={(e) => updateSettings({ notificationsEnabled: e.target.checked })}
        />
        {t('optionsNotificationsLabel')}
      </label>
    </main>
  )
}

export default Options
