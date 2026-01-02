'use client'

import { useState } from 'react'
import { QRCode } from './qr-code'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function QRCodeGenerator() {
  const [text, setText] = useState('')

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>QR Code Generator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type text or URL here..."
            className="w-full"
          />
        </div>

        <div className="flex justify-center items-center min-h-[300px] border rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
          {text ? (
            <QRCode
              value={text}
              size={250}
              showDownload
              showCopy
            />
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p className="text-sm">Enter text above to generate QR code</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

