'use client'

import { useState } from 'react'
import { ExternalLink, Loader2, MessageSquare, Save, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { FlexPreview } from '@/components/inbox/FlexPreview'
import { ImagemapTestSendModal } from '@/components/broadcasts/ImagemapTestSendModal'
import { useToast } from '@/hooks/use-toast'
import type { PromoPageSettings } from '@/lib/promo-page-settings'
import type { FlexMessage } from '@/lib/promo-flex'

const DRAFT_TITLE = 'รวมโปรโมชัน'

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
        body: JSON.stringify({ messageType: 'flex', content: DRAFT_TITLE, flexContents: messages }),
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
      {draftId && (
        <p className="text-xs text-amber-700">
          ร่างนี้ผู้รับ = เพื่อนทุกคนของ OA · กดส่งที่หน้าบรอดแคสต์เมื่อทดสอบแล้วเท่านั้น
        </p>
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
