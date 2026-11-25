/**
 * Identify an uploaded image by its first bytes instead of trusting the browser-supplied type or file name
 * (both can be faked). Only raster formats are accepted — never SVG, which can carry scripts.
 */
export type SafeImage = { mime: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; ext: 'jpg' | 'png' | 'gif' | 'webp' }

export function sniffImage(b: Uint8Array): SafeImage | null {
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return { mime: 'image/png', ext: 'png' }
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to))
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return { mime: 'image/gif', ext: 'gif' }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  return null
}

/** Browser types that mean the same thing ("image/jpg" is a common non-standard JPEG type). */
export const sameImageType = (claimed: string, real: SafeImage) => (claimed === 'image/jpg' ? 'image/jpeg' : claimed) === real.mime
