"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Send, Paperclip, Smile, MoreVertical, Phone, Video, Image as ImageIcon, Sparkles, X, ArrowLeft, Reply, Upload, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { useMessages, useSendMessage } from '@/hooks/use-messages'
import { queryKeys } from '@/lib/query-keys'
import { useConversation } from '@/hooks/use-conversations'
import { useTypingIndicator } from '@/hooks/use-realtime'
import { useAiReply, useAiDraft, useAiAnalyzeImage } from '@/hooks/use-ai'
import { useAdmins } from '@/hooks/use-admins'
import { TemplateSelector } from '@/components/inbox/TemplateSelector'
import { TemplatePickerModal } from '@/components/inbox/TemplatePickerModal'
import { useInboxStore } from '@/stores/inbox'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import { useTextExpansion, useInboxKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FlexPreview } from '@/components/inbox/FlexPreview'
import { useToast } from '@/hooks/use-toast'
import { useNewMessageAnnouncement } from '@/hooks/use-screen-reader'
import { cn, formatMessageTime, getInitials } from '@/lib/utils'
import { ImageLightbox } from '@/components/inbox/ImageLightbox'
import { EmojiPicker } from '@/components/inbox/EmojiPicker'
import { Badge } from '@/components/ui/badge'
import type { LineUser, Message, UserTag, AdminUser } from '@/types'
import { LinkPreview } from '@/components/inbox/LinkPreview'
import { extractUrls } from '@/lib/url-utils'

function parseFlexPayload(message: Message) {
  const metadata = message.metadata as any
  const metadataFlex = metadata?.flexContent ?? metadata?.flex ?? metadata?.contents
  if (metadataFlex) {
    if (metadataFlex.type === 'flex' && metadataFlex.contents) return metadataFlex.contents
    if (metadataFlex.type === 'bubble' || metadataFlex.type === 'carousel') return metadataFlex
  }

  if (typeof message.content === 'string' && message.content.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(message.content)
      if (parsed?.type === 'flex' && parsed.contents) return parsed.contents
      if (parsed?.type === 'bubble' || parsed?.type === 'carousel') return parsed
      if (parsed?.contents && (parsed.contents.type === 'bubble' || parsed.contents.type === 'carousel')) {
        return parsed.contents
      }
    } catch (error) {
      return null
    }
  }

  return null
}

// ตรวจสอบว่าข้อความเป็น flex message JSON หรือไม่
function isFlexMessageContent(content: string | null | undefined): boolean {
  if (!content || typeof content !== 'string') return false
  const trimmed = content.trim()
  if (!trimmed.startsWith('{')) return false

  try {
    const parsed = JSON.parse(trimmed)
    // Check for flex message patterns
    if (parsed?.type === 'flex') return true
    if (parsed?.type === 'bubble' || parsed?.type === 'carousel') return true
    if (parsed?.contents?.type === 'bubble' || parsed?.contents?.type === 'carousel') return true
    // Check for altText which is common in flex messages
    if (parsed?.altText && (parsed?.contents || parsed?.type === 'flex')) return true
    return false
  } catch {
    return false
  }
}

// ตรวจสอบว่าข้อความเป็น LINE message JSON (type: text, image, etc.)
function isLineMessageJson(content: string | null | undefined): boolean {
  if (!content || typeof content !== 'string') return false
  const trimmed = content.trim()
  if (!trimmed.startsWith('{')) return false

  try {
    const parsed = JSON.parse(trimmed)
    // LINE message formats typically have type and text/contents
    if (parsed?.type === 'text' && parsed?.text) return true
    if (parsed?.type === 'image' && parsed?.originalContentUrl) return true
    if (parsed?.type === 'sticker') return true
    if (parsed?.type === 'location') return true
    if (parsed?.type === 'template') return true
    // Check for button/action structures
    if (parsed?.type === 'button' || parsed?.action) return true
    // Check for box layouts (LINE flex components)
    if (parsed?.type === 'box' && parsed?.contents) return true
    return false
  } catch {
    return false
  }
}

// Extract display text from LINE message JSON
function getLineMessageDisplayText(content: string): string | null {
  try {
    const parsed = JSON.parse(content)
    if (parsed?.type === 'text' && parsed?.text) {
      return parsed.text
    }
    if (parsed?.altText) {
      return parsed.altText
    }
    if (parsed?.type === 'image') {
      return '[รูปภาพ]'
    }
    if (parsed?.type === 'sticker') {
      return '[สติกเกอร์]'
    }
    if (parsed?.type === 'location') {
      return `[ตำแหน่ง: ${parsed?.title || parsed?.address || 'ไม่ระบุ'}]`
    }
    return null
  } catch {
    return null
  }
}


