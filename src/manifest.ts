import { defineManifest } from '@crxjs/vite-plugin'
import packageData from '../package.json'

//@ts-ignore
const isDev = process.env.NODE_ENV == 'development'

export default defineManifest({
  name: `__MSG_extensionName__${isDev ? ` ➡️ Dev` : ''}`,
  description: '__MSG_extensionDescription__',
  default_locale: 'en',
  version: packageData.version,
  manifest_version: 3,
  icons: {
    16: 'icons/gbewa-16px.png',
    32: 'icons/gbewa-32px.png',
    48: 'icons/gbewa-48px.png',
    128: 'icons/gbewa-128px.png',
  },
  action: {
    default_popup: 'popup.html',
    default_icon: 'icons/gbewa-48px.png',
  },
  // "_execute_action" is a built-in Chrome command name: Chrome opens the
  // popup itself on this shortcut, no listener code needed.
  commands: {
    _execute_action: {
      suggested_key: { default: 'Ctrl+G', mac: 'Alt+G' },
      description: 'Open gbewa',
    },
  },
  options_page: 'options.html',
  devtools_page: 'devtools.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/contentScript/index.ts'],
    },
  ],
  side_panel: {
    default_path: 'sidepanel.html',
  },
  web_accessible_resources: [
    {
      resources: ['icons/gbewa-16px.png', 'icons/gbewa-32px.png', 'icons/gbewa-48px.png', 'icons/gbewa-128px.png'],
      matches: [],
    },
  ],
  permissions: ['sidePanel', 'storage', 'downloads', 'notifications', 'offscreen', 'webRequest'],
  // Media URLs to probe/fetch (quality HEAD-probes, HLS/DASH manifests and
  // segments) can be on any domain the user is browsing — narrower than
  // <all_urls> isn't possible without knowing sites in advance.
  host_permissions: ['<all_urls>'],
})
