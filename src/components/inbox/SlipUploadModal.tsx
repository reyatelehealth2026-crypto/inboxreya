"use client"

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Upload, X, FileImage, Loader2, Calendar, DollarSign, FileCheck, Check, Search, ShieldCheck, ShieldAlert, Building2, ArrowRight, Gift, SendHorizonal } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface SlipVerifyResult {
  success: boolean
  verified: boolean
  error?: string
  warnings?: Array<{ type: string; message: string }>
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
    transFeeAmount?: number
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
  amount_net_to_pay?: number | null
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
  customerName?: string | null
  customerAvatar?: string | null
  customerId?: string | null
  onSuccess: () => void
}

// Bank code → Thai name + brand color
const BANK_MAP: Record<string, { name: string; color: string; abbr: string }> = {
  '014': { name: 'ธนาคารไทยพาณิชย์', color: '#4E2A82', abbr: 'SCB' },
  '004': { name: 'ธนาคารกสิกรไทย', color: '#138F2D', abbr: 'KBANK' },
  '002': { name: 'ธนาคารกรุงเทพ', color: '#1E4598', abbr: 'BBL' },
  '006': { name: 'ธนาคารกรุงไทย', color: '#1BA5E0', abbr: 'KTB' },
  '025': { name: 'ธนาคารกรุงศรีอยุธยา', color: '#FEC43B', abbr: 'BAY' },
  '011': { name: 'ธนาคารทหารไทยธนชาต', color: '#1279BE', abbr: 'TTB' },
  '069': { name: 'ธนาคารเกียรตินาคินภัทร', color: '#199078', abbr: 'KKP' },
  '022': { name: 'ธนาคาร ซีไอเอ็มบี ไทย', color: '#EC1C24', abbr: 'CIMB' },
  '067': { name: 'ธนาคารทิสโก้', color: '#12549F', abbr: 'TISCO' },
  '024': { name: 'ธนาคารยูโอบี', color: '#0B3979', abbr: 'UOB' },
  '071': { name: 'ธนาคารไอซีบีซี', color: '#C8161D', abbr: 'ICBC' },
  '073': { name: 'ธนาคารแลนด์ แอนด์ เฮ้าส์', color: '#6D6E71', abbr: 'LHFG' },
  '030': { name: 'ธนาคารออมสิน', color: '#EB198D', abbr: 'GSB' },
  '034': { name: 'ธนาคารเพื่อการเกษตร', color: '#4B9B1D', abbr: 'BAAC' },
  '035': { name: 'ธนาคารอาคารสงเคราะห์', color: '#F68B1F', abbr: 'GHB' },
}

function getBankInfo(code: string | undefined, fallbackName: string | undefined) {
  if (code && BANK_MAP[code]) return BANK_MAP[code]
  // Try matching by name
  if (fallbackName) {
    const lower = fallbackName.toLowerCase()
    if (lower.includes('ไทยพาณิชย์') || lower.includes('scb')) return BANK_MAP['014']
    if (lower.includes('กสิกร') || lower.includes('kbank')) return BANK_MAP['004']
    if (lower.includes('กรุงเทพ') || lower.includes('bbl') || lower.includes('bangkok bank')) return BANK_MAP['002']
    if (lower.includes('กรุงไทย') || lower.includes('ktb')) return BANK_MAP['006']
    if (lower.includes('กรุงศรี') || lower.includes('bay') || lower.includes('ayudhya')) return BANK_MAP['025']
    if (lower.includes('ทหารไทย') || lower.includes('ttb') || lower.includes('tmb')) return BANK_MAP['011']
    if (lower.includes('ออมสิน') || lower.includes('gsb')) return BANK_MAP['030']
    if (lower.includes('เกษตร') || lower.includes('baac')) return BANK_MAP['034']
  }
  return { name: fallbackName || 'ธนาคาร', color: '#6B7280', abbr: '?' }
}

const POINTS_RATE = 1000 // 1,000 ฿ = 1 point

