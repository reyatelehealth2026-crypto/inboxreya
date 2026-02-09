'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSettingsStore } from '@/stores/settings'
import { formatShortcut } from '@/hooks/use-keyboard-shortcuts'
import { Keyboard } from 'lucide-react'

interface KeyboardShortcutsHelpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const shortcuts = useSettingsStore((state) => state.shortcuts)

  const shortcutGroups = [
    {
      title: 'การส่งข้อความ',
      shortcuts: [
        { action: 'sendMessage', label: 'ส่งข้อความ', ...shortcuts.sendMessage },
        { action: 'openTemplatePicker', label: 'เปิดเทมเพลต', ...shortcuts.openTemplatePicker },
        { action: 'openEmojiPicker', label: 'เปิดอีโมจิ', ...shortcuts.openEmojiPicker },
      ],
    },
    {
      title: 'การนำทาง',
      shortcuts: [
        { action: 'searchConversations', label: 'ค้นหาการสนทนา', ...shortcuts.searchConversations },
        { action: 'navigateUp', label: 'เลื่อนขึ้น', ...shortcuts.navigateUp },
        { action: 'navigateDown', label: 'เลื่อนลง', ...shortcuts.navigateDown },
      ],
    },
    {
      title: 'การจัดการการสนทนา',
      shortcuts: [
        { action: 'markAsResolved', label: 'ปิดงาน', ...shortcuts.markAsResolved },
      ],
    },
    {
      title: 'ความช่วยเหลือ',
      shortcuts: [
        { action: 'showShortcutsHelp', label: 'แสดงคีย์ลัด', ...shortcuts.showShortcutsHelp },
      ],
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            คีย์ลัด (Keyboard Shortcuts)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.action}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                  >
                    <span className="text-sm text-gray-700">
                      {(shortcut as any).label || (shortcut as any).description}
                    </span>
                    <kbd className="px-3 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded-lg shadow-sm">
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="pt-4 border-t">
            <p className="text-xs text-gray-500">
              คำแนะนำ: คุณสามารถปรับแต่งคีย์ลัดเหล่านี้ได้ในเมนูตั้งค่า
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
