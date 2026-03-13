"use client"

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Upload, X, FileImage, Loader2, Calendar, DollarSign, FileCheck, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface BdoRecord {
  bdo_id: number
  bdo_name: string | null
  order_id: number
  order_name: string | null
  amount_total: number | null
  payment_method: string | null
  payment_reference: string | null
  qr_data?: string | null
}

interface RecentImage {
  id: number
  url: string | null
  mediaUrl: string | null
  createdAt: string | null
}

interface SlipUploadModalProps {
  open: boolean
  onClose: () => void
  bdo: BdoRecord
  userId: string
  onSuccess: () => void
}

export function SlipUploadModal({ open, onClose, bdo, userId, onSuccess }: SlipUploadModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [recentImages, setRecentImages] = useState<RecentImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [manualFile, setManualFile] = useState<File | null>(null)
  const [manualPreview, setManualPreview] = useState<string | null>(null)
  const [amount, setAmount] = useState(bdo.amount_total?.toString() || '')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10))
  const [uploading, setUploading] = useState(false)

  // Fetch recent images when modal opens
  useEffect(() => {
    if (!open) return
    setSelectedImageId(null)
    setSelectedImageUrl(null)
    setManualFile(null)
    setManualPreview(null)
    setAmount(bdo.amount_total?.toString() || '')
    setTransferDate(new Date().toISOString().slice(0, 10))

    setLoadingImages(true)
    fetch(`/api/inbox/customers/${userId}/recent-images`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.images) {
          setRecentImages(json.data.images)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingImages(false))
  }, [open, userId, bdo.amount_total])

  const hasSelection = !!selectedImageId || !!manualFile

  const selectInboxImage = (img: RecentImage) => {
    setManualFile(null)
    setManualPreview(null)
    setSelectedImageId(img.id)
    setSelectedImageUrl(img.url)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setSelectedImageId(null)
    setSelectedImageUrl(null)
    setManualFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setManualPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const clearManual = () => {
    setManualFile(null)
    setManualPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!hasSelection) {
      toast({ title: 'กรุณาเลือกรูปสลิป', variant: 'destructive' })
      return
    }

    setUploading(true)
    try {
      if (selectedImageId) {
        // Use inbox image — forward via forward-slip-odoo (has messageId)
        const res = await fetch('/api/inbox/forward-slip-odoo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: selectedImageId,
            userId: Number(userId),
            amount: amount ? parseFloat(amount) : undefined,
            transferDate: transferDate || undefined,
            bdoId: bdo.bdo_id,
          }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'บันทึกสลิปไม่สำเร็จ')
        }
      } else if (manualFile) {
        // Upload manual file first
        const formData = new FormData()
        formData.append('file', manualFile)
        formData.append('type', 'image')

        const uploadRes = await fetch('/api/inbox/upload', {
          method: 'POST',
          body: formData,
        })
        const uploadJson = await uploadRes.json()

        const imageUrl = uploadJson.url || uploadJson.data?.url || ''
        if (!imageUrl) {
          throw new Error('อัปโหลดรูปสำเร็จแต่ไม่พบ URL ของไฟล์')
        }

        // Forward uploaded image to PHP slip upload + explicit BDO match
        const res = await fetch('/api/inbox/forward-slip-odoo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: Number(userId),
            imageUrl,
            amount: amount ? parseFloat(amount) : undefined,
            transferDate: transferDate || undefined,
            bdoId: bdo.bdo_id,
          }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'บันทึกสลิปไม่สำเร็จ')
        }
      }

      toast({
        title: 'บันทึกสลิปเรียบร้อย',
        description: `แนบสลิปให้ ${bdo.bdo_name || 'BDO-' + bdo.bdo_id} สำเร็จ`,
      })
      onSuccess()
    } catch (err) {
      toast({
        title: 'บันทึกสลิปไม่สำเร็จ',
        description: err instanceof Error ? err.message : 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const paymentLabel = bdo.payment_method === 'promptpay' ? 'พร้อมเพย์' :
    bdo.payment_method === 'bank_transfer' ? 'โอนเงิน' : bdo.payment_method || '-'

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileCheck className="h-5 w-5 text-teal-600" />
            แนบสลิปการชำระเงิน
          </DialogTitle>
        </DialogHeader>

        {/* BDO Info */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">
              {bdo.bdo_name || `BDO-${bdo.bdo_id}`}
            </span>
            <Badge variant="outline" className="text-xs">
              {paymentLabel}
            </Badge>
          </div>
          {bdo.order_name && (
            <p className="text-xs text-blue-600">{bdo.order_name}</p>
          )}
          <p className="text-lg font-bold text-teal-700">
            ฿{bdo.amount_total?.toLocaleString('th-TH', { minimumFractionDigits: 0 }) || '0'}
          </p>
        </div>

        {/* Recent Images from Inbox */}
        <div>
          <Label className="text-xs text-gray-600 mb-2 block">
            <FileImage className="h-3 w-3 inline mr-1" />
            เลือกรูปจากแชทล่าสุด
          </Label>
          {loadingImages ? (
            <div className="grid grid-cols-4 gap-2">
              {[1,2,3,4].map(i => <Skeleton key={i} className="aspect-[3/4] rounded-lg" />)}
            </div>
          ) : recentImages.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {recentImages.map((img) => {
                const isSelected = selectedImageId === img.id
                const imgUrl = img.url
                if (!imgUrl || (!imgUrl.startsWith('http://') && !imgUrl.startsWith('https://'))) return null
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => selectInboxImage(img)}
                    className={cn(
                      "relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all",
                      isSelected ? "border-teal-500 ring-2 ring-teal-200" : "border-gray-200 hover:border-gray-400"
                    )}
                  >
                    <Image
                      src={imgUrl}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-teal-500/20 flex items-center justify-center">
                        <div className="bg-teal-500 rounded-full p-1">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    )}
                    {img.createdAt && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] text-center py-0.5">
                        {new Date(img.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-3">ไม่มีรูปในแชท</p>
          )}
        </div>

        {/* Manual Upload Fallback */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] text-gray-400">หรือ</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          {!manualPreview ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5 text-gray-500"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3 w-3" />
              อัพโหลดจากเครื่อง
            </Button>
          ) : (
            <div className="relative inline-block">
              <Image
                src={manualPreview}
                alt="สลิป"
                width={120}
                height={90}
                className="h-20 w-auto object-contain rounded-lg border"
                unoptimized
              />
              <button
                type="button"
                onClick={clearManual}
                className="absolute -top-1 -right-1 bg-white rounded-full shadow border p-0.5"
              >
                <X className="h-3 w-3 text-gray-500" />
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Amount & Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="slip-amount" className="text-xs text-gray-600">
              <DollarSign className="h-3 w-3 inline mr-0.5" />
              จำนวนเงิน
            </Label>
            <Input
              id="slip-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="auto-fill"
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="slip-date" className="text-xs text-gray-600">
              <Calendar className="h-3 w-3 inline mr-0.5" />
              วันที่โอน
            </Label>
            <Input
              id="slip-date"
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1 h-9" onClick={onClose} disabled={uploading}>
            ยกเลิก
          </Button>
          <Button
            className="flex-1 h-9 bg-teal-600 hover:bg-teal-700"
            onClick={handleSubmit}
            disabled={!hasSelection || uploading}
          >
            {uploading ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> กำลังบันทึก...</>
            ) : (
              <><Upload className="h-4 w-4 mr-1.5" /> บันทึกสลิป</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
