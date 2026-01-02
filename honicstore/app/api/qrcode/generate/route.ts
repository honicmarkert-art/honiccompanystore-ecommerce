import { NextRequest, NextResponse } from 'next/server'
import { generateQRCodeDataURL, generateQRCodeSVG } from '@/lib/qrcode-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const text = searchParams.get('text') || searchParams.get('value')
    const format = searchParams.get('format') || 'png' // 'png' or 'svg'
    const width = parseInt(searchParams.get('width') || '300')
    const margin = parseInt(searchParams.get('margin') || '1')
    const darkColor = searchParams.get('dark') || '#000000'
    const lightColor = searchParams.get('light') || '#FFFFFF'
    const errorCorrectionLevel = (searchParams.get('errorCorrectionLevel') || 'M') as 'L' | 'M' | 'Q' | 'H'

    if (!text) {
      return NextResponse.json(
        { error: 'Text or value parameter is required' },
        { status: 400 }
      )
    }

    const options = {
      width,
      margin,
      color: {
        dark: darkColor,
        light: lightColor
      },
      errorCorrectionLevel
    }

    if (format === 'svg') {
      const svg = await generateQRCodeSVG(text, options)
      return new NextResponse(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600'
        }
      })
    } else {
      const dataURL = await generateQRCodeDataURL(text, options)
      // Convert data URL to buffer
      const base64Data = dataURL.split(',')[1]
      const buffer = Buffer.from(base64Data, 'base64')
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600'
        }
      })
    }
  } catch (error) {
    console.error('Error generating QR code:', error)
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, format = 'png', width = 300, margin = 1, darkColor = '#000000', lightColor = '#FFFFFF', errorCorrectionLevel = 'M' } = body

    if (!text) {
      return NextResponse.json(
        { error: 'Text field is required' },
        { status: 400 }
      )
    }

    const options = {
      width,
      margin,
      color: {
        dark: darkColor,
        light: lightColor
      },
      errorCorrectionLevel: errorCorrectionLevel as 'L' | 'M' | 'Q' | 'H'
    }

    if (format === 'svg') {
      const svg = await generateQRCodeSVG(text, options)
      return NextResponse.json({ svg, format: 'svg' })
    } else {
      const dataURL = await generateQRCodeDataURL(text, options)
      return NextResponse.json({ dataURL, format: 'png' })
    }
  } catch (error) {
    console.error('Error generating QR code:', error)
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    )
  }
}