const MessageTextWithLinks = ({ content, isOutgoing }: { content: string, isOutgoing: boolean }) => {
  if (!content) return null
  const parts = content.split(/(\bhttps?:\/\/[^\s]+)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.match(/^https?:\/\//)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline hover:opacity-80 break-all ${isOutgoing ? 'text-white font-medium' : 'text-blue-600 dark:text-blue-400'}`}
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
function MessageBubble({
  message,
  isLast,
  senderName,
  user,
}: {
  message: Message
  isLast: boolean
  senderName?: string | null
  user?: { displayName?: string | null; pictureUrl?: string | null } | null
}) {
  const isOutgoing = message.direction === 'outgoing'
  const { setReplyToMessage, setLightboxImage } = useChatStore()
  const { toast } = useToast()
  const [slipForwardState, setSlipForwardState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')

  // Parse flex payload - check explicit flex type, JSON content, or metadata
  const isFlexType = message.messageType === 'flex'
  const isFlexJson = message.messageType === 'text' && isFlexMessageContent(message.content)
  const flexPayload = parseFlexPayload(message)
  const shouldShowFlex = Boolean(flexPayload) || isFlexType || isFlexJson

  const resolveContentUrl = (content: string | null, mediaUrl?: string | null) => {
    if (mediaUrl) return mediaUrl
    if (!content) return null
    if (content.startsWith('http://') || content.startsWith('https://')) return content

    const idMatch = content.match(/ID:\s*(\d+)/i)
    const id = idMatch ? idMatch[1] : content.trim()
    const baseUrl =
      process.env.NEXT_PUBLIC_PHP_API_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      ''

    if (!baseUrl) {
      return null
    }

    return `${baseUrl.replace(/\/$/, '')}/api/line_content.php?id=${id}`
  }

  const parseLocationFromContent = (content: string | null) => {
    if (!content) return null
    const match = content.match(/\[location\]\s*(.+?)\s*\(([0-9.-]+),\s*([0-9.-]+)\)/i)
    if (!match) return null
    return { address: match[1]?.trim(), lat: match[2], lng: match[3] }
  }

  const fileMetadata = (message.metadata as any) || null
  const fileNameFromContent = (() => {
    if (!message.content) return null
    try {
      const parsed = JSON.parse(message.content)
      return parsed?.name || parsed?.fileName || null
    } catch {
      return null
    }
  })()

  // Check if it's a LINE message JSON (type: text, etc.)
  const isLineJson = message.messageType === 'text' && !isFlexJson && isLineMessageJson(message.content)
  const lineDisplayText = isLineJson ? getLineMessageDisplayText(message.content || '') : null

  return (
    <div
      className={cn(
        'flex gap-2 mb-3 message-bubble px-2 group',
        isOutgoing ? 'justify-end' : 'justify-start'
      )}
    >
      {!isOutgoing && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage
            src={user?.pictureUrl || undefined}
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <AvatarFallback>{getInitials(user?.displayName || 'U')}</AvatarFallback>
        </Avatar>
      )}

      {isOutgoing && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-50 hover:opacity-100 transition-opacity self-center"
          onClick={(e) => {
            e.stopPropagation()
            setReplyToMessage(message)
          }}
          title="ตอบกลับข้อความนี้"
          aria-label="ตอบกลับข้อความนี้"
        >
          <Reply className="h-4 w-4" />
        </Button>
      )}

      <div
        className={cn(
          'max-w-[80%] sm:max-w-[75%] rounded-2xl px-4 py-2 overflow-hidden',
          isOutgoing
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted rounded-bl-sm'
        )}
      >
        {message.messageType === 'text' && !isFlexJson && !isLineJson && (
          <div className="flex flex-col gap-1">
            <p className="whitespace-pre-wrap break-words">
              <MessageTextWithLinks content={message.content || ''} isOutgoing={isOutgoing} />
            </p>
            {(() => {
              const urls = extractUrls(message.content || '')
              return urls.length > 0 ? (
                <LinkPreview url={urls[0]} isOutgoing={isOutgoing} />
              ) : null
            })()}
          </div>
        )}

        {isLineJson && lineDisplayText && (
          <p className="whitespace-pre-wrap break-words">{lineDisplayText}</p>
        )}

        {shouldShowFlex && (
          <div className="max-w-full overflow-hidden">
            <FlexPreview flex={flexPayload} />
          </div>
        )}

        {message.messageType === 'image' && (message.mediaUrl || message.content) && (
          <div className="relative w-full max-w-full">
            {(() => {
              const imgUrl = resolveContentUrl(message.content, message.mediaUrl)
              if (!imgUrl) {
                return <div className="text-xs text-muted-foreground">ไม่สามารถแสดงรูปภาพ</div>
              }
              return (
                <button
                  type="button"
                  onClick={() => setLightboxImage(imgUrl)}
                  className="cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-lg"
                  aria-label="คลิกเพื่อดูรูปภาพขนาดใหญ่"
                >
                  <Image
                    src={imgUrl}
                    alt="Image"
                    width={640}
                    height={480}
                    sizes="(max-width: 640px) 60vw, 280px"
                    className="h-auto w-full max-w-[280px] rounded-lg"
                    loading="lazy"
                    unoptimized
                  />
                </button>
              )
            })()}
            {!isOutgoing && (
              <div className="mt-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={slipForwardState === 'loading' || slipForwardState === 'sent'}
                  className={cn(
                    'h-7 text-xs gap-1.5 transition-all',
                    slipForwardState === 'sent' && 'bg-green-50 text-green-700 border-green-200',
                    slipForwardState === 'error' && 'bg-red-50 text-red-700 border-red-200'
                  )}
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (slipForwardState === 'loading' || slipForwardState === 'sent') return
                    setSlipForwardState('loading')
                    try {
                      const res = await fetch('/api/inbox/forward-slip-odoo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          messageId: message.id,
                          userId: message.userId,
                        }),
                      })
                      const data = await res.json()
                      if (res.ok && data.success) {
                        setSlipForwardState('sent')
                        toast({
                          title: 'ส่งสลิปไป Odoo แล้ว',
                          description: data.data?.slip_name
                            ? `${data.data.slip_name} — ${data.data.match_result === 'exact' ? 'จับคู่ยอดได้' : 'รอจับคู่'}`
                            : 'ระบบ Odoo ได้รับสลิปแล้ว',
                        })
                      } else {
                        setSlipForwardState('error')
                        toast({
                          title: 'ส่งสลิปไม่สำเร็จ',
                          description: data.error || 'กรุณาลองใหม่อีกครั้ง',
                          variant: 'destructive',
                        })
                        setTimeout(() => setSlipForwardState('idle'), 3000)
                      }
                    } catch (err) {
                      setSlipForwardState('error')
                      toast({
                        title: 'เกิดข้อผิดพลาด',
                        description: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
                        variant: 'destructive',
                      })
                      setTimeout(() => setSlipForwardState('idle'), 3000)
                    }
                  }}
                >
                  {slipForwardState === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
                  {slipForwardState === 'sent' && <span>✓</span>}
                  {slipForwardState === 'idle' && <Upload className="h-3 w-3" />}
                  {slipForwardState === 'error' && <span>✕</span>}
                  {slipForwardState === 'loading' ? 'กำลังส่ง...' : slipForwardState === 'sent' ? 'ส่งแล้ว' : slipForwardState === 'error' ? 'ลองใหม่' : 'ส่งสลิปไป Odoo'}
                </Button>
              </div>
            )}
          </div>
        )}

        {message.messageType === 'video' && (message.mediaUrl || message.content) && (
          <div className="rounded-xl overflow-hidden max-w-[300px] border shadow-sm bg-black">
            {(() => {
              const videoUrl = resolveContentUrl(message.content, message.mediaUrl)
              if (!videoUrl) {
                return <div className="text-xs text-muted-foreground p-3">ไม่สามารถแสดงวิดีโอ</div>
              }
              return (
                <video controls className="w-full" preload="metadata" style={{ maxHeight: 400 }}>
                  <source src={videoUrl} />
                  เบราว์เซอร์ของคุณไม่รองรับการเล่นวิดีโอ
                </video>
              )
            })()}
          </div>
        )}

        {message.messageType === 'audio' && (message.mediaUrl || message.content) && (
          <div className="bg-white rounded-xl border shadow-sm p-3 max-w-[300px]">
            <div className="flex items-center gap-3">
              <span className="text-lg">🔊</span>
              {(() => {
                const audioUrl = resolveContentUrl(message.content, message.mediaUrl)
                if (!audioUrl) {
                  return <div className="text-xs text-muted-foreground">ไม่สามารถแสดงเสียง</div>
                }
                return (
                  <audio controls className="flex-1" preload="metadata">
                    <source src={audioUrl} />
                    เบราว์เซอร์ของคุณไม่รองรับการเล่นเสียง
                  </audio>
                )
              })()}
            </div>
          </div>
        )}

        {message.messageType === 'location' && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden max-w-[300px]">
            {(() => {
              const location =
                (fileMetadata?.latitude && fileMetadata?.longitude && {
                  address: fileMetadata?.address,
                  lat: String(fileMetadata?.latitude),
                  lng: String(fileMetadata?.longitude),
                }) ||
                parseLocationFromContent(message.content)
              if (!location) {
                return (
                  <div className="p-3 text-center text-gray-500 text-sm">
                    📍 Location
                  </div>
                )
              }
              const mapUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}`
              return (
                <a href={mapUrl} target="_blank" rel="noreferrer" className="block hover:opacity-90">
                  <div className="w-full h-28 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl">📍</div>
                      <p className="text-xs text-gray-600">คลิกเพื่อดูแผนที่</p>
                    </div>
                  </div>
                  <div className="p-3 text-xs text-gray-600">
                    {location.address && <p className="font-medium text-gray-800">{location.address}</p>}
                    <p className="mt-1">{location.lat}, {location.lng}</p>
                  </div>
                </a>
              )
            })()}
          </div>
        )}

        {message.messageType === 'sticker' && message.metadata && (
          <div className="text-4xl">😊</div>
        )}

        {message.messageType === 'location' && message.metadata && (
          <div className="flex items-center gap-2">
            <span>📍</span>
            <span>{(message.metadata as any).address || 'ตำแหน่ง'}</span>
          </div>
        )}

        {message.messageType === 'file' && (
          <div className="bg-white rounded-xl border shadow-sm p-3 max-w-[300px]">
            {(() => {
              const fileUrl = resolveContentUrl(message.content, message.mediaUrl)
              const fileName =
                fileMetadata?.fileName ||
                fileNameFromContent ||
                message.content ||
                'ไฟล์'
              if (!fileUrl) {
                return (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Paperclip className="h-4 w-4" />
                    <span>{fileName}</span>
                  </div>
                )
              }
              return (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-800 hover:text-gray-900"
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="truncate">{fileName}</span>
                </a>
              )
            })()}
          </div>
        )}

        {isOutgoing && senderName && (
          <div className="mt-1 text-[11px] text-primary-foreground/70 text-right">
            {senderName}
          </div>
        )}

        <div
          className={cn(
            'text-xs mt-1',
            isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          {formatMessageTime(message.createdAt)}
          {isOutgoing && (
            <span className={cn('ml-1', message.isRead ? 'text-teal-500 font-bold' : 'text-primary-foreground/50')}>
              {message.isRead ? '✓' : '✓'}
            </span>
          )}
        </div>
      </div>

      {!isOutgoing && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-50 hover:opacity-100 transition-opacity self-center"
          onClick={(e) => {
            e.stopPropagation()
            setReplyToMessage(message)
          }}
          title="ตอบกลับข้อความนี้"
          aria-label="ตอบกลับข้อความนี้"
        >
          <Reply className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  )
}

function TypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null

  return (
    <div className="flex items-center gap-2 mb-3 text-muted-foreground text-sm" role="status" aria-live="polite">
      <div className="flex gap-1">
        <span className="typing-dot w-2 h-2 bg-muted-foreground rounded-full" />
        <span className="typing-dot w-2 h-2 bg-muted-foreground rounded-full" />
        <span className="typing-dot w-2 h-2 bg-muted-foreground rounded-full" />
      </div>
      <span>
        {names.length === 1 ? names[0] : `${names.length} คน`} กำลังพิมพ์...
      </span>
    </div>
  )
}

function ChatHeader({ conversation }: { conversation: any }) {
  const { toggleProfile, isProfileOpen } = useInboxStore()
  const user = conversation?.user

  if (!user) return null

  return (
    <div className="flex items-center justify-between p-4 border-b text-white shadow-md" style={{ background: '#0C665D' }}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="hover:bg-[#094d47] text-white">
          <Link href="/dashboard" aria-label="กลับไปเมนูหลัก">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Avatar className="h-10 w-10 ring-2 ring-white/30">
          <AvatarImage
            src={user.pictureUrl || undefined}
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <AvatarFallback className="text-white" style={{ background: '#094d47' }}>{getInitials(user.displayName || 'U')}</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-medium text-white">
            {user.displayName || user.firstName || 'ไม่ระบุชื่อ'}
          </h3>
          <p className="text-sm text-white/80">
            {user.chatStatus === 'active' ? 'ออนไลน์' : 'ออฟไลน์'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="hover:bg-[#094d47] text-white" aria-label="เริ่มโทร">
          <Phone className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="hover:bg-[#094d47] text-white" aria-label="เริ่มวิดีโอคอล">
          <Video className="h-4 w-4" />
        </Button>
        <Button
          variant={isProfileOpen ? 'secondary' : 'ghost'}
          size="icon"
          onClick={toggleProfile}
          className={isProfileOpen ? 'text-white' : 'hover:bg-[#094d47] text-white'}
          style={isProfileOpen ? { background: '#094d47' } : undefined}
          aria-label="สลับแผงข้อมูลลูกค้า"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function MessageComposer({
  userId,
  latestImageUrl,
  lineUserId,
  user,
}: {
  userId: string
  latestImageUrl?: string | null
  lineUserId?: string | null
  user?: LineUser | null
}) {
  const queryClient = useQueryClient()
  const { replyingToMessage, clearReply, setReplyToMessage } = useChatStore()
  const [message, setMessage] = useState('')
  const [aiResult, setAiResult] = useState('')
  const [aiTone, setAiTone] = useState('friendly')
  const [isAiOpen, setIsAiOpen] = useState(false)
  const [activeToolTab, setActiveToolTab] = useState<'ai' | 'templates'>('ai')
  const [slashTemplateQuery, setSlashTemplateQuery] = useState('')
  // Multiple file selection state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const aiTextareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const sendMessage = useSendMessage()
  const aiReply = useAiReply()
  const aiDraft = useAiDraft()
  const aiAnalyze = useAiAnalyzeImage()
  const { toast } = useToast()
  const { startTyping, stopTyping } = useTypingIndicator(userId)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)

  const sendMessageShortcut = useSettingsStore((state) => state.shortcuts.sendMessage)

  // Register text expansion
  useTextExpansion(message, setMessage)

  // Register composer-specific shortcuts
  useInboxKeyboardShortcuts({
    onOpenTemplatePicker: () => {
      setIsTemplateModalOpen(true)
      setActiveToolTab('templates')
    },
    onOpenEmojiPicker: () => {
      setIsEmojiPickerOpen(prev => !prev)
    },
    enabled: true
  })

  // Auto-focus message input for faster responses
  useEffect(() => {
    textareaRef.current?.focus()
  }, [userId])

  // Auto-resize textarea based on content - no minimum constraint
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'

    // Set height based on actual content, max 300px
    const newHeight = Math.min(textarea.scrollHeight, 300)
    textarea.style.height = `${newHeight}px`
  }, [message])

  // Auto-resize AI textarea based on content
  useEffect(() => {
    const textarea = aiTextareaRef.current
    if (!textarea) return

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'

    // Set height based on scrollHeight, with min and max constraints
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 80), 240) // min 80px, max 240px
    textarea.style.height = `${newHeight}px`
  }, [aiResult])

  // File selection handlers - support multiple files
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files])
      // No preview for non-image files
    }
    // Reset input
    if (e.target) e.target.value = ''
  }, [])

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files])
      // Create preview URLs for images
      const newPreviewUrls = files.map(file => URL.createObjectURL(file))
      setPreviewUrls(prev => [...prev, ...newPreviewUrls])
    }
    // Reset input
    if (e.target) e.target.value = ''
  }, [])

  const clearSelectedFiles = useCallback(() => {
    // Revoke all preview URLs
    previewUrls.forEach(url => URL.revokeObjectURL(url))
    setSelectedFiles([])
    setPreviewUrls([])
  }, [previewUrls])

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    // If it's an image with preview, revoke and remove preview URL
    if (previewUrls[index]) {
      URL.revokeObjectURL(previewUrls[index])
      setPreviewUrls(prev => prev.filter((_, i) => i !== index))
    }
  }, [previewUrls])

  // Handle paste for images
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const pastedFiles: File[] = []
    const pastedPreviewUrls: string[] = []

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          pastedFiles.push(file)
          pastedPreviewUrls.push(URL.createObjectURL(file))
        }
      }
    }

    if (pastedFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...pastedFiles])
      setPreviewUrls(prev => [...prev, ...pastedPreviewUrls])
      e.preventDefault()
    }
  }, [])

  const handleSend = useCallback(async () => {
    // Handle multiple file uploads
    if (selectedFiles.length > 0) {
      // If we don't have lineUserId, we'll try to let the backend find it using internal_user_id
      // But we must have at least one of them
      if (!lineUserId && !userId) {
        toast({
          title: 'ส่งไฟล์ล้มเหลว',
          description: 'ไม่พบข้อมูลผู้ใช้',
          variant: 'destructive'
        })
        return
      }
      try {
        // Upload files one by one
        for (const file of selectedFiles) {
          const isImage = file.type.startsWith('image/')
          const formData = new FormData()
          formData.append('file', file)
          // Pass empty string if undefined/null so backend knows to look it up
          formData.append('user_id', lineUserId || '')
          formData.append('internal_user_id', userId)
          formData.append('type', isImage ? 'image' : 'file')

          const response = await fetch('/api/inbox/upload', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || `Failed to upload ${file.name}`)
          }
        }

        clearSelectedFiles()
        // Invalidate messages to refresh
        queryClient.invalidateQueries({ queryKey: queryKeys.messagesForUser(userId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
        toast({ title: `ส่ง ${selectedFiles.length} ไฟล์สำเร็จ` })
      } catch (error) {
        console.error('Failed to upload files:', error)
        toast({ title: 'ส่งไฟล์ล้มเหลว', description: error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง', variant: 'destructive' })
      }
      return
    }

    // Handle text message
    if (!message.trim()) return
    if (message.trim().startsWith('/')) {
      toast({
        title: 'ใช้คำสั่ง / สำหรับเทมเพลต',
        description: 'เลือกเทมเพลตจากรายการแล้วแก้ข้อความได้ทันที',
      })
      return
    }

    try {
      await sendMessage.mutateAsync({
        userId,
        content: message.trim(),
        messageType: 'text',
        replyToId: replyingToMessage?.id,
      })
      setMessage('')
      clearReply()
      stopTyping()
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }, [message, userId, sendMessage, stopTyping, selectedFiles, lineUserId, clearSelectedFiles, toast, queryClient, clearReply, replyingToMessage?.id])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Check if keys match send message shortcut
      const keyMatch = e.key.toLowerCase() === sendMessageShortcut.key.toLowerCase()
      const ctrlMatch = sendMessageShortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey
      const shiftMatch = sendMessageShortcut.shift ? e.shiftKey : !e.shiftKey
      const altMatch = sendMessageShortcut.alt ? e.altKey : !e.altKey

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend, sendMessageShortcut]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = e.target.value
      setMessage(nextValue)
      if (nextValue.startsWith('/')) {
        setActiveToolTab('templates')
        setSlashTemplateQuery(nextValue.slice(1))
      } else if (slashTemplateQuery) {
        setSlashTemplateQuery('')
      }
      startTyping()
    },
    [startTyping, slashTemplateQuery]
  )

  const handleAiReply = useCallback(async () => {
    try {
      const result = await aiReply.mutateAsync({ userId, tone: aiTone })
      setAiResult(result.text)
      setIsAiOpen(true)
    } catch (error) {
      toast({ title: 'AI ตอบกลับล้มเหลว', description: 'กรุณาลองใหม่อีกครั้ง' })
    }
  }, [aiReply, aiTone, toast, userId])

  const handleAiDraft = useCallback(async () => {
    try {
      const result = await aiDraft.mutateAsync({ userId, tone: aiTone })
      setAiResult(result.text)
      setIsAiOpen(true)
    } catch (error) {
      toast({ title: 'AI Draft ล้มเหลว', description: 'กรุณาลองใหม่อีกครั้ง' })
    }
  }, [aiDraft, aiTone, toast, userId])

  const handleAiAnalyze = useCallback(async () => {
    if (!latestImageUrl) {
      toast({ title: 'ไม่มีรูปภาพล่าสุด', description: 'ไม่พบรูปภาพในบทสนทนานี้' })
      return
    }
    try {
      const result = await aiAnalyze.mutateAsync({ userId, imageUrl: latestImageUrl })
      setAiResult(result.text)
      setIsAiOpen(true)
    } catch (error) {
      toast({ title: 'วิเคราะห์รูปภาพล้มเหลว', description: 'กรุณาลองใหม่อีกครั้ง' })
    }
  }, [aiAnalyze, latestImageUrl, toast, userId])

  const isAiBusy = aiReply.isPending || aiDraft.isPending || aiAnalyze.isPending
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)

  return (
    <div className="p-4 border-t bg-card">
      {/* Reply Banner */}
      {replyingToMessage && (
        <div className="mb-3 px-3 py-2 bg-muted rounded-lg flex items-center justify-between border-l-4 border-primary">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-primary flex items-center gap-1">
              <Reply className="h-3 w-3" />
              ตอบกลับ {replyingToMessage.direction === 'incoming' ? 'ลูกค้า' : 'แอดมิน'}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {replyingToMessage.messageType === 'text'
                ? replyingToMessage.content
                : `[${replyingToMessage.messageType}]`}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearReply} aria-label="ยกเลิกการตอบกลับ">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <Button
          size="sm"
          variant={activeToolTab === 'ai' ? 'secondary' : 'outline'}
          onClick={() => setActiveToolTab('ai')}
        >
          AI
        </Button>
        <Button
          size="sm"
          variant={activeToolTab === 'templates' ? 'secondary' : 'outline'}
          onClick={() => {
            setActiveToolTab('templates')
            setIsTemplateModalOpen(true)
          }}
        >
          เทมเพลต
        </Button>
      </div>

      {activeToolTab === 'ai' && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Button size="sm" variant="secondary" onClick={handleAiReply} disabled={isAiBusy}>
            <Sparkles className="h-4 w-4 mr-1" />
            AI Reply
          </Button>
          <Button size="sm" variant="outline" onClick={handleAiDraft} disabled={isAiBusy}>
            Ghost Draft
          </Button>
          <Button size="sm" variant="outline" onClick={handleAiAnalyze} disabled={isAiBusy}>
            วิเคราะห์รูป
          </Button>
          <select
            className="h-8 rounded-md border bg-background px-2 text-xs"
            value={aiTone}
            onChange={(e) => setAiTone(e.target.value)}
          >
            <option value="friendly">เป็นมิตร</option>
            <option value="professional">มืออาชีพ</option>
            <option value="empathetic">เห็นใจ</option>
          </select>
        </div>
      )}

      {/* Template Modal */}
      <TemplatePickerModal
        open={isTemplateModalOpen}
        onOpenChange={setIsTemplateModalOpen}
        onSelect={(content) => {
          setMessage(content)
          setIsTemplateModalOpen(false)
          setActiveToolTab('ai')
        }}
      />

      {isAiOpen && (
        <div className="mb-3 rounded-lg border bg-muted/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">AI Draft</span>
            <Button variant="ghost" size="icon" onClick={() => setIsAiOpen(false)} aria-label="ปิด AI Draft">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            ref={aiTextareaRef}
            value={aiResult}
            onChange={(e) => setAiResult(e.target.value)}
            className="resize-none overflow-hidden"
            style={{ minHeight: '80px', maxHeight: '240px' }}
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMessage(aiResult)}
              disabled={!aiResult.trim()}
            >
              ใส่ในข้อความ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAiResult('')}>
              ล้าง
            </Button>
          </div>
        </div>
      )}

      {/* Hidden file inputs - multiple selection enabled */}
      <input
        type="file"
        ref={fileInputRef}
        hidden
        multiple
        onChange={handleFileSelect}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
      />
      <input
        type="file"
        ref={imageInputRef}
        hidden
        multiple
        accept="image/*"
        onChange={handleImageSelect}
      />

      {/* Multiple files preview */}
      {selectedFiles.length > 0 && (
        <div className="mb-3 p-3 border rounded-lg bg-muted/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{selectedFiles.length} ไฟล์ที่เลือก</span>
            <Button variant="ghost" size="sm" onClick={clearSelectedFiles} className="h-6 text-xs">
              ล้างทั้งหมด
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-background rounded-md">
                {file.type.startsWith('image/') && previewUrls[index] ? (
                  <Image
                    src={previewUrls[index]}
                    alt="Preview"
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded object-cover flex-shrink-0"
                    unoptimized
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => removeFile(index)}
                  aria-label={`ลบไฟล์ ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-12 w-12"
          onClick={() => fileInputRef.current?.click()}
          aria-label="แนบไฟล์"
        >
          <Paperclip className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-12 w-12"
          onClick={() => imageInputRef.current?.click()}
          aria-label="แนบรูปภาพ"
        >
          <ImageIcon className="h-6 w-6" />
        </Button>

        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={selectedFiles.length > 0 ? 'กดส่งเพื่อส่งไฟล์...' : 'พิมพ์ข้อความ...'}
          className="resize-none text-base px-4 py-3 bg-white border-2 border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 rounded-xl shadow-sm placeholder:text-gray-500 overflow-y-auto"
          style={{ minHeight: '44px', maxHeight: '300px' }}
          rows={1}
          disabled={selectedFiles.length > 0}
          aria-label="พิมพ์ข้อความ"
        />

        <div className="relative flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12"
            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
            aria-label="เปิดอีโมจิ"
          >
            <Smile className="h-6 w-6" />
          </Button>
          <EmojiPicker
            isOpen={isEmojiPickerOpen}
            onClose={() => setIsEmojiPickerOpen(false)}
            onEmojiSelect={(emoji) => {
              setMessage((prev) => prev + emoji)
              textareaRef.current?.focus()
            }}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={(!message.trim() && selectedFiles.length === 0) || sendMessage.isPending}
          className="flex-shrink-0 h-12 w-12 bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all"
          aria-label="ส่งข้อความ"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}

function EmptyChat() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
        <Send className="h-10 w-10 opacity-50" />
      </div>
      <h3 className="text-lg font-medium mb-1">เลือกการสนทนา</h3>
      <p className="text-sm">เลือกการสนทนาจากรายการด้านซ้ายเพื่อเริ่มแชท</p>
    </div>
  )
}

