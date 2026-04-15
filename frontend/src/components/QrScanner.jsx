import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Camera, AlertCircle } from 'lucide-react'

/**
 * Modal QR scanner that opens the device camera, scans a QR code,
 * and returns the decoded text via onResult(text). Closed via onClose().
 */
function QrScanner({ onResult, onClose }) {
  const containerRef = useRef(null)
  const scannerRef = useRef(null)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('starting')

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const id = 'qr-scanner-region'
        // Make sure the DOM node is present before instantiating
        if (!document.getElementById(id)) return

        const html5qr = new Html5Qrcode(id, { verbose: false })
        scannerRef.current = html5qr

        await html5qr.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (viewWidth, viewHeight) => {
              const size = Math.floor(Math.min(viewWidth, viewHeight) * 0.75)
              return { width: size, height: size }
            },
            aspectRatio: 1.0
          },
          (decodedText) => {
            if (cancelled) return
            cancelled = true
            setStatus('done')
            try {
              html5qr.stop().then(() => html5qr.clear()).catch(() => {})
            } catch {}
            onResult(decodedText)
          },
          () => {
            // scan failure (no QR in frame) — ignore
          }
        )

        if (!cancelled) setStatus('scanning')
      } catch (err) {
        if (!cancelled) {
          const msg = err?.message || String(err) || 'Camera unavailable'
          setError(msg.includes('Permission') || msg.includes('NotAllowed')
            ? 'Camera permission denied. Allow camera access to scan QR codes.'
            : msg)
          setStatus('error')
        }
      }
    }

    const t = setTimeout(start, 50)
    return () => {
      cancelled = true
      clearTimeout(t)
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {})
        } catch {}
      }
    }
  }, [onResult])

  const handleClose = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {})
      } catch {}
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0D0D0D] border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-[#5B9A5B]" />
            <h3 className="text-white font-semibold">Scan Proof QR</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div
            id="qr-scanner-region"
            ref={containerRef}
            className="w-full aspect-square bg-black rounded-lg overflow-hidden"
          />

          {status === 'starting' && (
            <div className="mt-3 text-xs text-gray-500 font-mono text-center">
              initializing camera…
            </div>
          )}
          {status === 'scanning' && !error && (
            <div className="mt-3 text-xs text-[#5B9A5B] font-mono text-center">
              point camera at the proof QR code
            </div>
          )}
          {error && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-400">{error}</div>
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={handleClose}
            className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default QrScanner
