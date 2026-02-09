'use client'

import { useState } from 'react'
import { X, Download, ExternalLink, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface FilePreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileUrl: string
  fileName: string
  fileType: string
}

export function FilePreviewModal({
  open,
  onOpenChange,
  fileUrl,
  fileName,
  fileType,
}: FilePreviewModalProps) {
  const [zoom, setZoom] = useState(100)
  const [imageError, setImageError] = useState(false)

  const isImage = fileType.startsWith('image/')
  const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf')
  const isVideo = fileType.startsWith('video/')
  const isAudio = fileType.startsWith('audio/')

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = fileName
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleOpenExternal = () => {
    window.open(fileUrl, '_blank')
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 200))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50))
  }

  const resetZoom = () => {
    setZoom(100)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate pr-4">{fileName}</DialogTitle>
            <div className="flex items-center gap-2">
              {isImage && !imageError && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomOut}
                    disabled={zoom <= 50}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[4ch] text-center">
                    {zoom}%
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomIn}
                    disabled={zoom >= 200}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetZoom}
                    disabled={zoom === 100}
                  >
                    Reset
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="ghost" size="sm" onClick={handleOpenExternal}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-auto max-h-[calc(90vh-120px)] p-6">
          {/* Image Preview */}
          {isImage && !imageError && (
            <div className="flex items-center justify-center">
              <img
                src={fileUrl}
                alt={fileName}
                className="max-w-full h-auto"
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'center',
                  transition: 'transform 0.2s',
                }}
                onError={() => setImageError(true)}
              />
            </div>
          )}

          {/* Image Error State */}
          {isImage && imageError && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Unable to preview image
              </p>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download to view
              </Button>
            </div>
          )}

          {/* PDF Preview */}
          {isPDF && (
            <div className="w-full h-[600px]">
              <iframe
                src={fileUrl}
                className="w-full h-full border-0"
                title={fileName}
              />
            </div>
          )}

          {/* Video Preview */}
          {isVideo && (
            <div className="flex items-center justify-center">
              <video
                src={fileUrl}
                controls
                className="max-w-full h-auto"
                style={{ maxHeight: '600px' }}
              >
                Your browser does not support video playback.
              </video>
            </div>
          )}

          {/* Audio Preview */}
          {isAudio && (
            <div className="flex flex-col items-center justify-center py-12">
              <audio src={fileUrl} controls className="w-full max-w-md">
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {/* Other File Types */}
          {!isImage && !isPDF && !isVideo && !isAudio && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Preview not available for this file type
              </p>
              <div className="flex gap-2">
                <Button onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={handleOpenExternal}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in new tab
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
