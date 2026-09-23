'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { ExternalLink, Loader2, Plus, RefreshCw, Save } from 'lucide-react'
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
import { orderByIds } from '@/lib/promo-rows'
import type { RegionClickSummary } from '@/lib/promo-clicks'
import { PromoClickStats } from '@/components/promo-page/PromoClickStats'
import { PromoFlexCard } from '@/components/promo-page/PromoFlexCard'
import {
  PreviewFrame,
  SortableList,
  SortableRow,
  Thumb,
  isHttps,
  type PreviewView,
} from '@/components/promo-page/PromoFormParts'
import type {
  PromoHeroBanner,
  PromoPageSettings,
  PromoSectionSetting,
} from '@/lib/promo-page-settings'

const MOBILE_COLS = [1, 2] as const
const DESKTOP_COLS = [3, 4, 5] as const
const MAX_HERO_BANNERS = 8
const PREVIEW_DEBOUNCE_MS = 500
const CLICK_DAYS = 30

/** A CMS section as the settings API describes it: what the admin can order and re-banner. */
interface SectionMeta {
  id: string
  title: string
  bannerUrl: string | null
  cards: number
}

/** The draft as the page would show it now: half-typed URLs are left out, not rejected. */
function previewable(settings: PromoPageSettings): PromoPageSettings {
  const url = (value: string) => (isHttps(value) ? value.trim() : '')
  return {
    ...settings,
    heroBanners: settings.heroBanners
      .filter((banner) => isHttps(banner.imageUrl))
      .map((banner) => ({ imageUrl: banner.imageUrl.trim(), href: url(banner.href) })),
    sections: settings.sections.map((section) => ({
      ...section,
      imageUrl: url(section.imageUrl),
      href: url(section.href),
    })),
  }
}

/**
 * Display settings for the public /promo page, with the page itself rendered live
 * beside the form. The content comes from the CMS article on the main site — this
 * controls layout, order, and which banners show where.
 */
