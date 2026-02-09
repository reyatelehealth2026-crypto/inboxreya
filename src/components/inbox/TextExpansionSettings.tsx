'use client'

import { useState } from 'react'
import { Plus, Trash2, Zap, Edit2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useSettingsStore, TextExpansion } from '@/stores/settings'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

export function TextExpansionSettings() {
  const { textExpansions, addTextExpansion, removeTextExpansion } = useSettingsStore()
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingExpansion, setEditingExpansion] = useState<TextExpansion | null>(null)
  const [formData, setFormData] = useState<TextExpansion>({
    trigger: '',
    replacement: '',
    description: '',
  })

  const handleOpenDialog = (expansion?: TextExpansion) => {
    if (expansion) {
      setEditingExpansion(expansion)
      setFormData(expansion)
    } else {
      setEditingExpansion(null)
      setFormData({ trigger: '', replacement: '', description: '' })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingExpansion(null)
    setFormData({ trigger: '', replacement: '', description: '' })
  }

  const handleSave = () => {
    if (!formData.trigger || !formData.replacement) {
      toast({
        title: 'ข้อมูลไม่ครบถ้วน',
        description: 'กรุณาระบุคำย่อและข้อความที้ต้องการแทนที่',
        variant: 'destructive',
      })
      return
    }

    // Ensure trigger starts with /
    const trigger = formData.trigger.startsWith('/')
      ? formData.trigger
      : `/${formData.trigger}`

    if (editingExpansion) {
      // Remove old and add new (update)
      removeTextExpansion(editingExpansion.trigger)
    }

    addTextExpansion({
      ...formData,
      trigger,
    })

    toast({
      title: editingExpansion ? 'อัปเดตข้อความสำเร็จ' : 'เพิ่มข้อความสำเร็จ',
      description: `คำย่อ "${trigger}" ได้รับการ${editingExpansion ? 'อัปเดต' : 'เพิ่ม'}แล้ว`,
    })

    handleCloseDialog()
  }

  const handleDelete = (trigger: string) => {
    removeTextExpansion(trigger)
    toast({
      title: 'ลบข้อความสำเร็จ',
      description: `คำย่อ "${trigger}" ถูกลบแล้ว`,
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                ข้อความอัตโนมัติ
              </CardTitle>
              <CardDescription>
                สร้างคำย่อเพื่อพิมพ์ข้อความยาวๆ ได้อย่างรวดเร็ว
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => handleOpenDialog()}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              เพิ่มรายการ
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {textExpansions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Zap className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">ยังไม่มีข้อความอัตโนมัติ</p>
              <p className="text-xs mt-1">คลิก "เพิ่มรายการ" ด้านบนเพื่อเริ่มใช้งาน</p>
            </div>
          ) : (
            <div className="space-y-2">
              {textExpansions.map((expansion) => (
                <div
                  key={expansion.trigger}
                  className="flex items-start justify-between p-4 rounded-lg border hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="px-2 py-1 text-xs font-mono bg-gray-100 rounded">
                        {expansion.trigger}
                      </code>
                      {expansion.description && (
                        <span className="text-xs text-gray-500">
                          {expansion.description}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 truncate">
                      {expansion.replacement}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenDialog(expansion)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(expansion.trigger)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>วิธีใช้งาน:</strong> พิมพ์คำย่อ (เช่น <code>/hello</code>) ในช่องพิมพ์ข้อความ
              ระบบจะแทนที่ด้วยข้อความเต็มให้อัตโนมัติ โดยคำย่อต้องขึ้นต้นด้วย <code>/</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingExpansion ? 'แก้ไขข้อความอัตโนมัติ' : 'เพิ่มข้อความอัตโนมัติ'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="trigger">คำย่อ (Trigger)</Label>
              <Input
                id="trigger"
                placeholder="/hello"
                value={formData.trigger}
                onChange={(e) =>
                  setFormData({ ...formData, trigger: e.target.value })
                }
                className="font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                ต้องขึ้นต้นด้วย / (ระบบจะเติมให้หากไม่ได้ใส่)
              </p>
            </div>

            <div>
              <Label htmlFor="replacement">ข้อความเต็ม (Replacement)</Label>
              <Textarea
                id="replacement"
                placeholder="สวัสดีค่ะ ยินดีให้บริการค่ะ"
                value={formData.replacement}
                onChange={(e) =>
                  setFormData({ ...formData, replacement: e.target.value })
                }
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="description">คำอธิบาย (ไม่บังคับ)</Label>
              <Input
                id="description"
                placeholder="ข้อความทักทาย"
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave}>
              {editingExpansion ? 'บันทึก' : 'เพิ่ม'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
