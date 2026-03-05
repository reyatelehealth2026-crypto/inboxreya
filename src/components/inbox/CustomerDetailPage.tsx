"use client"

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  MessageCircle,
  History,
  ShoppingBag,
  FileText,
  Building2,
  Save,
  X,
  Clock,
  CreditCard,
} from 'lucide-react'
import { useCustomerProfile, useUpdateCustomerProfile } from '@/hooks/use-customer-profile'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn, getInitials } from '@/lib/utils'
import { LineInfoSection } from './LineInfoSection'
import { ActivityHistorySection } from './ActivityHistorySection'
import { OdooPartnerSection } from './OdooPartnerSection'
import { OdooOrdersSection } from './OdooOrdersSection'
import { OdooInvoicesSection } from './OdooInvoicesSection'
import { OdooSlipsSection } from './OdooSlipsSection'
import { OdooCreditCard } from './OdooCreditCard'
import { OdooOrderTimeline } from './OdooOrderTimeline'
import { Customer360Section } from './Customer360Section'
import type { LineUser } from '@/types'

interface CustomerDetailPageProps {
  userId: string
}

type ContactDraft = {
  displayName: string
  realName: string
  memberId: string
  phone: string
  email: string
  birthday: string
  gender: string
  address: string
  district: string
  province: string
  postalCode: string
  note: string
}

