'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FacebookAccount {
  id: string
  name: string
  pageId: string
  appId: string
  appSecret: string
  pageAccessToken: string
  verifyToken: string
  webhookUrl: string | null
  pictureUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface TikTokAccount {
  id: string
  name: string
  shopId: string
  appKey: string
  appSecret: string
  accessToken: string
  refreshToken: string | null
  tokenExpiresAt: string | null
  shopCipher: string | null
  webhookUrl: string | null
  pictureUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const EMPTY_FB: Omit<FacebookAccount, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  pageId: '',
  appId: '',
  appSecret: '',
  pageAccessToken: '',
  verifyToken: '',
  webhookUrl: '',
  pictureUrl: '',
  isActive: true,
}

const EMPTY_TK: Omit<TikTokAccount, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  shopId: '',
  appKey: '',
  appSecret: '',
  accessToken: '',
  refreshToken: '',
  tokenExpiresAt: null,
  shopCipher: '',
  webhookUrl: '',
  pictureUrl: '',
  isActive: true,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-10 font-mono text-sm"
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        onClick={() => setShow((s) => !s)}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="ml-1 text-gray-400 hover:text-blue-600 transition-colors"
      title="คัดลอก"
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

// ─── Facebook Form ─────────────────────────────────────────────────────────────

function FacebookForm({
  data,
  onChange,
  isEdit,
}: {
  data: Omit<FacebookAccount, 'id' | 'createdAt' | 'updatedAt'>
  onChange: (d: Omit<FacebookAccount, 'id' | 'createdAt' | 'updatedAt'>) => void
  isEdit: boolean
}) {
  const set = (key: string, val: string | boolean) => onChange({ ...data, [key]: val })
  const webhookBase = typeof window !== 'undefined' ? `${window.location.origin.replace(':3000', '').replace('localhost', window.location.hostname)}/facebook-webhook.php` : 'https://your-domain.com/facebook-webhook.php'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="fb-name">ชื่อบัญชี <span className="text-red-500">*</span></Label>
          <Input id="fb-name" value={data.name} onChange={(e) => set('name', e.target.value)} placeholder="เช่น ร้านยา ABC Facebook" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb-page-id">Page ID <span className="text-red-500">*</span></Label>
          <Input id="fb-page-id" value={data.pageId} onChange={(e) => set('pageId', e.target.value)} placeholder="123456789012345" className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb-app-id">App ID <span className="text-red-500">*</span></Label>
          <Input id="fb-app-id" value={data.appId} onChange={(e) => set('appId', e.target.value)} placeholder="123456789012345" className="font-mono" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="fb-app-secret">App Secret <span className="text-red-500">*</span></Label>
          <SecretInput id="fb-app-secret" value={data.appSecret} onChange={(v) => set('appSecret', v)} placeholder={isEdit ? 'เว้นว่างไว้หากไม่ต้องการเปลี่ยน' : 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="fb-pat">Page Access Token <span className="text-red-500">*</span></Label>
          <SecretInput id="fb-pat" value={data.pageAccessToken} onChange={(v) => set('pageAccessToken', v)} placeholder={isEdit ? 'เว้นว่างไว้หากไม่ต้องการเปลี่ยน' : 'EAAxxxxxxxxxxxxxxxx...'} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="fb-verify">Verify Token <span className="text-red-500">*</span></Label>
          <Input id="fb-verify" value={data.verifyToken} onChange={(e) => set('verifyToken', e.target.value)} placeholder="my_custom_verify_token_2024" className="font-mono" />
          <p className="text-xs text-gray-500">ตั้งค่าเองได้ ใช้ตรวจสอบ webhook จาก Meta</p>
        </div>
      </div>

      <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 space-y-1">
        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
          <ExternalLink className="h-3 w-3" /> Webhook URL สำหรับตั้งค่าใน Meta App Dashboard
        </p>
        <div className="flex items-center gap-1">
          <code className="text-xs text-blue-600 dark:text-blue-400 break-all">{webhookBase}</code>
          <CopyButton value={webhookBase} />
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400">Subscriptions: <strong>messages, messaging_postbacks</strong></p>
      </div>
    </div>
  )
}