export function ChatPanel() {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const { selectedConversationId } = useInboxStore()
  const { getTypingUsers, lightboxImage, closeLightbox } = useChatStore()
  const { data: session } = useSession()
  const { data: admins = [] } = useAdmins()

  // Mark performance start when conversation is selected
  useEffect(() => {
    if (selectedConversationId && typeof window !== 'undefined') {
      performance.mark('message-load-start')
    }
  }, [selectedConversationId])

  const { data: conversation } = useConversation(selectedConversationId)
  const { data: messagesData, isLoading } = useMessages(selectedConversationId)

  const messages = useMemo(() => messagesData?.data || [], [messagesData])
  useNewMessageAnnouncement(messages)

  // Mark performance end when messages are loaded
  useEffect(() => {
    if (!isLoading && messages.length > 0 && typeof window !== 'undefined') {
      performance.mark('message-load-end')
      try {
        performance.measure('message-load', 'message-load-start', 'message-load-end')
        const measure = performance.getEntriesByName('message-load')[0]
        if (measure && process.env.NODE_ENV === 'development') {
          const status = measure.duration < 1000 ? '✅' : '❌'
          console.log(`${status} Message Load Time: ${measure.duration.toFixed(2)}ms (target: <1000ms)`)
        }
      } catch (e) {
        // Ignore measurement errors
      }
    }
  }, [isLoading, messages.length])
  const adminNameById = useMemo(() => {
    const map = new Map<string, string>()
    admins.forEach((admin) => {
      if (!admin.id) return
      map.set(admin.id.toString(), admin.displayName || admin.username)
    })
    return map
  }, [admins])
  const currentAdminName = session?.user?.name || 'คุณ'
  const resolveSenderName = useCallback(
    (sentBy: string | null) => {
      if (!sentBy) return 'ไม่ระบุผู้ส่ง'

      const normalized = String(sentBy).trim()
      const lower = normalized.toLowerCase()
      if (lower === 'system') return 'ระบบ'
      if (lower === 'ai') return 'AI'

      if (normalized.includes(':')) {
        const [prefix, ...rest] = normalized.split(':')
        const name = rest.join(':').trim()
        const prefixLower = prefix.toLowerCase()
        if (prefixLower === 'system') return 'ระบบ'
        if (prefixLower === 'ai') return 'AI'
        if (prefixLower === 'admin' && name) return name
        if (prefixLower === 'user' && name) return name
      }

      return adminNameById.get(normalized) || 'ไม่ระบุผู้ส่ง'
    },
    [adminNameById]
  )
  const latestImageUrl = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i]
      if (msg.messageType === 'image' && msg.mediaUrl) {
        return msg.mediaUrl
      }
    }
    return null
  }, [messages])
  const typingUsers = selectedConversationId
    ? getTypingUsers(selectedConversationId)
    : []
  const hasTypingIndicator = typingUsers.length > 0
  const totalRowCount = messages.length + (hasTypingIndicator ? 1 : 0)

  const rowVirtualizer = useVirtualizer({
    count: totalRowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 8,
    getItemKey: (index) =>
      index < messages.length ? messages[index].id : 'typing-indicator',
    measureElement: (el) => el.getBoundingClientRect().height,
  })

  // Auto scroll to bottom
  useEffect(() => {
    if (!parentRef.current || totalRowCount === 0) return
    requestAnimationFrame(() => {
      rowVirtualizer.scrollToIndex(totalRowCount - 1, { align: 'end' })
    })
  }, [rowVirtualizer, totalRowCount])

  if (!selectedConversationId) {
    return <EmptyChat />
  }

  return (
    <div id="chat-panel" className="flex flex-col h-full bg-background" aria-label="แผงแชท">
      <ChatHeader conversation={conversation} />

      <ScrollArea ref={parentRef} className="flex-1">
        {isLoading ? (
          <div className="space-y-4 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'flex gap-2',
                  i % 2 === 0 ? 'justify-start' : 'justify-end'
                )}
              >
                {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full" />}
                <Skeleton className="h-16 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p>ยังไม่มีข้อความ</p>
            <p className="text-sm">เริ่มการสนทนาโดยส่งข้อความแรก</p>
          </div>
        ) : (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
              padding: '16px 12px',
              boxSizing: 'border-box',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              if (virtualRow.index === messages.length) {
                return (
                  <div
                    key="typing-indicator"
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <TypingIndicator names={typingUsers.map((u) => u.name)} />
                  </div>
                )
              }
              const msg = messages[virtualRow.index]
              const senderName =
                msg.direction === 'outgoing'
                  ? resolveSenderName(msg.sentBy || null)
                  : null
              return (
                <div
                  key={msg.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <MessageBubble
                    message={msg}
                    isLast={virtualRow.index === messages.length - 1}
                    senderName={senderName}
                    user={conversation?.user}
                  />
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <MessageComposer
        userId={selectedConversationId}
        latestImageUrl={latestImageUrl}
        lineUserId={conversation?.user?.lineUserId}
        user={conversation?.user}
      />

      {/* Image Lightbox Modal */}
      <ImageLightbox
        src={lightboxImage}
        isOpen={!!lightboxImage}
        onClose={closeLightbox}
      />
    </div>
  )
}