export function CustomerDetailPage({ userId }: CustomerDetailPageProps) {
  const { data: profile, isLoading } = useCustomerProfile(userId)
  const updateProfile = useUpdateCustomerProfile()
  const { toast } = useToast()

  const [isEditing, setIsEditing] = useState(false)
  const [contactDraft, setContactDraft] = useState<ContactDraft>({
    displayName: '',
    realName: '',
    memberId: '',
    phone: '',
    email: '',
    birthday: '',
    gender: '',
    address: '',
    district: '',
    province: '',
    postalCode: '',
    note: '',
  })

  if (isLoading) {
    return <CustomerDetailPageSkeleton />
  }

  if (!profile) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">ไม่พบข้อมูลลูกค้า</p>
          <Link href="/inbox">
            <Button variant="link" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              กลับไปหน้า Inbox
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const { user } = profile

  const handleEditClick = () => {
    setContactDraft({
      displayName: user.displayName || '',
      realName: user.realName || '',
      memberId: user.memberId || '',
      phone: user.phone || '',
      email: user.email || '',
      birthday: user.birthday || '',
      gender: user.gender || '',
      address: user.address || '',
      district: user.district || '',
      province: user.province || '',
      postalCode: user.postalCode || '',
      note: user.note || '',
    })
    setIsEditing(true)
  }

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        userId,
        ...contactDraft,
      })
      toast({
        title: 'บันทึกสำเร็จ',
        description: 'อัพเดทข้อมูลลูกค้าเรียบร้อยแล้ว',
      })
      setIsEditing(false)
    } catch (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกข้อมูลได้',
        variant: 'destructive',
      })
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/inbox">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  กลับ
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.pictureUrl || undefined} />
                  <AvatarFallback>{getInitials(user.displayName || 'User')}</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-lg font-semibold">{user.displayName || 'ไม่มีชื่อ'}</h1>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {user.tier || 'Standard'}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {user.points || 0} แต้ม
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {!isEditing && (
              <Button onClick={handleEditClick} size="sm">
                แก้ไขข้อมูล
              </Button>
            )}
            {isEditing && (
              <div className="flex gap-2">
                <Button onClick={handleCancel} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  ยกเลิก
                </Button>
                <Button onClick={handleSave} size="sm" disabled={updateProfile.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateProfile.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold">ข้อมูลติดต่อ</h2>
              </div>

              {!isEditing ? (
                <ContactInfoDisplay user={user} />
              ) : (
                <ContactInfoForm
                  draft={contactDraft}
                  onChange={setContactDraft}
                />
              )}
            </Card>

            {/* LINE Information */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold">ข้อมูล LINE</h2>
              </div>
              <LineInfoSection user={user} />
            </Card>

            {/* Activity History */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold">ประวัติการแก้ไข</h2>
              </div>
              <ActivityHistorySection userId={userId} />
            </Card>
          </div>

          {/* Right Column - ERP Integration */}
          <div className="space-y-6">
            {/* Odoo Partner Info */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-gray-600" />
                <h2 className="text-base font-semibold">ข้อมูล ERP</h2>
              </div>
              <OdooPartnerSection userId={userId} memberId={user.memberId} />
            </Card>

            {/* Odoo Orders */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBag className="h-5 w-5 text-gray-600" />
                <h2 className="text-base font-semibold">คำสั่งซื้อ (Odoo)</h2>
              </div>
              <OdooOrdersSection userId={userId} memberId={user.memberId} />
            </Card>

            {/* Odoo Invoices */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-gray-600" />
                <h2 className="text-base font-semibold">ใบแจ้งหนี้ (Odoo)</h2>
              </div>
              <OdooInvoicesSection userId={userId} memberId={user.memberId} />
            </Card>

            {/* Payment Slips */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-gray-600" />
                <h2 className="text-base font-semibold">สลิปการชำระเงิน</h2>
              </div>
              <OdooSlipsSection userId={userId} />
            </Card>

            {/* Customer 360 - Credit & Timeline */}
            <Customer360Section userId={userId} lineUserId={user.lineUserId} memberId={user.memberId} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactInfoDisplay({ user }: { user: LineUser }) {
  return (
    <div className="space-y-3">
      <InfoField label="ชื่อที่แสดง" value={user.displayName} icon={User} />
      <InfoField label="ชื่อจริง" value={user.realName} icon={User} />
      <InfoField label="เลขสมาชิก" value={user.memberId} icon={FileText} />
      <InfoField label="เบอร์โทร" value={user.phone} icon={Phone} />
      <InfoField label="อีเมล" value={user.email} icon={Mail} />
      <InfoField label="วันเกิด" value={user.birthday} icon={Calendar} />
      <InfoField label="เพศ" value={user.gender} icon={User} />
      <InfoField label="ที่อยู่" value={user.address} icon={MapPin} />
      <InfoField label="เขต/อำเภอ" value={user.district} icon={MapPin} />
      <InfoField label="จังหวัด" value={user.province} icon={MapPin} />
      <InfoField label="รหัสไปรษณีย์" value={user.postalCode} icon={MapPin} />
      <InfoField label="หมายเหตุ" value={user.note} multiline />
    </div>
  )
}

function InfoField({ label, value, icon: Icon, multiline }: { label: string; value: string | null | undefined; icon?: any; multiline?: boolean }) {
  if (!value) return null

  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className={cn("text-sm text-gray-900", multiline && "whitespace-pre-wrap")}>{value}</p>
      </div>
    </div>
  )
}

function ContactInfoForm({
  draft,
  onChange,
}: {
  draft: ContactDraft
  onChange: (draft: ContactDraft) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="displayName">ชื่อที่แสดง</Label>
          <Input
            id="displayName"
            value={draft.displayName}
            onChange={(e) => onChange({ ...draft, displayName: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="realName">ชื่อจริง</Label>
          <Input
            id="realName"
            value={draft.realName}
            onChange={(e) => onChange({ ...draft, realName: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="memberId">เลขสมาชิก</Label>
          <Input
            id="memberId"
            value={draft.memberId}
            onChange={(e) => onChange({ ...draft, memberId: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="phone">เบอร์โทร</Label>
          <Input
            id="phone"
            type="tel"
            value={draft.phone}
            onChange={(e) => onChange({ ...draft, phone: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">อีเมล</Label>
          <Input
            id="email"
            type="email"
            value={draft.email}
            onChange={(e) => onChange({ ...draft, email: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="birthday">วันเกิด</Label>
          <Input
            id="birthday"
            type="date"
            value={draft.birthday}
            onChange={(e) => onChange({ ...draft, birthday: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="gender">เพศ</Label>
        <Select value={draft.gender} onValueChange={(value) => onChange({ ...draft, gender: value })}>
          <SelectTrigger id="gender">
            <SelectValue placeholder="เลือกเพศ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">ชาย</SelectItem>
            <SelectItem value="female">หญิง</SelectItem>
            <SelectItem value="other">อื่นๆ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="address">ที่อยู่</Label>
        <Textarea
          id="address"
          value={draft.address}
          onChange={(e) => onChange({ ...draft, address: e.target.value })}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="district">เขต/อำเภอ</Label>
          <Input
            id="district"
            value={draft.district}
            onChange={(e) => onChange({ ...draft, district: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="province">จังหวัด</Label>
          <Input
            id="province"
            value={draft.province}
            onChange={(e) => onChange({ ...draft, province: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="postalCode">รหัสไปรษณีย์</Label>
          <Input
            id="postalCode"
            value={draft.postalCode}
            onChange={(e) => onChange({ ...draft, postalCode: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="note">หมายเหตุ</Label>
        <Textarea
          id="note"
          value={draft.note}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  )
}

function CustomerDetailPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <Skeleton className="h-10 w-64" />
        </div>
      </div>
      <div className="container max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-64" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    </div>
  )
}
