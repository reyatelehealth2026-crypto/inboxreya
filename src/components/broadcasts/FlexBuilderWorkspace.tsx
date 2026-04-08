'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, LayoutTemplate, Save, Sparkles, Wand2 } from 'lucide-react'
import { useCreateBroadcastTemplate } from '@/hooks/use-broadcasts'
import { FlexMessage } from '@/types/broadcast'
import { FlexPreview } from '@/components/inbox/FlexPreview'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

type FlexPreset = 'announcement' | 'promo' | 'cta'

const presetDescriptions: Record<FlexPreset, string> = {
  announcement: 'ประกาศข้อความเดี่ยวพร้อมเนื้อหาเด่น',
  promo: 'โปรโมชันพร้อมปุ่มซื้อ/ดูรายละเอียด',
  cta: 'การ์ดเน้นปุ่ม CTA ชัด ๆ',
}

function buildFlexMessage(input: {
  title: string
  body: string
  footer: string
  buttonLabel: string
  buttonUrl: string
  heroImageUrl: string
  accentColor: string
  showButton: boolean
  preset: FlexPreset
}): FlexMessage {
  const title = input.title.trim() || 'หัวข้อข้อความ'
  const body = input.body.trim() || 'รายละเอียดข้อความ'
  const footer = input.footer.trim() || 'ข้อความท้ายการ์ด'
  const accentColor = input.accentColor.trim() || '#06C755'

  const bodyContents: Record<string, any>[] = [
    {
      type: 'text',
      text: title,
      weight: 'bold',
      size: input.preset === 'cta' ? 'xl' : 'lg',
      color: '#111827',
      wrap: true,
    },
    {
      type: 'text',
      text: body,
      size: 'sm',
      color: '#4B5563',
      wrap: true,
      margin: 'md',
    },
  ]

  if (footer) {
    bodyContents.push({
      type: 'text',
      text: footer,
      size: 'xs',
      color: '#6B7280',
      wrap: true,
      margin: 'lg',
    })
  }

  const bubble: Record<string, any> = {
    type: 'bubble',
    size: input.preset === 'cta' ? 'mega' : 'deca',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: bodyContents,
      paddingAll: '20px',
    },
  }

  if (input.heroImageUrl.trim()) {
    bubble.hero = {
      type: 'image',
      url: input.heroImageUrl.trim(),
      size: 'full',
      aspectRatio: input.preset === 'cta' ? '20:13' : '16:9',
      aspectMode: 'cover',
    }
  }

  if (input.showButton && input.buttonLabel.trim() && input.buttonUrl.trim()) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: accentColor,
          action: {
            type: 'uri',
            label: input.buttonLabel.trim(),
            uri: input.buttonUrl.trim(),
          },
        },
      ],
      paddingAll: '16px',
    }
  }

  return {
    type: 'flex',
    altText: title,
    contents: bubble as any,
  }
}

