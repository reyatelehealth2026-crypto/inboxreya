"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface UploadAndSendParams {
  lineUserId: string
  internalUserId: string
  file: File
  type: 'image' | 'file'
}

interface UploadResponse {
  success: boolean
  data?: {
    mediaUrl?: string
    messageId?: string
  }
  error?: string
}

/**
 * Hook สำหรับ upload และส่ง media (รูปภาพ/ไฟล์) ไปยัง LINE
 * ใช้ PHP API จัดการทั้ง upload และส่ง LINE
 */
export function useUploadAndSend() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: UploadAndSendParams): Promise<UploadResponse> => {
      const formData = new FormData()
      formData.append('file', params.file)
      formData.append('user_id', params.lineUserId)
      formData.append('type', params.type)

      // เรียก Next.js API endpoint ที่จะ forward ไป PHP
      const response = await fetch('/api/inbox/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to upload and send media')
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      // Invalidate messages query เพื่อ refresh ข้อความใหม่
      queryClient.invalidateQueries({
        queryKey: queryKeys.messagesForUser(variables.internalUserId),
      })
      // Invalidate conversations เพื่ออัพเดท last message
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversationsRoot(),
      })
    },
  })
}
