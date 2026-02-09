import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'

interface UploadOptions {
  userId: string
  internalUserId: string
  type: 'image' | 'file'
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
}

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { toast } = useToast()

  const uploadFile = async (file: File, options: UploadOptions) => {
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Validate file size (4MB limit)
      const maxSize = 4 * 1024 * 1024 // 4MB
      if (file.size > maxSize) {
        throw new Error(
          `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds limit (4MB)`
        )
      }

      // Create form data
      const formData = new FormData()
      formData.append('file', file)
      formData.append('user_id', options.userId)
      formData.append('internal_user_id', options.internalUserId)
      formData.append('type', options.type)

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90))
      }, 100)

      // Upload file
      const response = await fetch('/api/inbox/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const result = await response.json()
      setUploadProgress(100)

      toast({
        title: 'Upload successful',
        description: `${file.name} has been sent`,
      })

      options.onSuccess?.(result.data)

      // Reset after delay
      setTimeout(() => {
        setUploadProgress(0)
      }, 1000)

      return result.data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      
      toast({
        title: 'Upload failed',
        description: errorMessage,
        variant: 'destructive',
      })

      options.onError?.(error instanceof Error ? error : new Error(errorMessage))
      
      throw error
    } finally {
      setIsUploading(false)
    }
  }

  const uploadImage = async (
    file: File,
    userId: string,
    internalUserId: string,
    callbacks?: { onSuccess?: (data: any) => void; onError?: (error: Error) => void }
  ) => {
    return uploadFile(file, {
      userId,
      internalUserId,
      type: 'image',
      ...callbacks,
    })
  }

  const uploadDocument = async (
    file: File,
    userId: string,
    internalUserId: string,
    callbacks?: { onSuccess?: (data: any) => void; onError?: (error: Error) => void }
  ) => {
    return uploadFile(file, {
      userId,
      internalUserId,
      type: 'file',
      ...callbacks,
    })
  }

  return {
    uploadFile,
    uploadImage,
    uploadDocument,
    isUploading,
    uploadProgress,
  }
}
