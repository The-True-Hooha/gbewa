import type { ExtensionMessage } from '../types/messages'

/** Send a message to the background service worker. */
export async function sendToBackground<T = unknown>(message: ExtensionMessage): Promise<T> {
  return chrome.runtime.sendMessage(message)
}

/** Send a message to a specific tab's content script. */
export async function sendToTab<T = unknown>(tabId: number, message: ExtensionMessage): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message)
}

/**
 * Registers a listener that returns `true` when the callback is async, so
 * Chrome keeps the message channel open for `sendResponse`.
 */
export function onMessage(
  callback: (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) => Promise<unknown> | unknown,
): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const result = callback(message as ExtensionMessage, sender)
    if (result instanceof Promise) {
      result.then(sendResponse).catch((error) => sendResponse({ error: String(error) }))
      return true
    }
    sendResponse(result)
    return undefined
  })
}
