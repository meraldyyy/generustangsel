import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onClose?: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const containerId = 'qr-scanner-container';
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function startScanner() {
      try {
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (mounted) {
              onScan(decodedText);
            }
          },
          () => {}
        );

        if (mounted) setStarting(false);
      } catch {
        if (mounted) {
          setError('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
          setStarting(false);
        }
      }
    }

    startScanner();

    return () => {
      mounted = false;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-gray-900">
        <div id={containerId} className="w-full" />
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center text-white">
              <Camera size={32} className="mx-auto mb-2 animate-pulse" />
              <p className="text-sm">Memulai kamera...</p>
            </div>
          </div>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
          >
            <X size={20} />
          </button>
        )}
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <p className="text-center text-sm text-gray-500">Arahkan kamera ke QR Code bukti absensi</p>
    </div>
  );
}
