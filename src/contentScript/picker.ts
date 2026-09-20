import type { ExtensionMessage } from '../types/messages'
import { sendToBackground } from '../utils/messaging'
import { candidateFromElement } from './candidateFromElement'
import './picker.css'

let armed = false
let overlay: HTMLDivElement | null = null

// A top-level navigation reloads the content script (armed resets to false)
// without the popup knowing — announce the fresh state in case a popup left
// open across that navigation is still listening.
broadcastState()

export function isPickerArmed(): boolean {
  return armed
}

export function armPicker(): void {
  if (armed) return
  armed = true
  document.addEventListener('mousemove', onMouseMove, true)
  document.addEventListener('click', onClick, true)
  broadcastState()
}

export function disarmPicker(): void {
  if (!armed) return
  armed = false
  document.removeEventListener('mousemove', onMouseMove, true)
  document.removeEventListener('click', onClick, true)
  if (overlay) overlay.style.display = 'none'
  broadcastState()
}

function ensureOverlay(): HTMLDivElement {
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.className = 'media-grabber-overlay'
    document.body.appendChild(overlay)
  }
  return overlay
}

function findPickableElement(x: number, y: number): Element | null {
  const el = document.elementFromPoint(x, y)
  return el?.closest('img, video, audio') ?? el
}

function onMouseMove(event: MouseEvent): void {
  const target = findPickableElement(event.clientX, event.clientY)
  const box = ensureOverlay()
  if (!target) {
    box.style.display = 'none'
    return
  }
  const rect = target.getBoundingClientRect()
  box.style.display = 'block'
  box.style.left = `${rect.left}px`
  box.style.top = `${rect.top}px`
  box.style.width = `${rect.width}px`
  box.style.height = `${rect.height}px`
}

async function onClick(event: MouseEvent): Promise<void> {
  event.preventDefault()
  event.stopPropagation()
  const target = findPickableElement(event.clientX, event.clientY)
  disarmPicker()
  if (!target) return

  const candidate = await candidateFromElement(target)
  if (candidate) void sendToBackground({ type: 'RESOLVE_AND_DOWNLOAD', candidate })
}

function broadcastState(): void {
  chrome.runtime.sendMessage({ type: 'PICKER_STATE_CHANGED', armed } satisfies ExtensionMessage)
}
