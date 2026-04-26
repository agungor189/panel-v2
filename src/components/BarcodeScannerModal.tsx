import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { X } from 'lucide-react';

interface BarcodeScannerModalProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScannerModal({ onScan, onClose }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    let isScanning = true;

    if (videoRef.current) {
      codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (!isScanning) return;
        if (result) {
          isScanning = false;
          onScan(result.getText());
        }
        if (err && !(err instanceof NotFoundException)) {
          console.error(err);
        }
      }).catch(err => {
         setError('Kamera açılamadı, lütfen izinleri kontrol edin.');
         console.error(err);
      });
    }

    return () => {
      isScanning = false;
      codeReader.reset();
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-surface-main rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border-color flex justify-between items-center bg-surface-sub">
          <h2 className="text-sm font-bold text-text-main flex items-center">
            Barkod Okut
          </h2>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-red-500 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 flex flex-col items-center bg-black">
          {error ? (
             <div className="text-red-500 text-sm p-4 text-center">{error}</div>
          ) : (
            <div className="relative w-full aspect-square max-h-[60vh] overflow-hidden rounded-xl border-2 border-primary/50">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-2 border-primary animate-pulse opacity-50 m-12 rounded-lg pointer-events-none" />
            </div>
          )}
          <p className="text-text-muted text-xs text-center mt-4 w-full bg-surface-main p-2 rounded">
            Lütfen barkodu kırmızı alanın içerisine hizalayın. Kamera otomatik olarak okuyacaktır.
          </p>
        </div>
      </div>
    </div>
  );
}
