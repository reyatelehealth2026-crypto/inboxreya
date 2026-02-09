'use client'

import { useState } from 'react'
import { useSettingsStore, KeyboardShortcut, KeyboardShortcuts } from '@/stores/settings'
import { formatShortcut } from '@/hooks/use-keyboard-shortcuts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Keyboard, RotateCcw, Edit2, Check, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function ShortcutsSettings() {
  const { shortcuts, updateShortcut, resetShortcuts } = useSettingsStore()
  const { toast } = useToast()
  const [editingAction, setEditingAction] = useState<keyof KeyboardShortcuts | null>(null)
  const [recordedKeys, setRecordedKeys] = useState<Partial<KeyboardShortcut>>({})

  const shortcutActions: Array<{
    action: keyof KeyboardShortcuts
    label: string
    description: string
  }> = [
      {
        action: 'sendMessage',
        label: 'ส่งข้อความ',
        description: 'ส่งข้อความปัจจุบัน',
      },
      {
        action: 'searchConversations',
        label: 'ค้นหาการสนทนา',
        description: 'เปิดหน้าต่างค้นหาแชท',
      },
      {
        action: 'openTemplatePicker',
        label: 'เปิดเทมเพลต',
        description: 'เปิดหน้าต่างเลือกเทมเพลตคำตอบด่วน',
      },
      {
        action: 'markAsResolved',
        label: 'ปิดงาน',
        description: 'เปลี่ยนสถานะเป็นปิดงาน (Resolved)',
      },
      {
        action: 'showShortcutsHelp',
        label: 'แสดงคีย์ลัดทั้งหมด',
        description: 'เปิดหน้าต่างแสดงรายการคีย์ลัด',
      },
      {
        action: 'navigateUp',
        label: 'เลื่อนขึ้น',
        description: 'ย้ายไปยังการสนทนาก่อนหน้า',
      },
      {
        action: 'navigateDown',
        label: 'เลื่อนลง',
        description: 'ย้ายไปยังการสนทนาถัดไป',
      },
      {
        action: 'openEmojiPicker',
        label: 'เปิดอีโมจิ',
        description: 'เปิดหน้าต่างเลือกอีโมจิ',
      },
    ]

  const handleStartEdit = (action: keyof KeyboardShortcuts) => {
    setEditingAction(action)
    setRecordedKeys({})
  }

  const handleCancelEdit = () => {
    setEditingAction(null)
    setRecordedKeys({})
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Record the key combination
    const newShortcut: Partial<KeyboardShortcut> = {
      key: e.key,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
    }

    setRecordedKeys(newShortcut)
  }

  const handleSaveShortcut = () => {
    if (!editingAction || !recordedKeys.key) return

    const currentShortcut = shortcuts[editingAction]
    const newShortcut: KeyboardShortcut = {
      ...currentShortcut,
      key: recordedKeys.key,
      ctrl: recordedKeys.ctrl,
      shift: recordedKeys.shift,
      alt: recordedKeys.alt,
    }

    updateShortcut(editingAction, newShortcut)
    setEditingAction(null)
    setRecordedKeys({})

    toast({
      title: 'อัปเดตคีย์ลัดสำเร็จ',
      description: `คีย์ลัดสำหรับ "${shortcutActions.find((a) => a.action === editingAction)?.label}" ถูกอัปเดตแล้ว`,
    })
  }

  const handleResetAll = () => {
    resetShortcuts()
    toast({
      title: 'รีเซ็ตคีย์ลัดสำเร็จ',
      description: 'คีย์ลัดทั้งหมดถูกรีเซ็ตเป็นค่าเริ่มต้นแล้ว',
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              ตั้งค่าคีย์ลัด
            </CardTitle>
            <CardDescription>
              ปรับแต่งคีย์ลัดเพื่อความรวดเร็วในการทำงาน
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetAll}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            รีเซ็ตค่าเริ่มต้น
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {shortcutActions.map(({ action, label, description }) => {
            const shortcut = shortcuts[action]
            const isEditing = editingAction === action

            return (
              <div
                key={action}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-xs text-gray-500 mt-1">{description}</div>
                </div>

                <div className="flex items-center gap-3">
                  {isEditing ? (
                    <>
                      <div className="relative">
                        <Input
                          placeholder="กดปุ่มที่ต้องการ..."
                          value={
                            recordedKeys.key
                              ? formatShortcut(recordedKeys as KeyboardShortcut)
                              : ''
                          }
                          onKeyDown={handleKeyDown}
                          className="w-48 text-center font-mono"
                          autoFocus
                          readOnly
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSaveShortcut}
                        disabled={!recordedKeys.key}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <kbd className="px-3 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded-lg shadow-sm min-w-[100px] text-center">
                        {formatShortcut(shortcut)}
                      </kbd>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStartEdit(action)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>คำแนะนำ:</strong> คลิกที่ไอคอนดินสอเพื่อแก้ไขคีย์ลัด แล้วกดปุ่มที่ต้องการเพื่อบันทึก
            สามารถใช้ปุ่ม Ctrl, Shift, และ Alt ร่วมด้วยได้
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
