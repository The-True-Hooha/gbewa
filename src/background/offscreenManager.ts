let creating: Promise<void> | null = null

/** Lazily creates the offscreen document used for HLS/DASH segment concatenation + blob downloads. */
export async function ensureOffscreenDocument(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: 'src/offscreen/offscreen.html',
        reasons: [chrome.offscreen.Reason.BLOBS],
        justification: 'Fetch and concatenate HLS/DASH media segments into a downloadable file',
      })
      .finally(() => {
        creating = null
      })
  }
  await creating
}
