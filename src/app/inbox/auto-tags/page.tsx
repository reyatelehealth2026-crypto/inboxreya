"use client"

import { useMemo, useState } from 'react'
import { useAutoTagRules, useCreateAutoTagRule, useDeleteAutoTagRule, useUpdateAutoTagRule } from '@/hooks/use-auto-tags'
import { useTags } from '@/hooks/use-tags'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

const triggerOptions = [
  { value: 'on_follow', label: 'ติดตาม' },
  { value: 'on_message', label: 'ข้อความใหม่' },
  { value: 'on_order', label: 'คำสั่งซื้อ' },
  { value: 'on_tier_upgrade', label: 'อัปเกรดระดับสมาชิก' },
  { value: 'on_points_milestone', label: 'แต้มถึงเป้า' },
  { value: 'on_video_call', label: 'วิดีโอคอล' },
  { value: 'on_referral', label: 'การแนะนำเพื่อน' },
  { value: 'on_inactive', label: 'ไม่ได้ใช้งาน' },
  { value: 'on_birthday', label: 'วันเกิด' },
]

export default function AutoTagsPage() {
  const { data: rules = [] } = useAutoTagRules()
  const { data: tags = [] } = useTags()
  const createRule = useCreateAutoTagRule()
  const updateRule = useUpdateAutoTagRule()
  const deleteRule = useDeleteAutoTagRule()

  const [tagId, setTagId] = useState('')
  const [triggerType, setTriggerType] = useState(triggerOptions[0].value)
  const [ruleName, setRuleName] = useState('')
  const [priority, setPriority] = useState(0)
  const [conditions, setConditions] = useState('[]')
  const [error, setError] = useState<string | null>(null)

  const tagOptions = useMemo(() => tags, [tags])

  const handleCreate = async () => {
    try {
      const parsedConditions = JSON.parse(conditions || '[]')
      await createRule.mutateAsync({
        tagId,
        triggerType: triggerType as any,
        conditions: parsedConditions,
        priority,
        ruleName: ruleName || undefined,
      })
      setRuleName('')
      setPriority(0)
      setConditions('[]')
      setError(null)
    } catch (err) {
      setError('รูปแบบเงื่อนไขไม่ถูกต้อง (ต้องเป็น JSON)')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">กฎติดแท็กอัตโนมัติ</h1>
        <p className="text-sm text-muted-foreground">สร้างและจัดการกฎการติดแท็กอัตโนมัติ</p>
      </div>

      <Card className="p-4 space-y-4">
        <h2 className="text-lg font-medium">เพิ่มกฎใหม่</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="rule-name">ชื่อกฎ</Label>
            <Input
              id="rule-name"
              placeholder="เช่น ลูกค้าประจำ"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rule-tag">แท็ก</Label>
            <select
              id="rule-tag"
              className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
            >
              <option value="">เลือกแท็ก</option>
              {tagOptions.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="trigger-type">ทริกเกอร์</Label>
            <select
              id="trigger-type"
              className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
            >
              {triggerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="priority">ความสำคัญ</Label>
            <Input
              id="priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="conditions">เงื่อนไข (JSON)</Label>
          <Textarea
            id="conditions"
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            className="min-h-[120px]"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <Button onClick={handleCreate} disabled={!tagId || createRule.isPending}>
          เพิ่มกฎ
        </Button>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">รายการกฎ</h2>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีการตั้งค่ากฎ</p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <Card key={rule.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{rule.ruleName || 'กฎอัตโนมัติ'}</span>
                      <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                        {rule.isActive ? 'ใช้งาน' : 'ปิด'}
                      </Badge>
                      <Badge variant="outline">Priority {rule.priority}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Trigger: {rule.triggerType}
                    </p>
                    {rule.tag && (
                      <Badge
                        variant="outline"
                        className="mt-2"
                        style={{ borderColor: rule.tag.color, color: rule.tag.color }}
                      >
                        {rule.tag.name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateRule.mutateAsync({ id: rule.id, isActive: !rule.isActive })
                      }
                    >
                      {rule.isActive ? 'ปิด' : 'เปิด'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteRule.mutateAsync(rule.id)}
                    >
                      ลบ
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground break-words whitespace-pre-wrap">
                  {JSON.stringify(rule.conditions)}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
