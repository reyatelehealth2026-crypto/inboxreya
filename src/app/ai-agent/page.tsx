'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, CalendarClock, CheckCircle2, Loader2, RefreshCw, Send, Sparkles } from 'lucide-react'
import { InboxLayout } from '@/components/layout/InboxLayout'
import { FlexPreview } from '@/components/inbox/FlexPreview'
import { useTags } from '@/hooks/use-tags'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type PromoDraft = {
  id: number
  prompt: string
  campaignType: string
  selectedProducts: Array<{ sku: string; name: string; basePrice: number; promotionPrice?: number | null; stock: number }>
  generatedCopy: string
  flexJson: Record<string, any>
  proposedScheduledAt: string | null
  status: string
  errorMessage?: string | null
  createdBroadcastId?: number | null
}

const CAMPAIGN_TYPES = [
  { value: 'promotion', label: 'Promotion' },
  { value: 'flash_sale', label: 'Flash Sale' },
  { value: 'bestseller', label: 'Bestseller' },
  { value: 'new_arrival', label: 'New Arrival' },
  { value: 'product_catalog', label: 'Product Catalog' },
]

function toLocalInputValue(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1000)
  if (!Number.isFinite(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toIsoFromLocalInput(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

async function parseJsonResponse(response: Response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Request failed (${response.status})`)
  }
  return data
}

export default function AiAgentPage() {
  const [prompt, setPrompt] = useState('ทำ Flash Sale สินค้าโปรที่มีสต็อก พร้อมตั้งส่งพรุ่งนี้ 10:30')
  const [campaignType, setCampaignType] = useState('flash_sale')
  const [maxProducts, setMaxProducts] = useState(6)
  const [drafts, setDrafts] = useState<PromoDraft[]>([])
  const [activeDraftId, setActiveDraftId] = useState<number | null>(null)
  const [editedCopy, setEditedCopy] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const { data: tagsData } = useTags()
  const tags = Array.isArray(tagsData) ? tagsData : []

  const activeDraft = useMemo(
    () => drafts.find((draft) => draft.id === activeDraftId) || drafts[0] || null,
    [drafts, activeDraftId]
  )

  useEffect(() => {
    void loadDrafts()
  }, [])

  useEffect(() => {
    if (!activeDraft) return
    setActiveDraftId(activeDraft.id)
    setEditedCopy(activeDraft.generatedCopy || '')
    setScheduledAt(toLocalInputValue(activeDraft.proposedScheduledAt))
    setMessage(null)
  }, [activeDraft?.id])

  const loadDrafts = async () => {
    setIsLoading(true)
    try {
      const data = await parseJsonResponse(await fetch('/api/ai-agent/promo-drafts', { cache: 'no-store' }))
      setDrafts(data.data || [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load drafts')
    } finally {
      setIsLoading(false)
    }
  }

  const generateDraft = async () => {
    setIsGenerating(true)
    setMessage(null)
    try {
      const data = await parseJsonResponse(await fetch('/api/ai-agent/promo-drafts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, campaignType, maxProducts }),
      }))
      await loadDrafts()
      setActiveDraftId(data.data.id)
      setMessage(data.warning ? `Draft needs review: ${data.warning}` : 'Draft generated')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to generate draft')
    } finally {
      setIsGenerating(false)
    }
  }

  const saveDraft = async () => {
    if (!activeDraft) return
    setIsSaving(true)
    setMessage(null)
    try {
      await parseJsonResponse(await fetch(`/api/ai-agent/promo-drafts/${activeDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generatedCopy: editedCopy,
          proposedScheduledAt: toIsoFromLocalInput(scheduledAt),
        }),
      }))
      await loadDrafts()
      setMessage('Draft saved')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save draft')
      throw error
    } finally {
      setIsSaving(false)
    }
  }

  const approveDraft = async () => {
    if (!activeDraft) return
    setIsApproving(true)
    setMessage(null)
    try {
      await saveDraft()
      const data = await parseJsonResponse(await fetch(`/api/ai-agent/promo-drafts/${activeDraft.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt: toIsoFromLocalInput(scheduledAt),
          targetTagIds: selectedTagIds,
        }),
      }))
      await loadDrafts()
      setMessage(`Approved. Scheduled broadcast #${data.data.broadcast.id}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to approve draft')
    } finally {
      setIsApproving(false)
    }
  }

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((current) => current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId]
    )
  }

  const canApprove = Boolean(activeDraft)
    && activeDraft?.status !== 'scheduled_broadcast_created'
    && activeDraft?.status !== 'needs_review'
    && selectedTagIds.length > 0
    && scheduledAt
    && new Date(scheduledAt) > new Date()
    && !isApproving

  return (
    <InboxLayout>
      <div className="h-full overflow-auto bg-slate-50 p-6">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="h-5 w-5 text-emerald-600" />
                  AI Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agent-prompt">Command</Label>
                  <Textarea id="agent-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} />
                </div>
                <div className="grid grid-cols-[1fr_96px] gap-2">
                  <div className="space-y-2">
                    <Label>Campaign</Label>
                    <Select value={campaignType} onValueChange={setCampaignType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CAMPAIGN_TYPES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-products">Items</Label>
                    <Input id="max-products" type="number" min={1} max={12} value={maxProducts} onChange={(event) => setMaxProducts(Number(event.target.value) || 1)} />
                  </div>
                </div>
                <Button className="w-full gap-2" onClick={generateDraft} disabled={isGenerating || !prompt.trim()}>
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate draft
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Draft Queue</CardTitle>
                <Button variant="ghost" size="icon" onClick={loadDrafts} disabled={isLoading}>
                  <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[420px] pr-3">
                  <div className="space-y-2">
                    {drafts.map((draft) => (
                      <button
                        key={draft.id}
                        type="button"
                        onClick={() => setActiveDraftId(draft.id)}
                        className={cn('w-full rounded-md border bg-white p-3 text-left text-sm transition hover:border-emerald-300', activeDraft?.id === draft.id && 'border-emerald-500 ring-1 ring-emerald-500')}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">#{draft.id} {draft.campaignType}</span>
                          <Badge variant={draft.status === 'scheduled_broadcast_created' ? 'default' : draft.status === 'needs_review' ? 'destructive' : 'secondary'}>{draft.status}</Badge>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{draft.prompt}</p>
                      </button>
                    ))}
                    {drafts.length === 0 && <div className="rounded-md border border-dashed bg-white p-6 text-center text-sm text-muted-foreground">No AI promo drafts yet.</div>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            {message && <div className="rounded-md border bg-white px-4 py-3 text-sm text-slate-700">{message}</div>}

            {activeDraft ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="text-lg">Review draft #{activeDraft.id}</CardTitle>
                      <Badge>{activeDraft.campaignType}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {activeDraft.errorMessage && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{activeDraft.errorMessage}</div>}

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="scheduled-at">Schedule</Label>
                        <Input id="scheduled-at" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} disabled={activeDraft.status === 'scheduled_broadcast_created'} />
                      </div>
                      <div className="space-y-2">
                        <Label>Approval</Label>
                        <div className="flex gap-2">
                          <Button variant="outline" className="gap-2" onClick={saveDraft} disabled={isSaving || activeDraft.status === 'scheduled_broadcast_created'}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Save
                          </Button>
                          <Button className="gap-2" onClick={approveDraft} disabled={!canApprove}>
                            {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Approve schedule
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="generated-copy">Copy</Label>
                      <Textarea id="generated-copy" value={editedCopy} onChange={(event) => setEditedCopy(event.target.value)} rows={7} disabled={activeDraft.status === 'scheduled_broadcast_created'} />
                    </div>

                    <div className="space-y-2">
                      <Label>Audience tags</Label>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {tags.map((tag) => {
                          const tagId = Number(tag.id)
                          return (
                            <label key={tag.id} className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                              <Checkbox checked={selectedTagIds.includes(tagId)} onCheckedChange={() => toggleTag(tagId)} disabled={activeDraft.status === 'scheduled_broadcast_created'} />
                              <span className="truncate">{tag.name}</span>
                            </label>
                          )
                        })}
                      </div>
                      {selectedTagIds.length === 0 && <p className="text-xs text-muted-foreground">Select at least one tag before approval.</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Products from source</Label>
                      <div className="overflow-hidden rounded-md border bg-white">
                        <div className="grid grid-cols-[90px_1fr_90px_90px] gap-2 border-b bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                          <span>SKU</span><span>Name</span><span>Price</span><span>Stock</span>
                        </div>
                        {activeDraft.selectedProducts.map((product) => (
                          <div key={product.sku} className="grid grid-cols-[90px_1fr_90px_90px] gap-2 border-b px-3 py-2 text-xs last:border-b-0">
                            <span className="font-mono">{product.sku}</span>
                            <span className="truncate">{product.name}</span>
                            <span>{product.promotionPrice || product.basePrice}</span>
                            <span>{Math.floor(product.stock)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4" />Flex Preview</CardTitle></CardHeader>
                  <CardContent><FlexPreview flex={activeDraft.flexJson} /></CardContent>
                </Card>
              </div>
            ) : (
              <Card><CardContent className="p-10 text-center text-muted-foreground">Generate a draft to start the approval flow.</CardContent></Card>
            )}
          </section>
        </div>
      </div>
    </InboxLayout>
  )
}

