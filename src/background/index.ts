import { onMessage } from '../utils/messaging'
import { hasSeenWelcome, markWelcomeSeen } from '../utils/storage'
import {
  clearBatch,
  getBatchSnapshot,
  handleJobUpdate,
  openLastDownloadFolder,
  pauseBatch,
  resumeBatch,
  startBatch,
} from './batchManager'
import { dispatchDownload } from './dispatchDownload'
import { probeSizes } from './probeSizes'
import { getTabManifests, initStreamSniffer } from './streamSniffer'

initStreamSniffer()

onMessage(async (message, sender) => {
  switch (message.type) {
    case 'GET_TAB_STREAM_MANIFESTS':
      return sender.tab?.id !== undefined ? getTabManifests(sender.tab.id) : {}

    case 'RESOLVE_AND_DOWNLOAD':
      return dispatchDownload(message.candidate)

    case 'DOWNLOAD_JOB_UPDATE':
      handleJobUpdate(message.job)
      return undefined

    case 'GET_ASSET_SIZES':
      return probeSizes(message.candidates)

    case 'START_BATCH_DOWNLOAD':
      startBatch(message.items)
      return undefined

    case 'GET_BATCH_STATE':
      return getBatchSnapshot()

    case 'PAUSE_BATCH':
      pauseBatch()
      return undefined

    case 'RESUME_BATCH':
      resumeBatch()
      return undefined

    case 'CLEAR_BATCH':
      clearBatch()
      return undefined

    case 'OPEN_LAST_DOWNLOAD_FOLDER':
      openLastDownloadFolder()
      return undefined

    default:
      return undefined
  }
})

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== 'install') return
  if (await hasSeenWelcome()) return
  await markWelcomeSeen()
  chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') })
})
