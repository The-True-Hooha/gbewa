export interface Settings {
  theme: 'light' | 'dark' | 'system'
  notificationsEnabled: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  notificationsEnabled: true,
}
