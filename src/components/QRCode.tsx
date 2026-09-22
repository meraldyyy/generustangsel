import { QRCodeCanvas } from 'qrcode.react';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCode({ value, size = 240, className = '' }: QRCodeProps) {
  return (
    <div className={`inline-block rounded-xl bg-white p-4 shadow-sm ${className}`}>
      <QRCodeCanvas value={value} size={size} level="M" includeMargin={false} />
    </div>
  );
}
