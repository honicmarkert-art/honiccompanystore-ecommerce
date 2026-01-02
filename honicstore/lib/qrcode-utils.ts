import QRCode from 'qrcode'

export interface QRCodeOptions {
  width?: number
  margin?: number
  color?: {
    dark?: string
    light?: string
  }
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
}

/**
 * Generate QR code as data URL (base64 image)
 */
export async function generateQRCodeDataURL(
  text: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const {
    width = 300,
    margin = 1,
    color = {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel = 'M'
  } = options

  try {
    const dataURL = await QRCode.toDataURL(text, {
      width,
      margin,
      color,
      errorCorrectionLevel
    })
    return dataURL
  } catch (error) {
    console.error('Error generating QR code:', error)
    throw new Error('Failed to generate QR code')
  }
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(
  text: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const {
    width = 300,
    margin = 1,
    color = {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel = 'M'
  } = options

  try {
    const svg = await QRCode.toString(text, {
      type: 'svg',
      width,
      margin,
      color,
      errorCorrectionLevel
    })
    return svg
  } catch (error) {
    console.error('Error generating QR code SVG:', error)
    throw new Error('Failed to generate QR code SVG')
  }
}

/**
 * Generate QR code for a URL
 */
export function generateQRCodeForURL(url: string, options?: QRCodeOptions) {
  return generateQRCodeDataURL(url, options)
}

/**
 * Generate QR code for product page
 */
export function generateQRCodeForProduct(productId: string | number, baseUrl?: string) {
  const url = baseUrl 
    ? `${baseUrl}/products/${productId}`
    : typeof window !== 'undefined'
    ? `${window.location.origin}/products/${productId}`
    : `/products/${productId}`
  return generateQRCodeDataURL(url)
}

/**
 * Generate QR code for text/plain content
 */
export function generateQRCodeForText(text: string, options?: QRCodeOptions) {
  return generateQRCodeDataURL(text, options)
}



