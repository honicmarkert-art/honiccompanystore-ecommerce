import { QRCodeGenerator } from '@/components/qr-code-generator'

// Force static generation - QR code generator is client-side but page can be static
export const dynamic = 'force-static'

export default function QRCodePage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <QRCodeGenerator />
    </div>
  )
}