// ─── TikTok Form ───────────────────────────────────────────────────────────────

function TikTokForm({
  data,
  onChange,
  isEdit,
}: {
  data: Omit<TikTokAccount, 'id' | 'createdAt' | 'updatedAt'>
  onChange: (d: Omit<TikTokAccount, 'id' | 'createdAt' | 'updatedAt'>) => void
  isEdit: boolean
}) {
  const set = (key: string, val: string | boolean | null) => onChange({ ...data, [key]: val })
  const webhookBase = typeof window !== 'undefined' ? `${window.location.origin.replace(':3000', '').replace('localhost', window.location.hostname)}/tiktok-webhook.php` : 'https://your-domain.com/tiktok-webhook.php'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="tk-name">ชื่อบัญชี <span className="text-red-500">*</span></Label>
          <Input id="tk-name" value={data.name} onChange={(e) => set('name', e.target.value)} placeholder="เช่น TikTok Shop ร้านยา ABC" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tk-shop-id">Shop ID <span className="text-red-500">*</span></Label>
          <Input id="tk-shop-id" value={data.shopId} onChange={(e) => set('shopId', e.target.value)} placeholder="7xxxxxxxxxxxxxxxxx" className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tk-app-key">App Key <span className="text-red-500">*</span></Label>
          <Input id="tk-app-key" value={data.appKey} onChange={(e) => set('appKey', e.target.value)} placeholder="xxxxxxxxxxxxxxxx" className="font-mono" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="tk-app-secret">App Secret <span className="text-red-500">*</span></Label>
          <SecretInput id="tk-app-secret" value={data.appSecret} onChange={(v) => set('appSecret', v)} placeholder={isEdit ? 'เว้นว่างไว้หากไม่ต้องการเปลี่ยน' : 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="tk-access-token">Access Token <span className="text-red-500">*</span></Label>
          <SecretInput id="tk-access-token" value={data.accessToken} onChange={(v) => set('accessToken', v)} placeholder={isEdit ? 'เว้นว่างไว้หากไม่ต้องการเปลี่ยน' : 'ROW_xxxxxxxxxxxxxxxx...'} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="tk-refresh-token">Refresh Token</Label>
          <SecretInput id="tk-refresh-token" value={data.refreshToken ?? ''} onChange={(v) => set('refreshToken', v || null)} placeholder="ROW_xxxxxxxxxxxxxxxx... (optional)" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tk-shop-cipher">Shop Cipher</Label>
          <Input id="tk-shop-cipher" value={data.shopCipher ?? ''} onChange={(e) => set('shopCipher', e.target.value || null)} placeholder="optional" className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tk-expires">Token Expires At</Label>
          <Input id="tk-expires" type="datetime-local" value={data.tokenExpiresAt ? new Date(data.tokenExpiresAt).toISOString().slice(0, 16) : ''} onChange={(e) => set('tokenExpiresAt', e.target.value || null)} />
        </div>
      </div>

      <div className="rounded-lg bg-pink-50 dark:bg-pink-950 border border-pink-200 dark:border-pink-800 p-3 space-y-1">
        <p className="text-xs font-semibold text-pink-700 dark:text-pink-300 flex items-center gap-1">
          <ExternalLink className="h-3 w-3" /> Webhook URL สำหรับตั้งค่าใน TikTok Partner Center
        </p>
        <div className="flex items-center gap-1">
          <code className="text-xs text-pink-600 dark:text-pink-400 break-all">{webhookBase}</code>
          <CopyButton value={webhookBase} />
        </div>
        <p className="text-xs text-pink-600 dark:text-pink-400">Events: <strong>im.message, customer_service.message</strong></p>
      </div>
    </div>
  )
}

// ─── Account Cards ─────────────────────────────────────────────────────────────

