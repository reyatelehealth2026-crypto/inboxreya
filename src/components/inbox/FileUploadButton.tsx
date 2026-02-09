'use client'

import { useRef, useState } from 'react'
import { Paperclip, Image as ImageIcon, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFileUpload } from '@/hooks/use-file-upload'
import { cn } from '@/lib/utils'

interface FileUploadButtonProps {
  userId: string
  internalUserId: string
  onUploadSuccess?: (data: any) => void
  disabled?: boolean
  className?: string
}

export function FileUploadButton({
  userId,
  internalUserId,
  onUploadSuccess,
  disabled = false,
  className,
}: FileUploadButtonProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadImage, uploadDocument, isUploading } = useFileUpload()
  const [uploadType, setUploadType] = useState<'image' | 'file' | null>(null)

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadType('image')
    try {
      const result = await uploadImage(file, userId, internalUserId, {
        onSuccess: onUploadSuccess,
      })
    } finally {
      setUploadType(null)
      if (imageInputRef.current) {
        imageInputRef.current.value = ''
      }
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadType('file')
    try {
      const result = await uploadDocument(file, userId, internalUserId, {
        onSuccess: onUploadSuccess,
      })
    } finally {
      setUploadType(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleImageClick = () => {
    imageInputRef.current?.click()
  }

  const handleFileClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || isUploading}
            className={cn('h-9 w-9 p-0', className)}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={handleImageClick} disabled={isUploading}>
            <ImageIcon className="mr-2 h-4 w-4" />
            <span>Upload Image</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleFileClick} disabled={isUploading}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Upload Document</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
        onChange={handleFileSelect}
        className="hidden"
      />
    </>
  )
}
