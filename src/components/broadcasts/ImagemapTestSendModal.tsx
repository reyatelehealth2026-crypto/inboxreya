'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Search, Send, UserCheck, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { ImagemapInput } from '@/lib/imagemap-types'
import type { FlexMessage } from '@/types/broadcast'

interface CustomerOption {
  id: number
  displayName: string
  pictureUrl: string | null
  lineUserId: string
}

interface ImagemapTestSendModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imagemap: ImagemapInput | null
  content?: string
  flexContent?: FlexMessage | null
  /** Flex-only test (no imagemap): the flex messages to push as-is. */
  flexContents?: unknown[] | null
}

export function ImagemapTestSendModal({
  open,
  onOpenChange,
  imagemap,
  content,
  flexContent,
  flexContents,
}: ImagemapTestSendModalProps) {
  const hasPayload = Boolean(imagemap) || Boolean(flexContents?.length)
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Search customers via conversations API
  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setSelectedCustomer(null)
      setCustomers([])
      setError(null)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('limit', '15')
        if (searchQuery.trim()) {
          params.set('search', searchQuery.trim())
        }
        const res = await fetch(`/api/inbox/conversations?${params.toString()}`)
        if (!res.ok) throw new Error('ไม่สามารถค้นหารายชื่อลูกค้าได้')
        const json = await res.json()
        const rawList = Array.isArray(json?.data) ? json.data : []
        const parsed: CustomerOption[] = rawList
          .map((item: any) => {
            const u = item.user
            if (!u || !u.lineUserId) return null
            return {
              id: Number(u.id),
              displayName: u.displayName || u.realName || 'ไม่ระบุชื่อ',
              pictureUrl: u.pictureUrl || null,
              lineUserId: u.lineUserId,
            }
          })
          .filter((c: CustomerOption | null): c is CustomerOption => c !== null && Number.isFinite(c.id))

        setCustomers(parsed)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการค้นหา')
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [open, searchQuery])

  const handleSendTest = async () => {
    if (!selectedCustomer) {
      toast({ title: 'กรุณาเลือกลูกค้าที่จะรับข้อความทดสอบ', variant: 'destructive' })
      return
    }
    if (!hasPayload) {
      toast({ title: 'ข้อมูลข้อความยังไม่สมบูรณ์', variant: 'destructive' })
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/inbox/broadcasts/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          imagemap: imagemap || undefined,
          content: content?.trim() || undefined,
          flexContent: flexContent || undefined,
          flexContents: imagemap ? undefined : flexContents || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ส่งข้อความทดสอบไม่สำเร็จ')
      }

      toast({
        title: 'ส่งข้อความทดสอบสำเร็จ',
        description: `ส่งไปยัง ${selectedCustomer.displayName} เรียบร้อยแล้ว`,
      })
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'ส่งข้อความทดสอบล้มเหลว',
        description: err instanceof Error ? err.message : 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            ส่งทดสอบหาตัวเอง (หรือบัญชีทดสอบ)
          </DialogTitle>
          <DialogDescription>
            เลือกลูกค้าในระบบที่ต้องการให้ LINE ยิงข้อความ{imagemap ? ' Imagemap' : ''} ไปทดสอบ (ลิงก์จะไม่ถูกแปลงเป็น tracking)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อลูกค้าหรือเบอร์โทร..."
              className="pl-9"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 rounded-md border p-1">
            {loading ? (
              <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังค้นหา...
              </div>
            ) : error ? (
              <div className="flex items-center justify-center p-4 text-xs text-destructive">
                <AlertCircle className="mr-1 h-3.5 w-3.5" /> {error}
              </div>
            ) : customers.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                ไม่พบลูกค้ารายนี้ในระบบ
              </div>
            ) : (
              customers.map((c) => {
                const isSelected = selectedCustomer?.id === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCustomer(c)}
                    className={`w-full flex items-center justify-between p-2 rounded-md text-left transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border border-primary/30 text-primary'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={c.pictureUrl || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {c.displayName.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate font-medium">{c.displayName}</span>
                    </div>
                    {isSelected && <UserCheck className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                )
              })
            )}
          </div>

          {selectedCustomer && (
            <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground flex items-center justify-between">
              <span>ผู้รับทดสอบ: <strong>{selectedCustomer.displayName}</strong></span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setSelectedCustomer(null)}
              >
                เปลี่ยน
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSendTest}
            disabled={!selectedCustomer || !hasPayload || sending}
            className="gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            ส่งทดสอบ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