function FacebookCard({
  account,
  onEdit,
  onDelete,
  onToggle,
}: {
  account: FacebookAccount
  onEdit: () => void
  onDelete: () => void
  onToggle: (active: boolean) => void
}) {
  return (
    <Card className="border border-blue-100 dark:border-blue-900 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              f
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{account.name}</p>
              <p className="text-xs text-gray-500 font-mono truncate">Page ID: {account.pageId}</p>
              <p className="text-xs text-gray-500 font-mono truncate">App ID: {account.appId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Switch checked={account.isActive} onCheckedChange={onToggle} />
            <Button size="icon" variant="ghost" onClick={onEdit} className="h-8 w-8">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={account.isActive ? 'default' : 'secondary'} className="text-xs">
            {account.isActive ? <><CheckCircle2 className="h-3 w-3 mr-1" />เชื่อมต่อแล้ว</> : <><AlertCircle className="h-3 w-3 mr-1" />ปิดใช้งาน</>}
          </Badge>
          <Badge variant="outline" className="text-xs font-mono">
            Verify: {account.verifyToken.substring(0, 8)}...
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function TikTokCard({
  account,
  onEdit,
  onDelete,
  onToggle,
}: {
  account: TikTokAccount
  onEdit: () => void
  onDelete: () => void
  onToggle: (active: boolean) => void
}) {
  const isExpired = account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()
  const expiresSoon =
    account.tokenExpiresAt &&
    !isExpired &&
    new Date(account.tokenExpiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  return (
    <Card className="border border-pink-100 dark:border-pink-900 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              T
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{account.name}</p>
              <p className="text-xs text-gray-500 font-mono truncate">Shop ID: {account.shopId}</p>
              <p className="text-xs text-gray-500 font-mono truncate">App Key: {account.appKey}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Switch checked={account.isActive} onCheckedChange={onToggle} />
            <Button size="icon" variant="ghost" onClick={onEdit} className="h-8 w-8">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={account.isActive ? 'default' : 'secondary'} className="text-xs">
            {account.isActive ? <><CheckCircle2 className="h-3 w-3 mr-1" />เชื่อมต่อแล้ว</> : <><AlertCircle className="h-3 w-3 mr-1" />ปิดใช้งาน</>}
          </Badge>
          {isExpired && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />Token หมดอายุแล้ว
            </Badge>
          )}
          {expiresSoon && !isExpired && (
            <Badge className="text-xs bg-yellow-500 hover:bg-yellow-600">
              <AlertCircle className="h-3 w-3 mr-1" />Token ใกล้หมดอายุ
            </Badge>
          )}
          {account.tokenExpiresAt && !isExpired && !expiresSoon && (
            <Badge variant="outline" className="text-xs">
              หมดอายุ: {new Date(account.tokenExpiresAt).toLocaleDateString('th-TH')}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function IntegrationsSettings() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [facebookAccounts, setFacebookAccounts] = useState<FacebookAccount[]>([])
  const [tiktokAccounts, setTiktokAccounts] = useState<TikTokAccount[]>([])

  // Dialog state
  const [fbDialog, setFbDialog] = useState<{ open: boolean; mode: 'add' | 'edit'; data: Omit<FacebookAccount, 'id' | 'createdAt' | 'updatedAt'>; editId?: string }>({
    open: false, mode: 'add', data: { ...EMPTY_FB },
  })
  const [tkDialog, setTkDialog] = useState<{ open: boolean; mode: 'add' | 'edit'; data: Omit<TikTokAccount, 'id' | 'createdAt' | 'updatedAt'>; editId?: string }>({
    open: false, mode: 'add', data: { ...EMPTY_TK },
  })
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; platform: 'facebook' | 'tiktok'; id: string; name: string } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/inbox/integrations')
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setFacebookAccounts(json.facebook ?? [])
      setTiktokAccounts(json.tiktok ?? [])
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถโหลดข้อมูลได้', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Facebook actions ──────────────────────────────────────────────────────

  const openAddFb = () => setFbDialog({ open: true, mode: 'add', data: { ...EMPTY_FB } })
  const openEditFb = (acc: FacebookAccount) =>
    setFbDialog({ open: true, mode: 'edit', editId: acc.id, data: { name: acc.name, pageId: acc.pageId, appId: acc.appId, appSecret: acc.appSecret, pageAccessToken: acc.pageAccessToken, verifyToken: acc.verifyToken, webhookUrl: acc.webhookUrl, pictureUrl: acc.pictureUrl, isActive: acc.isActive } })

  const saveFb = async () => {
    const { mode, data, editId } = fbDialog
    if (!data.name || !data.pageId || !data.appId || !data.verifyToken) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', description: 'ชื่อบัญชี, Page ID, App ID และ Verify Token จำเป็นต้องกรอก', variant: 'destructive' })
      return
    }
    if (mode === 'add' && (!data.appSecret || !data.pageAccessToken)) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', description: 'App Secret และ Page Access Token จำเป็นต้องกรอก', variant: 'destructive' })
      return
    }
    try {
      setSaving(true)
      const url = mode === 'edit' ? `/api/inbox/integrations/${editId}` : '/api/inbox/integrations'
      const method = mode === 'edit' ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'facebook', ...data }) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast({ title: mode === 'add' ? 'เพิ่มบัญชี Facebook สำเร็จ' : 'อัปเดตบัญชี Facebook สำเร็จ' })
      setFbDialog((p) => ({ ...p, open: false }))
      fetchData()
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : 'ไม่สามารถบันทึกได้', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleFb = async (id: string, active: boolean) => {
    try {
      await fetch(`/api/inbox/integrations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'facebook', isActive: active }) })
      setFacebookAccounts((prev) => prev.map((a) => a.id === id ? { ...a, isActive: active } : a))
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' })
    }
  }

  // ── TikTok actions ────────────────────────────────────────────────────────

  const openAddTk = () => setTkDialog({ open: true, mode: 'add', data: { ...EMPTY_TK } })
  const openEditTk = (acc: TikTokAccount) =>
    setTkDialog({ open: true, mode: 'edit', editId: acc.id, data: { name: acc.name, shopId: acc.shopId, appKey: acc.appKey, appSecret: acc.appSecret, accessToken: acc.accessToken, refreshToken: acc.refreshToken, tokenExpiresAt: acc.tokenExpiresAt, shopCipher: acc.shopCipher, webhookUrl: acc.webhookUrl, pictureUrl: acc.pictureUrl, isActive: acc.isActive } })

  const saveTk = async () => {
    const { mode, data, editId } = tkDialog
    if (!data.name || !data.shopId || !data.appKey) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', description: 'ชื่อบัญชี, Shop ID และ App Key จำเป็นต้องกรอก', variant: 'destructive' })
      return
    }
    if (mode === 'add' && (!data.appSecret || !data.accessToken)) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', description: 'App Secret และ Access Token จำเป็นต้องกรอก', variant: 'destructive' })
      return
    }
    try {
      setSaving(true)
      const url = mode === 'edit' ? `/api/inbox/integrations/${editId}` : '/api/inbox/integrations'
      const method = mode === 'edit' ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'tiktok', ...data }) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast({ title: mode === 'add' ? 'เพิ่มบัญชี TikTok Shop สำเร็จ' : 'อัปเดตบัญชี TikTok Shop สำเร็จ' })
      setTkDialog((p) => ({ ...p, open: false }))
      fetchData()
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : 'ไม่สามารถบันทึกได้', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleTk = async (id: string, active: boolean) => {
    try {
      await fetch(`/api/inbox/integrations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'tiktok', isActive: active }) })
      setTiktokAccounts((prev) => prev.map((a) => a.id === id ? { ...a, isActive: active } : a))
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' })
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      const res = await fetch(`/api/inbox/integrations/${deleteConfirm.id}?platform=${deleteConfirm.platform}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      toast({ title: 'ลบบัญชีสำเร็จ' })
      if (deleteConfirm.platform === 'facebook') setFacebookAccounts((p) => p.filter((a) => a.id !== deleteConfirm.id))
      else setTiktokAccounts((p) => p.filter((a) => a.id !== deleteConfirm.id))
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' })
    } finally {
      setDeleteConfirm(null)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-2 border-purple-100 dark:border-purple-900 shadow-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
            <span className="text-2xl">🔗</span>
            การเชื่อมต่อแพลตฟอร์ม
          </CardTitle>
          <CardDescription className="text-purple-700 dark:text-purple-300">
            จัดการ Token และข้อมูลการเชื่อมต่อกับ Facebook Messenger และ TikTok Shop
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Platform Tabs */}
      <Tabs defaultValue="facebook">
        <TabsList className="grid w-full grid-cols-2 bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700 p-1 rounded-xl">
          <TabsTrigger value="facebook" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg">
            <span className="font-bold text-base leading-none">f</span>
            Facebook Messenger
            {facebookAccounts.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs h-4 px-1.5">{facebookAccounts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tiktok" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-red-500 data-[state=active]:text-white rounded-lg">
            <span className="font-bold text-base leading-none">T</span>
            TikTok Shop
            {tiktokAccounts.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs h-4 px-1.5">{tiktokAccounts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Facebook Tab ── */}
        <TabsContent value="facebook" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">บัญชี Facebook Page</h3>
              <p className="text-sm text-gray-500">เชื่อมต่อ Facebook Page เพื่อรับ-ส่งข้อความผ่าน Messenger</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                รีเฟรช
              </Button>
              <Button size="sm" onClick={openAddFb} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4 mr-1" />
                เพิ่มบัญชี
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : facebookAccounts.length === 0 ? (
            <Card className="border-dashed border-2 border-blue-200 dark:border-blue-800">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4">
                  <span className="text-3xl font-bold text-blue-600">f</span>
                </div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">ยังไม่มีบัญชี Facebook</h3>
                <p className="text-sm text-gray-500 mb-4">เพิ่มบัญชี Facebook Page เพื่อเริ่มรับข้อความจาก Messenger</p>
                <Button onClick={openAddFb} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  เพิ่มบัญชีแรก
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {facebookAccounts.map((acc) => (
                <FacebookCard
                  key={acc.id}
                  account={acc}
                  onEdit={() => openEditFb(acc)}
                  onDelete={() => setDeleteConfirm({ open: true, platform: 'facebook', id: acc.id, name: acc.name })}
                  onToggle={(active) => toggleFb(acc.id, active)}
                />
              ))}
            </div>
          )}

          {/* Setup Guide */}
          <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">วิธีตั้งค่า Facebook Messenger</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex gap-2"><span className="font-bold text-blue-600">1.</span><span>ไปที่ <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Meta for Developers</a> และสร้าง App</span></div>
              <div className="flex gap-2"><span className="font-bold text-blue-600">2.</span><span>เพิ่ม Messenger Product และเชื่อมต่อ Facebook Page</span></div>
              <div className="flex gap-2"><span className="font-bold text-blue-600">3.</span><span>คัดลอก Page Access Token จาก Messenger Settings</span></div>
              <div className="flex gap-2"><span className="font-bold text-blue-600">4.</span><span>ตั้งค่า Webhook URL และ Verify Token ให้ตรงกับที่กรอกด้านบน</span></div>
              <div className="flex gap-2"><span className="font-bold text-blue-600">5.</span><span>Subscribe events: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">messages</code>, <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">messaging_postbacks</code></span></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TikTok Tab ── */}
        <TabsContent value="tiktok" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">บัญชี TikTok Shop</h3>
              <p className="text-sm text-gray-500">เชื่อมต่อ TikTok Shop เพื่อรับ-ส่งข้อความกับลูกค้า</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                รีเฟรช
              </Button>
              <Button size="sm" onClick={openAddTk} className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white">
                <Plus className="h-4 w-4 mr-1" />
                เพิ่มบัญชี
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : tiktokAccounts.length === 0 ? (
            <Card className="border-dashed border-2 border-pink-200 dark:border-pink-800">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-red-100 dark:from-pink-900 dark:to-red-900 flex items-center justify-center mb-4">
                  <span className="text-3xl font-bold text-pink-600">T</span>
                </div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">ยังไม่มีบัญชี TikTok Shop</h3>
                <p className="text-sm text-gray-500 mb-4">เพิ่มบัญชี TikTok Shop เพื่อเริ่มรับข้อความจากลูกค้า</p>
                <Button onClick={openAddTk} className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  เพิ่มบัญชีแรก
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {tiktokAccounts.map((acc) => (
                <TikTokCard
                  key={acc.id}
                  account={acc}
                  onEdit={() => openEditTk(acc)}
                  onDelete={() => setDeleteConfirm({ open: true, platform: 'tiktok', id: acc.id, name: acc.name })}
                  onToggle={(active) => toggleTk(acc.id, active)}
                />
              ))}
            </div>
          )}

          {/* Setup Guide */}
          <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">วิธีตั้งค่า TikTok Shop</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex gap-2"><span className="font-bold text-pink-600">1.</span><span>ไปที่ <a href="https://partner.tiktokshop.com" target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:underline">TikTok Shop Partner Center</a> และสร้าง App</span></div>
              <div className="flex gap-2"><span className="font-bold text-pink-600">2.</span><span>คัดลอก App Key และ App Secret จาก App Management</span></div>
              <div className="flex gap-2"><span className="font-bold text-pink-600">3.</span><span>ทำ OAuth2 Authorization เพื่อรับ Access Token และ Shop ID</span></div>
              <div className="flex gap-2"><span className="font-bold text-pink-600">4.</span><span>ตั้งค่า Webhook URL ใน App Settings</span></div>
              <div className="flex gap-2"><span className="font-bold text-pink-600">5.</span><span>Subscribe events: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">im.message</code></span></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Facebook Dialog ── */}
      <Dialog open={fbDialog.open} onOpenChange={(open) => setFbDialog((p) => ({ ...p, open }))}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">f</span>
              {fbDialog.mode === 'add' ? 'เพิ่มบัญชี Facebook Messenger' : 'แก้ไขบัญชี Facebook Messenger'}
            </DialogTitle>
            <DialogDescription>
              กรอกข้อมูล API credentials จาก Meta for Developers
            </DialogDescription>
          </DialogHeader>
          <FacebookForm data={fbDialog.data} onChange={(data) => setFbDialog((p) => ({ ...p, data }))} isEdit={fbDialog.mode === 'edit'} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFbDialog((p) => ({ ...p, open: false }))} disabled={saving}>ยกเลิก</Button>
            <Button onClick={saveFb} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
              {fbDialog.mode === 'add' ? 'เพิ่มบัญชี' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── TikTok Dialog ── */}
      <Dialog open={tkDialog.open} onOpenChange={(open) => setTkDialog((p) => ({ ...p, open }))}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center text-white font-bold text-sm">T</span>
              {tkDialog.mode === 'add' ? 'เพิ่มบัญชี TikTok Shop' : 'แก้ไขบัญชี TikTok Shop'}
            </DialogTitle>
            <DialogDescription>
              กรอกข้อมูล API credentials จาก TikTok Shop Partner Center
            </DialogDescription>
          </DialogHeader>
          <TikTokForm data={tkDialog.data} onChange={(data) => setTkDialog((p) => ({ ...p, data }))} isEdit={tkDialog.mode === 'edit'} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTkDialog((p) => ({ ...p, open: false }))} disabled={saving}>ยกเลิก</Button>
            <Button onClick={saveTk} disabled={saving} className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
              {tkDialog.mode === 'add' ? 'เพิ่มบัญชี' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบบัญชี</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบบัญชี <strong>{deleteConfirm?.name}</strong> ใช่หรือไม่?
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
              ลบบัญชี
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
