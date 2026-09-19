'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { PromoHeroBanner, PromoPageSettings } from '@/lib/promo-page-settings'

const MOBILE_COLS = [1, 2] as const
const DESKTOP_COLS = [3, 4, 5] as const
const MAX_HERO_BANNERS = 8

/**
 * Display settings for the public /promo page. The content itself comes from the
 * CMS article on the main site — this only controls how it is laid out.
 */
export function PromoPageSettingsForm() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<PromoPageSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/inbox/promo-page-settings')
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'load failed')
      setSettings(payload.data as PromoPageSettings)
    } catch (error) {
      console.error('[promo-page] load settings failed', error)
      toast({ title: 'โหลดการตั้งค่าไม่สำเร็จ', variant: 'destructive' })
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const patch = (next: Partial<PromoPageSettings>) =>
    setSettings((current) => (current ? { ...current, ...next } : current))

  const patchBanner = (index: number, next: Partial<PromoHeroBanner>) =>
    setSettings((current) =>
      current
        ? {
            ...current,
            heroBanners: current.heroBanners.map((banner, i) =>
              i === index ? { ...banner, ...next } : banner
            ),
          }
        : current
    )

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const response = await fetch('/api/inbox/promo-page-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // A row left blank is not a banner, just an unused slot.
        body: JSON.stringify({
          ...settings,
          heroBanners: settings.heroBanners.filter((banner) => banner.imageUrl.trim()),
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'save failed')
      setSettings(payload.data as PromoPageSettings)
      toast({ title: 'บันทึกแล้ว' })
    } catch (error) {
      console.error('[promo-page] save settings failed', error)
      toast({ title: 'บันทึกไม่สำเร็จ', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      const response = await fetch('/api/inbox/promo-page-settings/refresh', { method: 'POST' })
      if (!response.ok) throw new Error('refresh failed')
      toast({
        title: 'ดึงข้อมูลใหม่แล้ว',
        description: 'เปิดหน้า /promo อีกครั้งเพื่อดูเนื้อหาล่าสุด',
      })
    } catch (error) {
      console.error('[promo-page] refresh failed', error)
      toast({ title: 'ดึงข้อมูลใหม่ไม่สำเร็จ', variant: 'destructive' })
    } finally {
      setRefreshing(false)
    }
  }

  if (!settings) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-800">หน้ารวมโปร</h1>
        <p className="mt-1 text-sm text-gray-500">
          เนื้อหาทั้งหมดดึงจากบทความโปรโมชันบนเว็บหลัก (ทีมการตลาดแก้ที่เว็บหลักได้เลย) —
          ตั้งค่าที่นี่คุมแค่การแสดงผล
        </p>
      </div>

      <Card className="space-y-5 p-4">
        <div className="space-y-2">
          <Label htmlFor="newsId">รหัสบทความ (news id)</Label>
          <Input
            id="newsId"
            type="number"
            min={1}
            value={settings.newsId}
            onChange={(event) => patch({ newsId: Number(event.target.value) })}
          />
          <p className="text-xs text-gray-500">ค่าเริ่มต้น 12 = บทความ &quot;รวมโปรโมชั่น&quot;</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>จำนวนคอลัมน์บนมือถือ</Label>
            <Select
              value={String(settings.colsMobile)}
              onValueChange={(value) =>
                patch({ colsMobile: Number(value) as PromoPageSettings['colsMobile'] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOBILE_COLS.map((cols) => (
                  <SelectItem key={cols} value={String(cols)}>
                    {cols} คอลัมน์
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>จำนวนคอลัมน์บนจอใหญ่</Label>
            <Select
              value={String(settings.colsDesktop)}
              onValueChange={(value) =>
                patch({ colsDesktop: Number(value) as PromoPageSettings['colsDesktop'] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DESKTOP_COLS.map((cols) => (
                  <SelectItem key={cols} value={String(cols)}>
                    {cols} คอลัมน์
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="showTabs">แสดงแถบหัวข้อด้านบน</Label>
            <p className="text-xs text-gray-500">แตะเพื่อเลื่อนไปยังแต่ละส่วนของหน้า</p>
          </div>
          <Switch
            id="showTabs"
            checked={settings.showTabs}
            onCheckedChange={(checked) => patch({ showTabs: checked })}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="showChatButton">แสดงปุ่ม &quot;สั่งผ่านแชท&quot;</Label>
            <p className="text-xs text-gray-500">ใต้การ์ดพาร์ทเนอร์</p>
          </div>
          <Switch
            id="showChatButton"
            checked={settings.showChatButton}
            onCheckedChange={(checked) => patch({ showChatButton: checked })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="chatText">ข้อความที่ลูกค้าจะส่งเข้าแชท</Label>
          <Input
            id="chatText"
            value={settings.chatText}
            maxLength={200}
            onChange={(event) => patch({ chatText: event.target.value })}
          />
          <p className="text-xs text-gray-500">
            ใช้ <code>{'{partner}'}</code> แทนชื่อแบรนด์ของการ์ดที่ลูกค้ากด
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label>แบนเนอร์หัวโปร (สไลด์บนสุด)</Label>
              <p className="text-xs text-gray-500">
                วาง URL รูป (https) ทีละแผ่น เรียงตามลำดับสไลด์ · เว้นว่างทั้งหมด =
                ใช้แบนเนอร์จากบทความบนเว็บหลัก
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={settings.heroBanners.length >= MAX_HERO_BANNERS}
              onClick={() =>
                patch({ heroBanners: [...settings.heroBanners, { imageUrl: '', href: '' }] })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              เพิ่ม
            </Button>
          </div>
          {settings.heroBanners.map((banner, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1 space-y-1">
                <Input
                  value={banner.imageUrl}
                  placeholder="https://manager.cnypharmacy.com/uploads/editor/….png"
                  aria-label={`รูปแบนเนอร์ ${index + 1}`}
                  onChange={(event) => patchBanner(index, { imageUrl: event.target.value })}
                />
                <Input
                  value={banner.href}
                  placeholder="ลิงก์เมื่อแตะ (ไม่บังคับ, https)"
                  aria-label={`ลิงก์แบนเนอร์ ${index + 1}`}
                  onChange={(event) => patchBanner(index, { href: event.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`ลบแบนเนอร์ ${index + 1}`}
                onClick={() =>
                  patch({ heroBanners: settings.heroBanners.filter((_, i) => i !== index) })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          บันทึก
        </Button>
        <Button variant="outline" onClick={refresh} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          ดึงข้อมูลใหม่
        </Button>
        <Button variant="ghost" asChild>
          <a href="/promo" target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            เปิดดูหน้า /promo
          </a>
        </Button>
      </div>
    </div>
  )
}