export function PromoPageSettingsForm() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<PromoPageSettings | null>(null)
  const [sections, setSections] = useState<SectionMeta[]>([])
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const [previewView, setPreviewView] = useState<PreviewView>('home')
  const [clicks, setClicks] = useState<RegionClickSummary | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/inbox/promo-page-settings')
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'load failed')
      setSettings(payload.data as PromoPageSettings)
      setSections((payload.sections as SectionMeta[] | undefined) ?? [])
    } catch (error) {
      console.error('[promo-page] load settings failed', error)
      toast({ title: 'โหลดการตั้งค่าไม่สำเร็จ', variant: 'destructive' })
    }
    // Click stats are a nice-to-have: a failure here must not block the form.
    try {
      const response = await fetch(`/api/inbox/promo-page-settings/clicks?days=${CLICK_DAYS}`)
      const payload = await response.json()
      if (response.ok && payload.success) setClicks(payload.data as RegionClickSummary)
    } catch (error) {
      console.error('[promo-page] load clicks failed', error)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  // Live preview: each change signs the draft and the frame reloads with it.
  useEffect(() => {
    if (!settings) return
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/inbox/promo-page-settings/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(previewable(settings)),
        })
        const payload = await response.json()
        if (!response.ok || !payload.success) throw new Error(payload.error || 'preview failed')
        setPreviewToken(payload.token as string)
      } catch (error) {
        console.error('[promo-page] preview failed', error)
      }
    }, PREVIEW_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [settings])

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

  // Sections in page order, each with its override (blank until the admin sets one).
  const sectionRows = useMemo(() => {
    if (!settings) return []
    const saved = new Map(settings.sections.map((section) => [section.id, section]))
    return orderByIds(
      sections,
      settings.sections.map((section) => section.id)
    ).map((meta) => ({
      meta,
      setting: saved.get(meta.id) ?? { id: meta.id, imageUrl: '', href: '' },
    }))
  }, [settings, sections])

  // Every section change writes the whole list back, so the saved order is always complete.
  const writeSections = (rows: PromoSectionSetting[]) => patch({ sections: rows })
  const patchSection = (id: string, next: Partial<PromoSectionSetting>) =>
    writeSections(
      sectionRows.map((row) => (row.meta.id === id ? { ...row.setting, ...next } : row.setting))
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
      toast({ title: 'บันทึกแล้ว', description: 'หน้า /promo แสดงผลตามนี้แล้ว' })
    } catch (error) {
      console.error('[promo-page] save settings failed', error)
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: 'ตรวจว่า URL ทุกช่องขึ้นต้นด้วย https://',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      const response = await fetch('/api/inbox/promo-page-settings/refresh', { method: 'POST' })
      if (!response.ok) throw new Error('refresh failed')
      await load()
      toast({ title: 'ดึงข้อมูลใหม่แล้ว' })
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

  const firstSection = sectionRows[0]?.meta.id
  const previewSrc = previewToken
    ? `/promo?preview=${encodeURIComponent(previewToken)}${
        previewView === 'grid' && firstSection ? `&s=${encodeURIComponent(firstSection)}` : ''
      }`
    : null

  return (
    <div className="p-4 sm:p-6 lg:flex lg:items-start lg:gap-6">
      <div className="space-y-4 lg:w-[460px] lg:shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-800">หน้ารวมโปร</h1>
          <p className="mt-1 text-sm text-gray-500">
            เนื้อหาดึงจากบทความโปรโมชันบนเว็บหลัก — ที่นี่จัดลำดับ สลับแบนเนอร์ และตั้งค่าการแสดงผล
            ตัวอย่างด้านข้างอัปเดตทันที กด &quot;บันทึก&quot; เมื่อพอใจ
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

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 space-y-2">
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

            <div className="flex-1 space-y-2">
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

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="showQuickReply">ปุ่มลัดโปรใต้ข้อความที่บอทตอบ (quick reply)</Label>
              <p className="text-xs text-gray-500">
                &quot;โปรทั้งหมด&quot; + แบรนด์พาร์ทเนอร์ สูงสุด 13 ปุ่ม แนบทุกครั้งที่บอทตอบอัตโนมัติ
              </p>
            </div>
            <Switch
              id="showQuickReply"
              checked={settings.showQuickReply}
              onCheckedChange={(checked) => patch({ showQuickReply: checked })}
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
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label>แบนเนอร์หัวโปร (สไลด์บนสุด)</Label>
              <p className="text-xs text-gray-500">
                ลากเพื่อจัดลำดับสไลด์ · เว้นว่างทั้งหมด = ใช้แบนเนอร์จากบทความบนเว็บหลัก
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
          <SortableList
            id="promo-hero"
            ids={settings.heroBanners.map((_, index) => `hero-${index}`)}
            onMove={(from, to) => patch({ heroBanners: arrayMove(settings.heroBanners, from, to) })}
          >
            {settings.heroBanners.map((banner, index) => (
              <SortableRow
                key={`hero-${index}`}
                id={`hero-${index}`}
                thumb={<Thumb src={banner.imageUrl} />}
                onRemove={() =>
                  patch({ heroBanners: settings.heroBanners.filter((_, i) => i !== index) })
                }
                removeLabel={`ลบแบนเนอร์ ${index + 1}`}
              >
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
              </SortableRow>
            ))}
          </SortableList>
        </Card>

        <Card className="space-y-3 p-4">
          <div>
            <Label>ส่วนต่าง ๆ ของหน้า</Label>
            <p className="text-xs text-gray-500">
              ลากเพื่อจัดลำดับส่วน · ใส่ URL รูปเพื่อใช้แทนแบนเนอร์หัวส่วนจากบทความ
            </p>
          </div>
          {sectionRows.length === 0 ? (
            <p className="text-sm text-gray-400">
              ยังอ่านส่วนจากบทความไม่ได้ — กด &quot;ดึงข้อมูลใหม่&quot; แล้วลองอีกครั้ง
            </p>
          ) : (
            <SortableList
              id="promo-sections"
              ids={sectionRows.map((row) => row.meta.id)}
              onMove={(from, to) =>
                writeSections(arrayMove(sectionRows, from, to).map((row) => row.setting))
              }
            >
              {sectionRows.map(({ meta, setting }) => (
                <SortableRow
                  key={meta.id}
                  id={meta.id}
                  thumb={<Thumb src={setting.imageUrl || meta.bannerUrl || ''} />}
                >
                  <div className="text-sm font-medium text-gray-800">
                    {meta.title}{' '}
                    <span className="font-normal text-gray-400">
                      · {meta.cards} รายการ · {meta.id}
                    </span>
                  </div>
                  <Input
                    value={setting.imageUrl}
                    placeholder={
                      meta.bannerUrl
                        ? 'ใช้แบนเนอร์จากบทความ (ใส่ URL เพื่อแทน)'
                        : 'URL รูปแบนเนอร์หัวส่วน (https)'
                    }
                    aria-label={`แบนเนอร์ ${meta.title}`}
                    onChange={(event) => patchSection(meta.id, { imageUrl: event.target.value })}
                  />
                  <Input
                    value={setting.href}
                    placeholder="ลิงก์เมื่อแตะแบนเนอร์ (ไม่บังคับ, https)"
                    aria-label={`ลิงก์แบนเนอร์ ${meta.title}`}
                    onChange={(event) => patchSection(meta.id, { href: event.target.value })}
                  />
                </SortableRow>
              ))}
            </SortableList>
          )}
        </Card>

        <PromoFlexCard settings={previewable(settings)} />

        <PromoClickStats summary={clicks} days={CLICK_DAYS} />

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
              เปิดหน้า /promo จริง
            </a>
          </Button>
        </div>
      </div>

      <PreviewFrame src={previewSrc} view={previewView} onView={setPreviewView} />
    </div>
  )
}
