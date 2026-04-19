"use client"

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Link2,
  Link2Off,
  Sparkles,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Hash,
  Phone,
  Wrench,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type FindingLevel = 'ok' | 'warning' | 'error'

interface Finding {
  level: FindingLevel
  code: string
  title: string
  detail?: string
}

type AutoFixCode =
  | 'sync_member_id_from_link'
  | 'create_link_from_member_id'
  | 'relink_partner'

interface SuggestedAction {
  label: string
  description: string
  fixCode?: AutoFixCode
  destructive?: boolean
}

interface FixResult {
  success: boolean
  fixCode: AutoFixCode
  applied: boolean
  message: string
  details?: Record<string, unknown>
}

async function applyAutoFix(userId: string, fixCode: AutoFixCode): Promise<FixResult> {
  const res = await fetch(`/api/inbox/customers/${userId}/odoo-diagnose/fix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fixCode }),
  })
  const json = (await res.json()) as FixResult & { error?: string }
  if (!res.ok && !json?.fixCode) {
    throw new Error(json?.error || 'Fix request failed')
  }
  return json
}

interface LinkStatus {
  overall: 'linked' | 'partial' | 'unlinked'
  hasLineUserId: boolean
  hasMemberId: boolean
  hasPhone: boolean
  hasOdooLink: boolean
  hasOdooPartner: boolean
  partnerId: number | null
  partnerName: string | null
  partnerCode: string | null
  linkedVia: string | null
  linkedAt: string | null
}

interface WebhookSummary {
  total: number
  success: number
  failed: number
  retry: number
  dead_letter: number
  last_event_at: string | null
}

interface DiagnoseResponse {
  success: boolean
  data: {
    userId: number
    customer: {
      displayName: string | null
      lineUserId: string
      memberId: string | null
      phone: string | null
    }
    linkStatus: LinkStatus
    webhookSummary: WebhookSummary | null
    findings: Finding[]
    suggestedActions: SuggestedAction[]
    aiDiagnosis: string | null
    aiError: string | null
    generatedAt: string
  }
}

async function fetchDiagnose(
  userId: string,
  withAi: boolean
): Promise<DiagnoseResponse['data']> {
  const res = await fetch(
    `/api/inbox/customers/${userId}/odoo-diagnose?ai=${withAi ? '1' : '0'}`,
    { cache: 'no-store' }
  )
  if (!res.ok) throw new Error('Failed to load diagnose')
  const json = (await res.json()) as DiagnoseResponse
  if (!json.success) throw new Error('Diagnose returned error')
  return json.data
}

// ----------------------------- helpers ---------------------------------------

function overallLabel(s: LinkStatus['overall']) {
  switch (s) {
    case 'linked':
      return {
        text: 'เชื่อม Odoo แล้ว',
        short: 'เชื่อมแล้ว',
        color: 'bg-emerald-500',
        ring: 'ring-emerald-200',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        textColor: 'text-emerald-700',
        Icon: ShieldCheck,
      }
    case 'partial':
      return {
        text: 'เชื่อมไม่สมบูรณ์',
        short: 'บางส่วน',
        color: 'bg-amber-500',
        ring: 'ring-amber-200',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        textColor: 'text-amber-700',
        Icon: AlertTriangle,
      }
    default:
      return {
        text: 'ยังไม่เชื่อมกับ Odoo',
        short: 'ยังไม่เชื่อม',
        color: 'bg-red-500',
        ring: 'ring-red-200',
        bg: 'bg-red-50',
        border: 'border-red-200',
        textColor: 'text-red-700',
        Icon: ShieldAlert,
      }
  }
}

function findingIcon(level: FindingLevel) {
  if (level === 'ok') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
  if (level === 'warning')
    return <AlertTriangle className="h-4 w-4 text-amber-600" />
  return <XCircle className="h-4 w-4 text-red-600" />
}

function hasErrors(findings: Finding[]): boolean {
  // Only real errors flip the button to red. Warnings keep the normal theme
  // so that a fully-linked customer with minor data-hygiene issues doesn't
  // look like a critical alert.
  return findings.some((f) => f.level === 'error')
}

// Small markdown-ish renderer for AI bullet output (no external lib needed)
function AiMarkdown({ text }: { text: string }) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  return (
    <div className="space-y-1.5 text-sm text-gray-700 leading-relaxed">
      {lines.map((raw, idx) => {
        const line = raw.trim()
        const isBullet = /^[-*]\s+/.test(line)
        const body = isBullet ? line.replace(/^[-*]\s+/, '') : line
        // bold: **text**
        const parts = body.split(/(\*\*[^*]+\*\*)/g)
        return (
          <div key={idx} className={cn(isBullet && 'pl-4 relative')}>
            {isBullet && (
              <span className="absolute left-0 top-[9px] h-1.5 w-1.5 rounded-full bg-[#0C665D]" />
            )}
            {parts.map((p, i) =>
              p.startsWith('**') && p.endsWith('**') ? (
                <strong key={i} className="font-semibold text-gray-900">
                  {p.slice(2, -2)}
                </strong>
              ) : (
                <span key={i}>{p}</span>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}

// ----------------------------- Compact badge ---------------------------------

/**
 * Small inline badge showing Odoo-link status.
 * If `onClick` is provided, it is invoked (e.g. to switch to the Odoo tab).
 * Otherwise clicking the badge opens an internal diagnose dialog directly.
 */
export function OdooLinkBadge({
  userId,
  className,
  onClick,
}: {
  userId: string
  className?: string
  onClick?: () => void
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['odoo-link-status', userId],
    queryFn: () => fetchDiagnose(userId, false),
    enabled: !!userId,
    staleTime: 60 * 1000,
  })

  const aiMutation = useMutation({
    mutationFn: () => fetchDiagnose(userId, true),
  })

  if (isLoading || !data) {
    return (
      <Badge
        className={cn(
          'text-[10px] font-semibold px-2 py-0.5 h-auto gap-1',
          'bg-white/20 text-white border border-white/30',
          className
        )}
      >
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        กำลังตรวจ Odoo…
      </Badge>
    )
  }

  const label = overallLabel(data.linkStatus.overall)
  const Icon =
    data.linkStatus.overall === 'linked' ? Link2 : Link2Off
  // Show partner code inline when linked — makes the badge instantly informative
  const partnerCode = data.linkStatus.partnerCode
  const hasRealIssue = data.findings.some(
    (f) => f.level === 'error' || f.level === 'warning'
  )

  // Only fetch AI when there's actually a real issue to diagnose
  const handleClick = () => {
    if (onClick) {
      onClick()
      return
    }
    setIsDialogOpen(true)
    if (hasRealIssue && !aiMutation.data && !aiMutation.isPending) {
      aiMutation.mutate()
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-1 rounded-full text-[11px] font-bold cursor-pointer',
          'px-2.5 py-1 leading-none shadow-sm',
          'transition-all hover:scale-[1.04] hover:shadow',
          data.linkStatus.overall === 'linked'
            ? 'bg-emerald-500 text-white ring-1 ring-emerald-300'
            : data.linkStatus.overall === 'partial'
              ? 'bg-amber-500 text-white ring-1 ring-amber-300'
              : 'bg-red-500 text-white ring-2 ring-red-200 animate-pulse',
          className
        )}
        title={
          data.linkStatus.overall === 'linked' && partnerCode
            ? `${label.text} · ${partnerCode}`
            : label.text
        }
      >
        <Icon className="h-3 w-3" />
        <span>{label.short}</span>
        {data.linkStatus.overall === 'linked' && partnerCode && (
          <span className="opacity-80 font-semibold">· {partnerCode}</span>
        )}
      </button>

      {/* Internal diagnose dialog (only used when no onClick override) */}
      {!onClick && (
        <DiagnoseDialog
          userId={userId}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          data={data}
          aiMutation={aiMutation}
        />
      )}
    </>
  )
}

// ----------------------------- Full card -------------------------------------

/**
 * Full link-status card. Shown at top of the Odoo tab.
 * Includes quick checklist and "AI วิเคราะห์ปัญหา" button.
 */
export function OdooLinkStatusCard({ userId }: { userId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['odoo-link-status', userId],
    queryFn: () => fetchDiagnose(userId, false),
    enabled: !!userId,
    staleTime: 60 * 1000,
  })

  const aiMutation = useMutation({
    mutationFn: () => fetchDiagnose(userId, true),
  })

  const handleOpenDiagnose = (fetchAi: boolean) => {
    setIsDialogOpen(true)
    if (fetchAi && !aiMutation.data && !aiMutation.isPending) {
      aiMutation.mutate()
    }
  }

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        <Skeleton className="h-6 w-40 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    )
  }

  const label = overallLabel(data.linkStatus.overall)
  const { linkStatus, findings } = data
  const errorsExist = hasErrors(findings)
  // Any warning or error counts as an "issue" — ok/info findings do not
  const hasAnyIssue = findings.some(
    (f) => f.level === 'error' || f.level === 'warning'
  )

  return (
    <>
      <div
        className={cn(
          'rounded-xl border-2 p-3 shadow-sm',
          label.bg,
          label.border
        )}
      >
        {/* Header: big status */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-white shadow-sm',
                label.color
              )}
            >
              <label.Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div
                className={cn(
                  'text-sm font-extrabold leading-tight',
                  label.textColor
                )}
              >
                {label.text}
              </div>
              <div className="text-[10px] text-gray-500">
                {linkStatus.hasOdooPartner
                  ? `Partner #${linkStatus.partnerId}${linkStatus.partnerCode ? ` · ${linkStatus.partnerCode}` : ''}`
                  : 'ส่งแจ้งเตือน BDO / ส่งยอดไม่ได้จนกว่าจะเชื่อม'}
              </div>
            </div>
          </div>
        </div>

        {/* Quick check chips */}
        <div className="flex flex-wrap gap-1 mb-2">
          <CheckChip
            ok={linkStatus.hasLineUserId}
            label="LINE"
            Icon={Hash}
          />
          <CheckChip
            ok={linkStatus.hasMemberId}
            label="Member ID"
            Icon={Hash}
          />
          <CheckChip ok={linkStatus.hasPhone} label="เบอร์" Icon={Phone} />
          <CheckChip
            ok={linkStatus.hasOdooPartner}
            label="Partner"
            Icon={Link2}
          />
        </div>

        {/* Diagnose button — only show AI button when there's something to diagnose */}
        {hasAnyIssue ? (
          <Button
            size="sm"
            onClick={() => handleOpenDiagnose(true)}
            className={cn(
              'w-full h-8 text-xs font-semibold gap-1.5 cursor-pointer',
              errorsExist
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {errorsExist ? 'AI วิเคราะห์ปัญหา' : 'AI ตรวจเช็กและแก้อัตโนมัติ'}
          </Button>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              ทุกอย่างเรียบร้อย ไม่ต้องแก้
            </div>
            <button
              type="button"
              onClick={() => handleOpenDiagnose(false)}
              className="text-[11px] text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline cursor-pointer"
            >
              ดูรายละเอียด
            </button>
          </div>
        )}
      </div>

      <DiagnoseDialog
        userId={userId}
        open={isDialogOpen}
        onOpenChange={(v) => {
          setIsDialogOpen(v)
          if (!v) refetch()
        }}
        data={data}
        aiMutation={aiMutation}
      />
    </>
  )
}

// ----------------------------- Shared Dialog ---------------------------------

type DiagnoseData = DiagnoseResponse['data']
type AiMutation = ReturnType<typeof useMutation<DiagnoseData, Error, void>>

function DiagnoseDialog({
  userId,
  open,
  onOpenChange,
  data,
  aiMutation,
}: {
  userId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  data: DiagnoseData
  aiMutation: AiMutation
}) {
  const label = overallLabel(data.linkStatus.overall)
  const { findings } = data
  const hasRealIssue = findings.some(
    (f) => f.level === 'error' || f.level === 'warning'
  )
  const { toast } = useToast()
  const qc = useQueryClient()
  const [pendingFixCode, setPendingFixCode] = useState<AutoFixCode | null>(null)
  const [confirmFix, setConfirmFix] = useState<SuggestedAction | null>(null)

  const runFix = async (action: SuggestedAction) => {
    if (!action.fixCode) return
    setPendingFixCode(action.fixCode)
    try {
      const result = await applyAutoFix(userId, action.fixCode)
      if (result.success) {
        toast({
          title: result.applied ? 'แก้ไขสำเร็จ' : 'ไม่ต้องแก้',
          description: result.message,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'แก้ไขไม่สำเร็จ',
          description: result.message,
        })
      }
      // Invalidate and refetch diagnose + partner caches so UI refreshes
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['odoo-link-status', userId] }),
        qc.invalidateQueries({ queryKey: ['odoo-partner', userId] }),
        qc.invalidateQueries({ queryKey: ['customer-profile', userId] }),
      ])
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'แก้ไขไม่สำเร็จ',
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setPendingFixCode(null)
      setConfirmFix(null)
    }
  }

  const handleFixClick = (action: SuggestedAction) => {
    if (action.destructive) {
      setConfirmFix(action)
    } else {
      void runFix(action)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0C665D]" />
            AI วินิจฉัยปัญหา Odoo Linkage
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-3">
            {/* Summary banner */}
            <div
              className={cn(
                'rounded-lg border p-2.5 flex items-start gap-2',
                label.bg,
                label.border
              )}
            >
              <label.Icon
                className={cn('h-4 w-4 flex-shrink-0 mt-0.5', label.textColor)}
              />
              <div className="text-sm">
                <div className={cn('font-bold', label.textColor)}>
                  {label.text}
                </div>
                <div className="text-xs text-gray-600">
                  {data.customer.displayName || data.customer.lineUserId}
                  {data.customer.memberId ? ` · ${data.customer.memberId}` : ''}
                </div>
              </div>
            </div>

            {/* Findings list */}
            <div>
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                รายการตรวจ ({findings.length})
              </div>
              <div className="space-y-1">
                {findings.map((f, idx) => (
                  <div
                    key={`${f.code}-${idx}`}
                    className="flex items-start gap-2 text-xs bg-white border border-gray-100 rounded-md px-2 py-1.5"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {findingIcon(f.level)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'font-semibold',
                          f.level === 'error'
                            ? 'text-red-700'
                            : f.level === 'warning'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        )}
                      >
                        {f.title}
                      </div>
                      {f.detail && (
                        <div className="text-gray-600 break-words">
                          {f.detail}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI diagnosis — only show when there are real issues to diagnose */}
            {hasRealIssue ? (
              <div>
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  ข้อเสนอแนะจาก AI
                </div>
                <div className="rounded-lg border border-[#0C665D]/20 bg-[#F0F9F8] p-2.5">
                  {aiMutation.isPending ? (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังวิเคราะห์ด้วย AI…
                    </div>
                  ) : aiMutation.isError ? (
                    <div className="text-sm text-red-600">
                      AI ไม่พร้อมใช้งาน — กรุณาลองใหม่อีกครั้ง
                    </div>
                  ) : aiMutation.data?.aiDiagnosis ? (
                    <AiMarkdown text={aiMutation.data.aiDiagnosis} />
                  ) : aiMutation.data?.aiError &&
                    aiMutation.data.aiError !== 'no_issues' ? (
                    <div className="text-sm text-red-600">
                      {aiMutation.data.aiError}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">
                      กดปุ่ม “วิเคราะห์” เพื่อเริ่มวินิจฉัยด้วย AI
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 flex items-center gap-2 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>
                  ไม่พบปัญหาในการเชื่อมกับ Odoo — ไม่จำเป็นต้องใช้ AI วิเคราะห์
                </span>
              </div>
            )}

            {/* Suggested actions */}
            {data.suggestedActions.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  ขั้นตอนแนะนำ
                </div>
                <div className="space-y-1">
                  {data.suggestedActions.map((a, idx) => {
                    const isFixable = !!a.fixCode
                    const isBusy = pendingFixCode === a.fixCode
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'text-xs rounded-md px-2 py-1.5 border',
                          isFixable
                            ? 'bg-[#F0F9F8] border-[#0C665D]/20'
                            : 'bg-white border-gray-100'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-gray-900">
                              {a.label}
                            </div>
                            <div className="text-gray-600">{a.description}</div>
                          </div>
                          {isFixable && (
                            <Button
                              size="sm"
                              onClick={() => handleFixClick(a)}
                              disabled={isBusy || pendingFixCode !== null}
                              className={cn(
                                'h-7 px-2 text-[11px] font-semibold gap-1 flex-shrink-0 cursor-pointer',
                                a.destructive
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                  : 'bg-[#0C665D] hover:bg-[#0a5048] text-white'
                              )}
                            >
                              {isBusy ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Wrench className="h-3 w-3" />
                              )}
                              {a.destructive ? 'แก้ (ต้องยืนยัน)' : 'แก้อัตโนมัติ'}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Footer meta */}
            <div className="text-[10px] text-gray-400 pt-1">
              อัปเดตเมื่อ{' '}
              {new Date(
                aiMutation.data?.generatedAt || data.generatedAt
              ).toLocaleString('th-TH')}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          {hasRealIssue && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => aiMutation.mutate()}
              disabled={aiMutation.isPending}
              className="cursor-pointer"
            >
              {aiMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  กำลังวิเคราะห์
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  วิเคราะห์ใหม่
                </>
              )}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
            style={{ background: '#0C665D' }}
          >
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {/* Confirmation modal for destructive fixes — sibling dialog, not nested */}
      <Dialog
        open={!!confirmFix}
        onOpenChange={(v) => !v && setConfirmFix(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              ยืนยันการแก้ไขแบบ destructive
            </DialogTitle>
          </DialogHeader>
          {confirmFix && (
            <div className="space-y-2 py-2">
              <div className="text-sm font-semibold text-gray-900">
                {confirmFix.label}
              </div>
              <div className="text-sm text-gray-600">
                {confirmFix.description}
              </div>
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                การแก้นี้จะลบ/เขียนทับข้อมูลเดิม — โปรดยืนยันว่าต้องการดำเนินการ
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmFix(null)}
              disabled={pendingFixCode !== null}
              className="cursor-pointer"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={() => confirmFix && runFix(confirmFix)}
              disabled={pendingFixCode !== null}
              className="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white"
            >
              {pendingFixCode ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  กำลังแก้
                </>
              ) : (
                <>
                  <Wrench className="h-3.5 w-3.5 mr-1" />
                  ยืนยันและแก้
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CheckChip({
  ok,
  label,
  Icon,
}: {
  ok: boolean
  label: string
  Icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border',
        ok
          ? 'bg-white text-emerald-700 border-emerald-200'
          : 'bg-white text-red-700 border-red-200'
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
      {ok ? (
        <CheckCircle2 className="h-2.5 w-2.5" />
      ) : (
        <XCircle className="h-2.5 w-2.5" />
      )}
    </span>
  )
}
