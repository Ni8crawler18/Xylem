import { ArrowLeft, Maximize2, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'

function Slides() {
  const navigate = useNavigate()
  const iframeRef = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const goFullscreen = () => {
    if (iframeRef.current) {
      if (iframeRef.current.requestFullscreen) {
        iframeRef.current.requestFullscreen()
        setIsFullscreen(true)
      }
    }
  }

  const openExternal = () => {
    window.open('/slides.html', '_blank')
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Top bar */}
      <div className="fixed top-16 left-0 right-0 z-40 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-12">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-sm text-white font-medium">Elevator Pitch — 7 Slides</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={goFullscreen}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-mono"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Fullscreen</span>
            </button>
            <button
              onClick={openExternal}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-mono"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>New Tab</span>
            </button>
          </div>
        </div>
      </div>

      {/* Slides iframe — nav: 4rem, sub-bar: 3rem = 7rem total */}
      <div className="fixed top-28 left-0 right-0 bottom-0">
        <iframe
          ref={iframeRef}
          src="/slides.html"
          title="Xylem Pitch Slides"
          className="w-full h-full border-0"
          allowFullScreen
        />
      </div>
    </div>
  )
}

export default Slides
