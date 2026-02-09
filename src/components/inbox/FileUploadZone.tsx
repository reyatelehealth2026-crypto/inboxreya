'use client'

import { useCallback, useState } from 'react'
import { Upload, X, FileIcon, ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void
  onUpload: (file: File) => Promise<void>
  accept?: string
  maxSize?: number // in MB
  disabled?: boolean
  className?: string
}

export function FileUploadZone({
  onFileSelect,
  onUpload,
  accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx',
  maxSize = 4, // 4MB default (Vercel limit)
  disabled = false,
  className,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    const fileSizeMB = file.size / 1024 / 1024
    if (fileSizeMB > maxSize) {
      return `File size (${fileSizeMB.toFixed(2)}MB) exceeds limit (${maxSize}MB)`
    }

    // Check file type if accept is specified
    if (accept) {
      const acceptedTypes = accept.split(',').map((t) => t.trim())
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`
      const mimeType = file.type

      const isAccepted = acceptedTypes.some((type) => {
        if (type.startsWith('.')) {
          return fileExtension === type
        }
        if (type.endsWith('/*')) {
          const category = type.split('/')[0]
          return mimeType.startsWith(category)
        }
        return mimeType === type
      })

      if (!isAccepted) {
        return `File type not accepted. Allowed: ${accept}`
      }
    }

    return null
  }, [maxSize, accept])

  const handleFileSelect = useCallback(
    (file: File) => {
      setError(null)
      const validationError = validateFile(file)
      
      if (validationError) {
        setError(validationError)
        return
      }

      setSelectedFile(file)
      onFileSelect(file)
    },
    [onFileSelect, validateFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (disabled) return

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        handleFileSelect(files[0])
      }
    },
    [disabled, handleFileSelect]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        handleFileSelect(files[0])
      }
    },
    [handleFileSelect]
  )

  const handleUpload = async () => {
    if (!selectedFile || isUploading) return

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      // Simulate progress (since we can't track actual upload progress easily)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90))
      }, 100)

      await onUpload(selectedFile)

      clearInterval(progressInterval)
      setUploadProgress(100)

      // Reset after successful upload
      setTimeout(() => {
        setSelectedFile(null)
        setUploadProgress(0)
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClear = () => {
    setSelectedFile(null)
    setError(null)
    setUploadProgress(0)
  }

  const isImage = selectedFile?.type.startsWith('image/')

  return (
    <div className={cn('space-y-3', className)}>
      {/* Drop Zone */}
      {!selectedFile && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="mb-1 text-sm font-medium">
            Drag and drop file here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Max size: {maxSize}MB
          </p>
          <input
            type="file"
            accept={accept}
            onChange={handleInputChange}
            disabled={disabled}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
      )}

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {isImage ? (
                <ImageIcon className="h-10 w-10 text-blue-500" />
              ) : (
                <FileIcon className="h-10 w-10 text-gray-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            {!isUploading && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}

          {/* Upload Button */}
          {!isUploading && uploadProgress === 0 && (
            <Button
              onClick={handleUpload}
              disabled={disabled}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload and Send
            </Button>
          )}

          {/* Success State */}
          {uploadProgress === 100 && (
            <div className="text-center text-sm text-green-600">
              ✓ Uploaded successfully
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
