import { QRCodeSVG } from 'qrcode.react'

export function QrCode({ value }: { value: string }) {
  return <QRCodeSVG value={value} size={192} level="H" marginSize={4} title="Scan untuk bergabung ke Deutsch Adventure" className="h-48 w-48 shrink-0 rounded-lg bg-white p-2" />
}
