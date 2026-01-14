'use client'

import { useState, useEffect } from 'react'
import { generateQRCodeDataURL, QRCodeOptions } from '@/lib/qrcode-utils'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QRCodeProps {
  value: string
  size?: number
  className?: string
  options?: QRCodeOptions
  showDownload?: boolean
  showCopy?: boolean
}

export function QRCode({ 
  value, 
  size = 200, 
  className,
  options,
  showDownload = false,
  showCopy = false
}: QRCodeProps) {
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const generateQR = async () => {
      try {
        setLoading(true)
        setError(null)
        const dataURL = await generateQRCodeDataURL(value, {
          width: size,
          ...options
        })
        if (isMounted) {
          setQrCodeDataURL(dataURL)
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to generate QR code')
          setLoading(false)
        }
      }
    }

    generateQR()

    return () => {
      isMounted = false
    }
  }, [value, size, options])

  const handleDownload = () => {
    if (!qrCodeDataURL) return
    
    const link = document.createElement('a')
    link.href = qrCodeDataURL
    link.download = `qrcode-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopy = async () => {
    if (!qrCodeDataURL) return
    
    try {
      // Convert data URL to blob
      const response = await fetch(qrCodeDataURL)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
    } catch (err) {
      }
  }

  if (loading) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg",
          className
        )}
        style={{ width: size, height: size }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-lg p-4",
          className
        )}
        style={{ width: size, height: size }}
      >
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  if (!qrCodeDataURL) {
    return null
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <img
        src={qrCodeDataURL}
        alt="QR Code"
        className="rounded-lg border border-gray-200 dark:border-gray-700"
        style={{ width: size, height: size }}
      />
      {(showDownload || showCopy) && (
        <div className="flex gap-2">
          {showDownload && (
            <button
              onClick={handleDownload}
              className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Download
            </button>
          )}
          {showCopy && (
            <button
              onClick={handleCopy}
              className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Copy
            </button>
          )}
        </div>
      )}
    </div>
  )
}

