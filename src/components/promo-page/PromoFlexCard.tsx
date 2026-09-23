'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2, MessageSquare, Save, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { FlexPreview } from '@/components/inbox/FlexPreview'
import { ImagemapTestSendModal } from '@/components/broadcasts/ImagemapTestSendModal'
import { useToast } from '@/hooks/use-toast'
import type { PromoPageSettings } from '@/lib/promo-page-settings'
import type { FlexMessage } from '@/lib/promo-flex'

const DRAFT_TITLE = 'รวมโปรโมชัน'
const TAG_FILTER_MIN = 8

interface TagOption {
  id: number
  name: string
  usageCount: number
}

/**
 * Turns the page, as currently set up in the form, into a LINE broadcast: preview
 * the flex messages here, push them to one chosen chat as a test, then save them as
 * a draft to send or schedule from the broadcasts page. The real send happens there.
 */
export function PromoFlexCard({ settings }: { settings: PromoPageSettings }) {
  const { toast } = useToast()
  const [messages, setMessages] = useState<FlexMessage[] | null>(null)
  const [building, setBuilding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draftId, setDraftId] = useState<number | null>(null)
  const [testOpen, setTestOpen] = useState(false)
  const [tags, setTags] = useState<TagOption[]>([])
  const [tagIds, setTagIds] = useState<number[]>([])
  const [tagFilter, setTagFilter] = useState('')
  const [recipients, setRecipients] = useState<number | null>(null)

  // Tags to target, loaded once the flex exists (the only time they matter).
  useEffect(() => {
    if (!messages || tags.length > 0) return
    fetch('/api/inbox/tags')
      .then((res) => res.json())
      .then((payload: { data?: { id: string; name: string; usageCount?: number }[] }) =>
        setTags(
          (payload.data ?? [])
            .map((tag) => ({ id: Number(tag.id), name: tag.name, usageCount: tag.usageCount ?? 0 }))
            .filter((tag) => Number.isInteger(tag.id) && tag.id > 0)
        )
      )
      .catch((error) => console.error('[promo-page] load tags failed', error))
  }, [messages, tags.length])

  // Who the draft would reach: every follower, or the chosen tags.
  useEffect(() => {
    if (!messages) return
    setRecipients(null)
    fetch('/api/inbox/broadcasts/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tagIds.length > 0 ? { targetTagIds: tagIds } : {}),
    })
      .then((res) => res.json())
      .then((payload) => setRecipients(Number(payload?.data?.totalRecipients ?? 0)))
      .catch((error) => console.error('[promo-page] estimate failed', error))
  }, [messages, tagIds])

  const shownTags = useMemo(() => {
    const needle = tagFilter.trim().toLowerCase()
    return needle ? tags.filter((tag) => tag.name.toLowerCase().includes(needle)) : tags
  }, [tags, tagFilter])

  const toggleTag = (id: number) => {
    setDraftId(null)
    setTagIds((current) => (current.includes(id) ? current.filter((t) => t !== id) : [...current, id]))
  }

  const build = async () => {
    setBuilding(true)
    setDraftId(null)
    try {
      const response = await fetch('/api/inbox/promo-page-settings/flex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'build failed')
      setMessages(payload.messages as FlexMessage[])
    } catch (error) {
      console.error('[promo-page] build flex failed', error)
      toast({ title: 'สร้าง Flex ไม่สำเร็จ', variant: 'destructive' })
    } finally {
      setBuilding(false)
    }
  }

  const saveDraft = async () => {
    if (!messages) return
    setSaving(true)
    try {
      const response = await fetch('/api/inbox/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageType: 'flex',
          content: DRAFT_TITLE,
          flexContents: messages,
          ...(tagIds.length > 0 ? { targetTagIds: tagIds } : {}),
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'save failed')
      setDraftId(Number(payload.data?.id) || null)
      toast({ title: 'บันทึกร่างบรอดแคสต์แล้ว', description: 'ไปส่งหรือตั้งเวลาได้ที่หน้าบรอดแคสต์' })
    } catch (error) {
      console.error('[promo-page] save flex draft failed', error)
      toast({ title: 'บันทึกร่างไม่สำเร็จ', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <div>
        <Label>ส่งหน้าโปรเป็น Flex</Label>
        <p className="text-xs text-gray-500">
          สร้างจากการตั้งค่าด้านบน (รวมที่ยังไม่บันทึก) · แบนเนอร์ + ดีลใกล้หมดเวลา + แต่ละส่วนของหน้า
          สูงสุด 5 ข้อความ · ลิงก์นับคลิกเข้าการ์ดสถิติ
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={build} disabled={building}>
          {building ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
          {messages ? 'สร้างใหม่' : 'สร้าง Flex'}
        </Button>
        {messages && messages.length > 0 && (
          <Button type="button" variant="outline" onClick={() => setTestOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            ส่งทดสอบเข้า LINE
          </Button>
        )}
        {messages && messages.length > 0 && (
          <Button type="button" onClick={saveDraft} disabled={saving || draftId !== null}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {draftId ? 'บันทึกแล้ว' : 'บันทึกเป็นร่างบรอดแคสต์'}
          </Button>
        )}
        {draftId && (
          <Button variant="ghost" asChild>
            <a href="/inbox/broadcasts">
              <ExternalLink className="mr-2 h-4 w-4" />
              ไปหน้าบรอดแคสต์
            </a>
          </Button>
        )}
      </div>
      {messages && messages.length > 0 && (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-baseline justify-between gap-2">
            <Label>ผู้รับของร่าง</Label>
            <span className={cn('text-xs', tagIds.length === 0 ? 'text-amber-700' : 'text-gray-500')}>
              {tagIds.length === 0 ? 'เพื่อนทุกคนของ OA' : `${tagIds.length} tag`}
              {recipients !== null ? ` · ${recipients.toLocaleString('th-TH')} คน` : ' · กำลังนับ...'}
            </span>
          </div>
          <p className="text-xs text-gray-500">เลือก tag เพื่อส่งเฉพาะกลุ่ม · ไม่เลือก = ส่งทุกคน</p>
          {tags.length > TAG_FILTER_MIN && (
            <Input
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="ค้นหา tag"
              aria-label="ค้นหา tag"
              className="h-8 text-xs"
            />
          )}
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {shownTags.map((tag) => {
              const on = tagIds.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs',
                    on ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500'
                  )}
                >
                  {tag.name} <span className={on ? 'text-gray-300' : 'text-gray-400'}>{tag.usageCount}</span>
                </button>
              )
            })}
            {tags.length === 0 && <span className="text-xs text-gray-400">ยังไม่มี tag</span>}
          </div>
        </div>
      )}
      {building && <p className="text-xs text-gray-500">กำลังดึงราคาล่าสุด อาจใช้เวลา 10–20 วินาที...</p>}
      {messages?.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีการ์ดโปรให้ส่ง</p>}
      {messages?.map((message, index) => (
        <div key={index} className="space-y-1">
          <p className="text-xs text-gray-500">
            ข้อความ {index + 1}/{messages.length} · {message.altText}
          </p>
          <div className="overflow-x-auto rounded-lg bg-[#8cabd9] p-2">
            <FlexPreview flex={message} />
          </div>
        </div>
      ))}
      <ImagemapTestSendModal open={testOpen} onOpenChange={setTestOpen} imagemap={null} flexContents={messages} />
    </Card>
  )
}
