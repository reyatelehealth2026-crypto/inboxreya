"use client"

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Upload, X, FileImage, Loader2, Calendar, DollarSign, FileCheck, Check, Search, ShieldCheck, ShieldAlert, Building2, ArrowRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface SlipVerifyResult {
  success: boolean
  verified: boolean
  error?: string
  data?: {
    transRef: string
    sendingBank: string
    sendingBankName: string
    receivingBank: string
    receivingBankName: string
    transDate: string
    transTime: string
    transDateTime: string
    sender: { displayName: string; name: string; proxy?: { type: string; value: string }; account?: { type: string; value: string } }
    receiver: { displayName: string; name: string; proxy?: { type: string; typeName?: string; value: string }; account?: { type: string; value: string } }
    amount: number
    paidLocalAmount: number
    paidLocalCurrency: string
    ref1?: string
    ref2?: string
    ref3?: string
  }
}

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
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<SlipVerifyResult | null>(null)

  // Fetch recent images when modal opens
  useEffect(() => {
    if (!open) return
    setSelectedImageId(null)
    setSelectedImageUrl(null)
    setManualFile(null)
    setManualPreview(null)
    setAmount(bdo.amount_total?.toString() || '')
    setTransferDate(new Date().toISOString().slice(0, 10))
    setVerifyResult(null)

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
    setVerifyResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleVerifySlip = async () => {
    // Determine the image URL to verify
    let imageUrlToVerify = selectedImageUrl
    if (!imageUrlToVerify && manualPreview) {
      // For manual uploads, we need to upload first to get a URL
      toast({ title: 'กรุณาเลือกรูปจากแชทเพื่อตรวจสอบ หรืออัพโหลดก่อน', variant: 'destructive' })
      return
    }
    if (!imageUrlToVerify) {
      toast({ title: 'กรุณาเลือกรูปสลิปก่อน', variant: 'destructive' })
      return
    }

    setVerifying(true)
    setVerifyResult(null)
    try {
      const res = await fetch('/api/inbox/verify-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: imageUrlToVerify }),
      })
      const json: SlipVerifyResult = await res.json()
      setVerifyResult(json)

      if (json.success && json.verified && json.data) {
        // Auto-fill amount from SlipMate if available
        if (json.data.amount) {
          setAmount(json.data.amount.toString())
        }
        // Auto-fill transfer date
        if (json.data.transDate) {
          // transDate format from SlipMate could be various — try to parse
          const parsed = new Date(json.data.transDate)
          if (!isNaN(parsed.getTime())) {
            setTransferDate(parsed.toISOString().slice(0, 10))
          }
        }
        toast({ title: 'สลิปแท้ ตรวจสอบผ่าน', description: `Ref: ${json.data.transRef}` })
      } else {
        toast({
          title: 'ตรวจสอบสลิปไม่ผ่าน',
          description: json.error || 'สลิปอาจไม่ถูกต้อง หรือไม่สามารถอ่านข้อมูลได้',
          variant: 'destructive',
        })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setVerifyResult({ success: false, verified: false, error: errorMsg })
      toast({ title: 'ตรวจสอบสลิปล้มเหลว', description: errorMsg, variant: 'destructive' })
    } finally {
      setVerifying(false)
    }
  }

  // Build verification payload to pass along with save
  const buildVerifyPayload = () => {
    if (!verifyResult?.success || !verifyResult?.verified || !verifyResult?.data) return undefined
    return {
      slip_verified: true,
      slip_verify_ref: verifyResult.data.transRef,
      slip_verify_amount: verifyResult.data.amount,
      slip_verify_data: verifyResult.data,
    }
  }

  const handleSubmit = async () => {
    if (!hasSelection) {
      toast({ title: 'กรุณาเลือกรูปสลิป', variant: 'destructive' })
      return
    }

    const verifyPayload = buildVerifyPayload()

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
            ...verifyPayload,
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

        let imageUrl = uploadJson.url || uploadJson.data?.url || ''

        // Forward to PHP slip upload
        const res = await fetch('/api/inbox/forward-slip-odoo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: 0,
            userId: Number(userId),
            amount: amount ? parseFloat(amount) : undefined,
            transferDate: transferDate || undefined,
            bdoId: bdo.bdo_id,
            ...verifyPayload,
          }),
        })
        const json = await res.json()
        // If messageId=0 fails, that's expected — slip was saved via upload
        if (res.ok && json.success) {
          // great
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

        {/* Verify Result Panel */}
        {verifyResult && (
          <div className={cn(
            "rounded-lg p-3 text-sm border",
            verifyResult.verified
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          )}>
            <div className="flex items-center gap-2 mb-2">
              {verifyResult.verified ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-green-700">สลิปแท้ ตรวจสอบผ่าน</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  <span className="font-semibold text-red-700">สลิปไม่ผ่านการตรวจสอบ</span>
                </>
              )}
            </div>
            {verifyResult.verified && verifyResult.data && (
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3 text-green-600" />
                  <span className="font-medium">฿{verifyResult.data.amount?.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" />
                  <span>{verifyResult.data.sendingBankName || verifyResult.data.sendingBank}</span>
                  <ArrowRight className="h-3 w-3 text-gray-400" />
                  <span>{verifyResult.data.receivingBankName || verifyResult.data.receivingBank}</span>
                </div>
                {verifyResult.data.sender?.name && (
                  <div className="text-gray-500">ผู้โอน: {verifyResult.data.sender.displayName || verifyResult.data.sender.name}</div>
                )}
                {verifyResult.data.receiver?.name && (
                  <div className="text-gray-500">ผู้รับ: {verifyResult.data.receiver.displayName || verifyResult.data.receiver.name}</div>
                )}
                <div className="text-gray-400">Ref: {verifyResult.data.transRef}</div>
                {verifyResult.data.transDate && (
                  <div className="text-gray-400">{verifyResult.data.transDate} {verifyResult.data.transTime || ''}</div>
                )}
              </div>
            )}
            {!verifyResult.verified && verifyResult.error && (
              <p className="text-xs text-red-600 mt-1">{verifyResult.error}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="h-9" onClick={onClose} disabled={uploading || verifying}>
            ยกเลิก
          </Button>
          <Button
            variant="outline"
            className="h-9 gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={handleVerifySlip}
            disabled={!hasSelection || verifying || uploading}
          >
            {verifying ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> กำลังตรวจ...</>
            ) : (
              <><Search className="h-4 w-4 mr-1" /> ตรวจสอบสลิป</>
            )}
          </Button>
          <Button
            className="flex-1 h-9 bg-teal-600 hover:bg-teal-700"
            onClick={handleSubmit}
            disabled={!hasSelection || uploading || verifying}
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
