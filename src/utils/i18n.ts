/** Thin wrapper over chrome.i18n so React components call one short function. */
export function t(key: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(key, substitutions) || key
}
