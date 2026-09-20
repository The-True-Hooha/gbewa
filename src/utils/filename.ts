const DEFAULT_EXTENSION: Record<'image' | 'video' | 'audio', string> = { image: 'jpg', video: 'mp4', audio: 'mp3' }

/** Derives a display filename + extension from a URL, falling back to a generated name for extensionless/unparsable URLs. */
export function filenameFromUrl(
  url: string,
  mediaType: 'image' | 'video' | 'audio',
  index: number,
): { filename: string; extension: string } {
  let base = `${mediaType}-${index + 1}`
  let extension = DEFAULT_EXTENSION[mediaType]

  try {
    const pathname = new URL(url).pathname
    const last = decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? '')
    const dotIndex = last.lastIndexOf('.')
    if (dotIndex > 0) {
      base = last.slice(0, dotIndex)
      extension = last.slice(dotIndex + 1)
    } else if (last) {
      base = last
    }
  } catch {
    // keep the generated fallback
  }

  return { filename: `${base}.${extension.toLowerCase()}`, extension: extension.toUpperCase() }
}
