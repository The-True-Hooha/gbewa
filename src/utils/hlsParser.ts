export interface HlsVariant {
  url: string
  bandwidthBps: number
  resolution?: string
}

export interface HlsMediaPlaylist {
  segmentUrls: string[]
  mapUri?: string
  encrypted: boolean
}

/** Parses an HLS master playlist (#EXT-X-STREAM-INF entries) into variants, largest bandwidth first. */
export function parseHlsMaster(text: string, baseUrl: string): HlsVariant[] {
  const lines = text.split('\n').map((line) => line.trim())
  const variants: HlsVariant[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXT-X-STREAM-INF:')) continue
    const attrs = parseAttributeList(lines[i].slice('#EXT-X-STREAM-INF:'.length))
    const uri = lines[i + 1]
    if (!uri || uri.startsWith('#')) continue
    variants.push({
      url: new URL(uri, baseUrl).href,
      bandwidthBps: parseInt(attrs.BANDWIDTH ?? '0', 10),
      resolution: attrs.RESOLUTION,
    })
  }
  return variants.sort((a, b) => b.bandwidthBps - a.bandwidthBps)
}

/**
 * Parses an HLS media (variant) playlist into its segment URLs. `encrypted`
 * is true when #EXT-X-KEY declares a real cipher (AES-128/SAMPLE-AES) —
 * such segments can't be concatenated into a playable file without decryption.
 */
export function parseHlsMediaPlaylist(text: string, baseUrl: string): HlsMediaPlaylist {
  const lines = text.split('\n').map((line) => line.trim())
  const segmentUrls: string[] = []
  let mapUri: string | undefined
  let encrypted = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('#EXT-X-KEY:')) {
      const attrs = parseAttributeList(line.slice('#EXT-X-KEY:'.length))
      if (attrs.METHOD && attrs.METHOD !== 'NONE') encrypted = true
    } else if (line.startsWith('#EXT-X-MAP:')) {
      const attrs = parseAttributeList(line.slice('#EXT-X-MAP:'.length))
      if (attrs.URI) mapUri = new URL(attrs.URI, baseUrl).href
    } else if (line.startsWith('#EXTINF:')) {
      const uri = lines[i + 1]
      if (uri && !uri.startsWith('#')) segmentUrls.push(new URL(uri, baseUrl).href)
    }
  }
  return { segmentUrls, mapUri, encrypted }
}

function parseAttributeList(text: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const regex = /([A-Z0-9-]+)=("([^"]*)"|[^,]*)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text))) {
    attrs[match[1]] = match[3] ?? match[2]
  }
  return attrs
}