export function FlexBuilderWorkspace() {
  const { toast } = useToast()
  const createTemplate = useCreateBroadcastTemplate()

  const [templateName, setTemplateName] = useState('Flex Builder Draft')
  const [categoryLabel, setCategoryLabel] = useState('flex-builder')
  const [preset, setPreset] = useState<FlexPreset>('announcement')
  const [title, setTitle] = useState('โปรโมชันพิเศษสำหรับคุณ')
  const [body, setBody] = useState('กดดูรายละเอียดเพิ่มเติมหรือทักกลับมาได้เลย')
  const [footer, setFooter] = useState('ข้อเสนอมีเวลาจำกัด')
  const [buttonLabel, setButtonLabel] = useState('ดูรายละเอียด')
  const [buttonUrl, setButtonUrl] = useState('https://www.cnypharmacy.com')
  const [heroImageUrl, setHeroImageUrl] = useState('')
  const [accentColor, setAccentColor] = useState('#06C755')
  const [showButton, setShowButton] = useState(true)
  const [rawJson, setRawJson] = useState('')
  const [rawMode, setRawMode] = useState(false)

  const visualFlex = useMemo(
    () => buildFlexMessage({
      title,
      body,
      footer,
      buttonLabel,
      buttonUrl,
      heroImageUrl,
      accentColor,
      showButton,
      preset,
    }),
    [title, body, footer, buttonLabel, buttonUrl, heroImageUrl, accentColor, showButton, preset]
  )

  useEffect(() => {
    if (!rawMode) {
      setRawJson(JSON.stringify(visualFlex, null, 2))
    }
  }, [visualFlex, rawMode])

  const parsedFlex = useMemo(() => {
    try {
      const parsed = JSON.parse(rawJson || '{}') as FlexMessage
      if (!parsed || typeof parsed !== 'object') return null
      return parsed
    } catch {
      return null
    }
  }, [rawJson])

  const activeFlex = rawMode ? parsedFlex : visualFlex

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast({ title: 'กรอกชื่อ template ก่อน', variant: 'destructive' })
      return
    }

    if (!activeFlex) {
      toast({ title: 'Flex JSON ไม่ถูกต้อง', variant: 'destructive' })
      return
    }

    try {
      await createTemplate.mutateAsync({
        name: templateName.trim(),
        templateType: 'flex',
        categoryLabel: categoryLabel.trim() || 'flex-builder',
        flexContent: activeFlex,
      })

      toast({ title: 'บันทึก Flex template สำเร็จ' })
    } catch (error) {
      toast({
        title: 'บันทึก Flex template ไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      })
    }
  }

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(rawJson)
      toast({ title: 'คัดลอก Flex JSON แล้ว' })
    } catch {
      toast({ title: 'คัดลอกไม่สำเร็จ', variant: 'destructive' })
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            <CardTitle>Builder</CardTitle>
          </div>
          <CardDescription>
            visual builder ขั้นต้น: preset + form controls + raw JSON editor ในหน้าเดียว
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>ชื่อ template</Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="ชื่อ template" />
            </div>
            <div className="space-y-2">
              <Label>หมวดหมู่</Label>
              <Input value={categoryLabel} onChange={(e) => setCategoryLabel(e.target.value)} placeholder="เช่น promotion-flex" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Preset</Label>
            <Select value={preset} onValueChange={(value) => setPreset(value as FlexPreset)}>
              <SelectTrigger>
                <SelectValue placeholder="เลือก preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="announcement">Announcement</SelectItem>
                <SelectItem value="promo">Promo</SelectItem>
                <SelectItem value="cta">CTA Focus</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{presetDescriptions[preset]}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>หัวข้อ</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="หัวข้อในการ์ด" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>รายละเอียด</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="รายละเอียดข้อความ" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>ข้อความท้าย</Label>
              <Input value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="footer / note" />
            </div>
            <div className="space-y-2">
              <Label>Accent color</Label>
              <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} placeholder="#06C755" />
            </div>
            <div className="space-y-2">
              <Label>Hero image URL</Label>
              <Input value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className="rounded-xl border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>แสดงปุ่ม CTA</Label>
                <p className="text-xs text-muted-foreground">เปิด/ปิด footer button ใน bubble</p>
              </div>
              <Switch checked={showButton} onCheckedChange={setShowButton} />
            </div>
            {showButton && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>ข้อความบนปุ่ม</Label>
                  <Input value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} placeholder="ดูรายละเอียด" />
                </div>
                <div className="space-y-2">
                  <Label>URL ปุ่ม</Label>
                  <Input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Raw JSON mode</Label>
                <p className="text-xs text-muted-foreground">เปิดเพื่อแก้ payload ตรง ๆ เมื่อ visual controls ยังไม่พอ</p>
              </div>
              <Switch checked={rawMode} onCheckedChange={setRawMode} />
            </div>

            <Textarea
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              rows={14}
              className="font-mono text-xs"
              placeholder="Flex JSON"
            />

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleCopyJson}>
                <Copy className="mr-2 h-4 w-4" />
                คัดลอก JSON
              </Button>
              <Button onClick={handleSaveTemplate} disabled={createTemplate.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {createTemplate.isPending ? 'กำลังบันทึก...' : 'บันทึกเป็น template'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-primary" />
            <CardTitle>Preview</CardTitle>
          </div>
          <CardDescription>
            พรีวิวแบบใกล้เคียง LINE มากที่สุดในเฟสนี้ พร้อม badge สถานะของ builder
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>preset: {preset}</Badge>
            <Badge variant="outline">mode: {rawMode ? 'raw-json' : 'visual'}</Badge>
            <Badge variant="secondary">flex v1</Badge>
          </div>

          {activeFlex ? (
            <div className="rounded-2xl bg-gradient-to-br from-[#7494a5] to-[#5a7a8a] p-4">
              <FlexPreview flex={activeFlex} />
            </div>
          ) : (
            <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              Flex JSON ไม่ถูกต้อง — แก้ฝั่งซ้ายก่อน
            </div>
          )}

          <Card className="border-dashed bg-muted/30 shadow-none">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">สถานะ builder รอบนี้</p>
                  <p>
                    Builder v1 เน้นให้ใช้งานได้จริงก่อน: มี visual controls, raw JSON fallback, preview และ save template
                    ส่วน drag & drop เต็มรูปแบบจะเป็นเฟสถัดไป
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
