"use client"

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Upload, X, FileImage, Loader2, CheckCircle2, Calendar, DollarSign, FileCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [amount, setAmount] = useState(bdo.amount_total?.toString() || '')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10))
  const [uploading, setUploading] = useState(false)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (!selected.type.startsWith('image/')) {
      toast({ title: 'ไฟล์ไม่ถูกต้อง', description: 'กรุณาเลือกไฟล์รูปภาพ', variant: 'destructive' })
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast({ title: 'ไฟล์ใหญ่เกินไป', description: 'ขนาดไฟล์ต้องไม่เกิน 10MB', variant: 'destructive' })
      return
    }

    setFile(selected)
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(selected)
  }, [toast])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files?.[0]
    if (!dropped || !dropped.type.startsWith('image/')) return
    setFile(dropped)
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(dropped)
  }, [])

  const handleSubmit = async () => {
    if (!file) {
      toast({ title: 'กรุณาเลือกรูปสลิป', variant: 'destructive' })
      return
    }

    setUploading(true)
    try {
      // 1. Upload image to PHP server
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'image')

      const uploadRes = await fetch('/api/inbox/upload', {
        method: 'POST',
        body: formData,
      })
      const uploadJson = await uploadRes.json()

      let imageUrl = ''
      if (uploadRes.ok && uploadJson.url) {
        imageUrl = uploadJson.url
      } else if (uploadRes.ok && uploadJson.data?.url) {
        imageUrl = uploadJson.data.url
      } else {
        // Fallback: convert to base64 and send directly
        const base64 = preview?.split(',')[1] || ''
        if (!base64) {
          throw new Error('ไม่สามารถอ่านไฟล์ได้')
        }
        // Use forward-slip endpoint with base64 approach via image_url
        imageUrl = preview || ''
      }

      // 2. Forward slip to PHP backend with BDO info
      const body: Record<string, any> = {
        userId: Number(userId),
        messageId: 0, // No message ID for direct upload
        bdoId: bdo.bdo_id,
      }
      if (amount) body.amount = parseFloat(amount)
      if (transferDate) body.transferDate = transferDate

      // Use the odoo-slip-upload PHP endpoint directly via php-bridge proxy
      const phpBase = process.env.NEXT_PUBLIC_PHP_API_URL || ''
      const slipPayload: Record<string, any> = {
        line_user_id: '', // Will be resolved by PHP from userId
        image_url: imageUrl,
        bdo_id: bdo.bdo_id,
        skip_line_notify: true,
        uploaded_by: 'inbox-admin',
      }
      if (amount) slipPayload.amount = parseFloat(amount)
      if (transferDate) slipPayload.transfer_date = transferDate

      const slipRes = await fetch('/api/inbox/forward-slip-odoo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 0,
          userId: Number(userId),
          amount: amount ? parseFloat(amount) : undefined,
          transferDate: transferDate || undefined,
          bdoId: bdo.bdo_id,
        }),
      })

      // If forward-slip requires a real messageId, use direct PHP call instead
      if (!slipRes.ok) {
        const errData = await slipRes.json().catch(() => ({}))
        // Try direct upload approach
        const directRes = await fetch('/api/odoo-dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'attach_slip_to_bdo',
            user_id: userId,
            bdo_id: bdo.bdo_id,
            image_url: imageUrl,
            amount: amount ? parseFloat(amount) : null,
            transfer_date: transferDate || null,
          }),
        })
        const directJson = await directRes.json()
        if (!directJson.success) {
          throw new Error(directJson.error || errData.error || 'บันทึกสลิปไม่สำเร็จ')
        }
      }

      toast({
        title: 'บันทึกสลิปเรียบร้อย',
        description: `แนบสลิปให้ ${bdo.bdo_name || 'BDO-' + bdo.bdo_id} ยอด ฿${amount ? parseFloat(amount).toLocaleString('th-TH') : '-'} สำเร็จ`,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileCheck className="h-5 w-5 text-teal-600" />
            แนบสลิปการชำระเงิน
          </DialogTitle>
        </DialogHeader>

        {/* BDO Info */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
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
          {bdo.payment_reference && (
            <p className="text-xs text-gray-400">
              Ref: {bdo.payment_reference}
            </p>
          )}
        </div>

        {/* File Upload Area */}
        <div className="space-y-3">
          {!preview ? (
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <FileImage className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600 font-medium">เลือกรูปสลิป</p>
              <p className="text-xs text-gray-400 mt-1">ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</p>
              <p className="text-xs text-gray-400">JPG, PNG (ไม่เกิน 10MB)</p>
            </div>
          ) : (
            <div className="relative">
              <Image
                src={preview}
                alt="สลิป"
                width={400}
                height={300}
                className="w-full h-48 object-contain rounded-lg border bg-gray-50"
                unoptimized
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-1 right-1 h-6 w-6 p-0 bg-white/80 hover:bg-white rounded-full shadow"
                onClick={() => {
                  setFile(null)
                  setPreview(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
              >
                <X className="h-3 w-3" />
              </Button>
              <p className="text-xs text-gray-500 mt-1 text-center">{file?.name}</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Amount */}
          <div>
            <Label htmlFor="slip-amount" className="text-xs text-gray-600">
              <DollarSign className="h-3 w-3 inline mr-1" />
              จำนวนเงิน (บาท)
            </Label>
            <Input
              id="slip-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="เช่น 69040.00"
              className="mt-1"
            />
          </div>

          {/* Transfer Date */}
          <div>
            <Label htmlFor="slip-date" className="text-xs text-gray-600">
              <Calendar className="h-3 w-3 inline mr-1" />
              วันที่โอน
            </Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="slip-date"
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs shrink-0"
                onClick={() => setTransferDate(new Date().toISOString().slice(0, 10))}
              >
                วันนี้
              </Button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={uploading}
          >
            ยกเลิก
          </Button>
          <Button
            className="flex-1 bg-teal-600 hover:bg-teal-700"
            onClick={handleSubmit}
            disabled={!file || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                บันทึกสลิป
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
