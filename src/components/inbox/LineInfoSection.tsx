"use client"

import { useState } from 'react'
import { Copy, Check, MessageCircle, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { formatDate, getInitials } from '@/lib/utils'
import { OdooLinkBadge } from './OdooLinkStatusCard'

interface LineInfoSectionProps {
  user: {
    id: string
    lineUserId: string
    displayName: string | null
    statusMessage?: string | null
    pictureUrl?: string | null
    createdAt: string
  }
}

export function LineInfoSection({ user }: LineInfoSectionProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopyUserId = async () => {
    try {
      await navigator.clipboard.writeText(user.lineUserId)
      setCopied(true)
      toast({
        title: 'คัดลอกแล้ว',
        description: 'LINE User ID ถูกคัดลอกไปยัง clipboard',
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: 'ไม่สามารถคัดลอกได้',
        description: 'กรุณาลองอีกครั้ง',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-3">
      {/* Profile Card */}
      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
        <Avatar className="h-12 w-12 ring-2 ring-green-200">
          <AvatarImage src={user.pictureUrl || undefined} />
          <AvatarFallback className="bg-green-100 text-green-700 text-sm font-bold">
            {getInitials(user.displayName || 'U')}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 truncate">
            {user.displayName || 'ไม่ระบุชื่อ'}
          </p>
          {user.statusMessage && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {user.statusMessage}
            </p>
          )}
        </div>
        <MessageCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
      </div>

      {/* LINE User ID */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              LINE User ID
            </span>
            {/* Odoo-link status right next to LINE User ID */}
            <OdooLinkBadge userId={user.id} />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={handleCopyUserId}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-gray-500" />
            )}
          </Button>
        </div>
        <p className="font-mono text-xs text-gray-700 break-all select-all">
          {user.lineUserId}
        </p>
      </div>

      {/* Status Message */}
      {user.statusMessage && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            Status Message
          </span>
          <p className="text-sm text-gray-700">
            {user.statusMessage}
          </p>
        </div>
      )}

      {/* Joined Date */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            เข้าร่วมเมื่อ
          </span>
        </div>
        <p className="text-sm font-medium text-gray-700 mt-1">
          {formatDate(user.createdAt)}
        </p>
      </div>
    </div>
  )
}
