'use client'

import { useState } from 'react'
import {
  FileIcon,
  ImageIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  FileVideoIcon,
  FileAudioIcon,
  DownloadIcon,
  EyeIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilePreviewModal } from './FilePreviewModal'
import { cn } from '@/lib/utils'

interface FileAttachmentProps {
  fileUrl: string
  fileName: string
  fileType?: string
  fileSize?: number
  className?: string
  showPreview?: boolean
}

export function FileAttachment({
  fileUrl,
  fileName,
  fileType = 'application/octet-stream',
  fileSize,
  className,
  showPreview = true,
}: FileAttachmentProps) {
  const [previewOpen, setPreviewOpen] = useState(false)

  const getFileIcon = () => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />
    }
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return <FileTextIcon className="h-5 w-5 text-red-500" />
    }
    if (
      fileType.includes('spreadsheet') ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.csv')
    ) {
      return <FileSpreadsheetIcon className="h-5 w-5 text-green-500" />
    }
    if (fileType.startsWith('video/')) {
      return <FileVideoIcon className="h-5 w-5 text-purple-500" />
    }
    if (fileType.startsWith('audio/')) {
      return <FileAudioIcon className="h-5 w-5 text-orange-500" />
    }
    return <FileIcon className="h-5 w-5 text-gray-500" />
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = fileName
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPreviewOpen(true)
  }

  const isImage = fileType.startsWith('image/')
  const canPreview =
    isImage ||
    fileType === 'application/pdf' ||
    fileType.startsWith('video/') ||
    fileType.startsWith('audio/')

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50',
          className
        )}
      >
        {/* File Icon */}
        <div className="flex-shrink-0">{getFileIcon()}</div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">{fileName}</p>
          {fileSize && (
            <p className="text-xs text-muted-foreground">
              {formatFileSize(fileSize)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {showPreview && canPreview && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreview}
              className="h-8 w-8 p-0"
              title="Preview"
            >
              <EyeIcon className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-8 w-8 p-0"
            title="Download"
          >
            <DownloadIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && canPreview && (
        <FilePreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          fileUrl={fileUrl}
          fileName={fileName}
          fileType={fileType}
        />
      )}
    </>
  )
}