export function SlipUploadModal({ open, onClose, bdo, userId, customerName, customerAvatar, customerId, onSuccess }: SlipUploadModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [recentImages, setRecentImages] = useState<RecentImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [manualFile, setManualFile] = useState<File | null>(null)
  const [manualPreview, setManualPreview] = useState<string | null>(null)
  const displayBdoAmount = bdo.amount_net_to_pay ?? bdo.amount_total
  const [amount, setAmount] = useState(displayBdoAmount?.toString() || '')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10))
  const [uploading, setUploading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<SlipVerifyResult | null>(null)
  const [sendToCustomer, setSendToCustomer] = useState(true)

  // Fetch recent images when modal opens
  useEffect(() => {
    if (!open) return
    setSelectedImageId(null)
    setSelectedImageUrl(null)
    setManualFile(null)
    setManualPreview(null)
    setAmount((bdo.amount_net_to_pay ?? bdo.amount_total)?.toString() || '')
    setTransferDate(new Date().toISOString().slice(0, 10))
    setVerifyResult(null)
    setSendToCustomer(true)

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
  }, [open, userId, bdo.amount_net_to_pay, bdo.amount_total])

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
        
        // Show warnings if receiver doesn't match company account
        if (json.warnings && json.warnings.length > 0) {
          json.warnings.forEach((w: { type: string; message: string }) => {
            toast({
              title: 'คำเตือน',
              description: w.message,
              variant: 'destructive',
            })
          })
        } else {
          toast({ title: 'สลิปแท้ ตรวจสอบผ่าน', description: `Ref: ${json.data.transRef}` })
        }
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
            ...verifyPayload,
          }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'บันทึกสลิปไม่สำเร็จ')
        }
      }

      // Points recording (if slip is verified)
      let earnedPoints = 0
      if (verifyResult?.verified && verifyResult?.data?.amount) {
        earnedPoints = Math.floor(verifyResult.data.amount / POINTS_RATE)
        if (earnedPoints > 0) {
          try {
            await fetch(`/api/customers/${userId}/points/adjust`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                points: earnedPoints,
                reason: `แต้มจากสลิป ${bdo.bdo_name || 'BDO-' + bdo.bdo_id} (฿${verifyResult.data.amount.toLocaleString()})`,
                type: 'earn',
              }),
            })
          } catch {
            // Points recording failure should not block slip save
            console.error('Failed to record points')
          }
        }
      }

      // Send Flex notification to LINE (if checkbox enabled + slip verified)
      if (sendToCustomer && verifyResult?.verified && verifyResult?.data) {
        try {
          await fetch('/api/inbox/slip-verify-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: Number(userId),
              verifyData: verifyResult.data,
              points: earnedPoints,
              bdoName: bdo.bdo_name || 'BDO-' + bdo.bdo_id,
              customerName: customerName || null,
            }),
          })
        } catch {
          console.error('Failed to send LINE notification')
        }
      }

      const pointsMsg = earnedPoints > 0 ? ` (+${earnedPoints} แต้ม)` : ''
      toast({
        title: 'บันทึกสลิปเรียบร้อย',
        description: `แนบสลิปให้ ${bdo.bdo_name || 'BDO-' + bdo.bdo_id} สำเร็จ${pointsMsg}`,
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
            ฿{(bdo.amount_net_to_pay ?? bdo.amount_total)?.toLocaleString('th-TH', { minimumFractionDigits: 0 }) || '0'}
          </p>
        </div>

        {/* Recent Images from Inbox */}
        <div>
          <Label className="text-xs text-gray-600 mb-2 block">
            <FileImage className="h-3 w-3 inline mr-1" />
            เลือกรูปจากแชทล่าสุด
          </Label>
          {loadingImages ? (
            <div className="grid grid-cols-5 gap-2">
              {[1,2,3,4,5,6,7,8,9,10].map(i => <Skeleton key={i} className="w-full aspect-square rounded-lg" />)}
            </div>
          ) : recentImages.length > 0 ? (
            <div className="grid grid-cols-5 gap-2">
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
                      "relative w-full aspect-square rounded-lg overflow-hidden border-2 transition-all",
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
          <>
            {verifyResult.verified && verifyResult.data ? (() => {
              const d = verifyResult.data
              const senderBank = getBankInfo(d.sendingBank, d.sendingBankName)
              const receiverBank = getBankInfo(d.receivingBank, d.receivingBankName)
              const earnedPoints = Math.floor((d.amount || 0) / POINTS_RATE)
              const transDateDisplay = d.transDate
                ? (() => {
                    try {
                      const parsed = new Date(d.transDate)
                      if (!isNaN(parsed.getTime())) {
                        return parsed.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
                      }
                    } catch {}
                    return d.transDate
                  })()
                : null

              return (
                <div className="space-y-3">
                  {/* Green header — สลิปถูกต้อง */}
                  <div className="rounded-xl overflow-hidden border border-green-200">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3 flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-white" />
                      <span className="font-bold text-white text-sm">สลิปถูกต้อง</span>
                    </div>
                    <div className="bg-white px-4 py-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        ฿{d.amount?.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                        <span>วันที่-เวลา</span>
                        <span className="text-gray-700 font-medium">
                          {transDateDisplay}{d.transTime ? `, ${d.transTime}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bank Transfer Card — Flex style */}
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">รายการตรวจสอบล่าสุด</p>
                    </div>
                    <div className="px-3 py-3">
                      {/* Sender */}
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: senderBank.color }}
                        >
                          {senderBank.abbr}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800">{senderBank.name}</p>
                          <p className="text-[11px] text-gray-600 truncate">
                            {d.sender?.displayName || d.sender?.name || '-'}
                          </p>
                          {d.sender?.account?.value && (
                            <p className="text-[10px] font-mono text-gray-400">{d.sender.account.value}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-400">
                            {transDateDisplay || ''}
                          </p>
                        </div>
                      </div>

                      {/* Arrow divider */}
                      <div className="flex items-center gap-2 my-2 pl-[18px]">
                        <div className="w-px h-4 bg-gray-200" />
                        <ArrowRight className="h-3 w-3 text-gray-300" />
                      </div>

                      {/* Receiver */}
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: receiverBank.color }}
                        >
                          {receiverBank.abbr}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800">{receiverBank.name}</p>
                          <p className="text-[11px] text-gray-600 truncate">
                            {d.receiver?.displayName || d.receiver?.name || '-'}
                          </p>
                          {d.receiver?.account?.value && (
                            <p className="text-[10px] font-mono text-gray-400">{d.receiver.account.value}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900">
                            {d.amount?.toLocaleString('th-TH', { minimumFractionDigits: 1 })}
                          </p>
                          <p className="text-[10px] text-gray-400">บาท</p>
                        </div>
                      </div>
                    </div>

                    {/* Ref footer */}
                    <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">Ref:</span>
                      <span className="text-[10px] font-mono text-gray-500 truncate ml-1">{d.transRef}</span>
                    </div>
                  </div>

                  {/* Points Preview Card */}
                  {earnedPoints > 0 && (
                    <div className="rounded-xl border border-teal-200 overflow-hidden">
                      <div className="flex items-center gap-3 p-3">
                        {/* Customer avatar */}
                        <div className="flex-shrink-0">
                          {customerAvatar ? (
                            <Image
                              src={customerAvatar}
                              alt=""
                              width={48}
                              height={48}
                              className="w-12 h-12 rounded-full object-cover border-2 border-teal-100"
                              unoptimized
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                              <span className="text-teal-700 font-bold text-base">
                                {(customerName || '?')[0]}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{customerName || 'ลูกค้า'}</p>
                          {customerId && (
                            <p className="text-[10px] text-gray-400">ID: {customerId}</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-0 border-t border-teal-100">
                        <div className="p-2.5 text-center border-r border-teal-100">
                          <p className="text-[10px] text-gray-500">ยอดซื้อ</p>
                          <p className="text-base font-bold text-gray-800">
                            {d.amount?.toLocaleString('th-TH', { minimumFractionDigits: 0 })} ฿
                          </p>
                        </div>
                        <div className="p-2.5 text-center bg-teal-50/50">
                          <p className="text-[10px] text-gray-500">ได้รับแต้มสะสม</p>
                          <p className="text-xl font-bold text-teal-600">+{earnedPoints}</p>
                          <p className="text-[10px] text-teal-500">point</p>
                        </div>
                      </div>
                      <div className="px-3 py-1.5 bg-gray-50 border-t border-teal-100 text-center">
                        <p className="text-[10px] text-gray-400">(อัตรา 1,000 ฿ = 1 point)</p>
                      </div>
                    </div>
                  )}

                  {/* Send to customer checkbox */}
                  <div className="flex items-center gap-2 px-1">
                    <Checkbox
                      id="send-to-customer"
                      checked={sendToCustomer}
                      onCheckedChange={(checked) => setSendToCustomer(checked === true)}
                    />
                    <label htmlFor="send-to-customer" className="text-xs text-gray-600 cursor-pointer flex items-center gap-1">
                      <SendHorizonal className="h-3 w-3 text-green-600" />
                      ส่งผลตรวจสลิป{earnedPoints > 0 ? '+แต้ม' : ''}ให้ลูกค้าทาง LINE
                    </label>
                  </div>
                </div>
              )
            })() : (
              <div className="rounded-lg p-3 text-sm border bg-red-50 border-red-200">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  <span className="font-semibold text-red-700">สลิปไม่ผ่านการตรวจสอบ</span>
                </div>
                {verifyResult.error && (
                  <p className="text-xs text-red-600 mt-1">{verifyResult.error}</p>
                )}
              </div>
            )}
          </>
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
