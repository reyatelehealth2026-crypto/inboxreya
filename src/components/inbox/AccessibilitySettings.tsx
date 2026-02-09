'use client'

import { useSettingsStore } from '@/stores/settings'
import { useAccessibility } from '@/hooks/useAccessibility'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, Zap, Volume2, Type, Focus, Contrast } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Slider } from '@/components/ui/slider'

export function AccessibilitySettings() {
  const {
    notificationsEnabled,
    soundEnabled,
    screenReaderOptimized,
    updateSettings,
  } = useSettingsStore()
  const {
    fontSize,
    lineSpacing,
    highContrastMode,
    reducedMotion,
    focusIndicators,
    setFontSize,
    setLineSpacing,
    setHighContrastMode,
    setReducedMotion,
    setFocusIndicators,
  } = useAccessibility()
  const { toast } = useToast()

  // handleToggle is no longer needed as settings are updated directly or via useAccessibility setters
  // const handleToggle = (setting: string, value: boolean) => {
  //   updateSettings({ [setting]: value })
  //   toast({
  //     title: 'บันทึกการตั้งค่าแล้ว',
  //     description: `อัปเดตการตั้งค่าการเข้าถึงเรียบร้อยแล้ว`,
  //   })
  // }

  const handleFontSizeChange = (value: string) => {
    setFontSize(value as any) // Cast to any because setFontSize expects a specific type from useAccessibility
    toast({
      title: 'เปลี่ยนขนาดตัวอักษรสำเร็จ',
      description: `ตั้งค่าเป็นขนาด${value === 'small' ? 'เล็ก' : value === 'large' ? 'ใหญ่' : value === 'xlarge' ? 'ใหญ่พิเศษ' : 'ปานกลาง'}แล้ว`,
    })
  }

  return (
    <div className="space-y-6">
      {/* Visual Settings */}
      <Card className="border-2 border-purple-100 dark:border-purple-900 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-purple-600" />
            การแสดงผลและการมองเห็น
          </CardTitle>
          <CardDescription>
            ปรับแต่งการแสดงผลให้เหมาะกับความต้องการของคุณ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* High Contrast Mode */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 border border-purple-200 dark:border-purple-800">
            <div className="space-y-0.5 flex items-center gap-3">
              <Contrast className="h-5 w-5 text-purple-600" />
              <div>
                <Label htmlFor="high-contrast" className="text-base font-semibold">โหมดคอนทราสต์สูง</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  เพิ่มความคมชัดของสีเพื่อการมองเห็นที่ดีขึ้น
                </p>
              </div>
            </div>
            <Switch
              id="high-contrast"
              checked={highContrastMode}
              onCheckedChange={setHighContrastMode}
            />
          </div>

          {/* Font Size */}
          <div className="space-y-3">
            <Label htmlFor="font-size" className="text-base font-semibold flex items-center gap-2">
              <Type className="h-4 w-4" />
              ขนาดตัวอักษร
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => handleFontSizeChange('small')}
                className={`p-4 rounded-lg border-2 transition-all ${fontSize === 'small'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="text-sm font-semibold">เล็ก</div>
                <div className="text-xs text-gray-500 mt-1">14px</div>
              </button>
              <button
                onClick={() => handleFontSizeChange('medium')}
                className={`p-4 rounded-lg border-2 transition-all ${fontSize === 'medium'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="text-base font-semibold">ปานกลาง</div>
                <div className="text-xs text-gray-500 mt-1">16px</div>
              </button>
              <button
                onClick={() => handleFontSizeChange('large')}
                className={`p-4 rounded-lg border-2 transition-all ${fontSize === 'large'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="text-lg font-semibold">ใหญ่</div>
                <div className="text-xs text-gray-500 mt-1">18px</div>
              </button>
              <button
                onClick={() => handleFontSizeChange('xlarge')}
                className={`p-4 rounded-lg border-2 transition-all ${fontSize === 'xlarge'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="text-xl font-semibold">ใหญ่พิเศษ</div>
                <div className="text-xs text-gray-500 mt-1">20px</div>
              </button>
            </div>
          </div>

          {/* Line Spacing */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">ระยะห่างระหว่างบรรทัด</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[lineSpacing]}
                onValueChange={(value) => setLineSpacing(value[0])}
                min={1}
                max={2.5}
                step={0.1}
                className="flex-1"
              />
              <span className="text-sm font-medium w-12 text-right">{lineSpacing.toFixed(1)}</span>
            </div>
            <p className="text-xs text-gray-500">
              ค่าที่แนะนำคือ 1.5 สำหรับการอ่านที่สบายตา
            </p>
          </div>

          {/* Focus Indicators */}
          <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <div className="space-y-0.5 flex items-center gap-3">
              <Focus className="h-5 w-5 text-blue-600" />
              <div>
                <Label htmlFor="focus-indicators" className="text-base font-semibold">ตัวบ่งชี้โฟกัส</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  แสดงกรอบเน้นสีเมื่อโฟกัสที่องค์ประกอบ
                </p>
              </div>
            </div>
            <Switch
              id="focus-indicators"
              checked={focusIndicators}
              onCheckedChange={setFocusIndicators}
            />
          </div>
        </CardContent>
      </Card>

      {/* Motion & Animation */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-600" />
            การเคลื่อนไหวและแอนิเมชัน
          </CardTitle>
          <CardDescription>
            ลดการเคลื่อนไหวสำหรับผู้ที่อ่อนไหวต่อแอนิเมชัน
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Reduced Motion */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 border border-orange-200 dark:border-orange-800">
            <div className="space-y-0.5 flex items-center gap-3">
              <Zap className="h-5 w-5 text-orange-600" />
              <div>
                <Label htmlFor="reduced-motion" className="text-base font-semibold">ลดการเคลื่อนไหว</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  ลดแอนิเมชันและการเปลี่ยนผ่านให้เหลือน้อยที่สุด
                </p>
              </div>
            </div>
            <Switch
              id="reduced-motion"
              checked={reducedMotion}
              onCheckedChange={setReducedMotion}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sound & Notifications */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-green-600" />
            เสียงและการแจ้งเตือน
          </CardTitle>
          <CardDescription>
            จัดการการแจ้งเตือนด้วยเสียงและระบบ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sound Notifications */}
          <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <div className="space-y-0.5 flex items-center gap-3">
              <Volume2 className="h-5 w-5 text-green-600" />
              <div>
                <Label htmlFor="sound-enabled" className="text-base font-semibold">การแจ้งเตือนด้วยเสียง</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  เล่นเสียงเมื่อมีข้อความใหม่
                </p>
              </div>
            </div>
            <Switch
              id="sound-enabled"
              checked={soundEnabled}
              onCheckedChange={(checked) => updateSettings({ soundEnabled: checked })}
            />
          </div>

          {/* Desktop Notifications */}
          <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <div className="space-y-0.5 flex items-center gap-3">
              <Eye className="h-5 w-5 text-blue-600" />
              <div>
                <Label htmlFor="notifications-enabled" className="text-base font-semibold">การแจ้งเตือนเดสก์ท็อป</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  แสดงการแจ้งเตือนบนเดสก์ท็อปสำหรับข้อความใหม่
                </p>
              </div>
            </div>
            <Switch
              id="notifications-enabled"
              checked={notificationsEnabled}
              onCheckedChange={(checked) => updateSettings({ notificationsEnabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Screen Reader */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-indigo-600" />
            Screen Reader
          </CardTitle>
          <CardDescription>
            ปรับให้เหมาะกับโปรแกรมอ่านหน้าจอ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 border border-indigo-200 dark:border-indigo-800">
            <div className="space-y-0.5 flex items-center gap-3">
              <Volume2 className="h-5 w-5 text-indigo-600" />
              <div>
                <Label htmlFor="screen-reader" className="text-base font-semibold">ปรับให้เหมาะกับ Screen Reader</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  เพิ่ม ARIA labels และคำอธิบายเพิ่มเติม
                </p>
              </div>
            </div>
            <Switch
              id="screen-reader"
              checked={screenReaderOptimized}
              onCheckedChange={(checked) => updateSettings({ screenReaderOptimized: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200 dark:border-blue-800 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <Eye className="h-5 w-5" />
            เกี่ยวกับการเข้าถึง
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
          <div className="flex items-start gap-2">
            <div className="mt-0.5">✨</div>
            <p>
              <strong>คุณสมบัติพิเศษ:</strong> การตั้งค่าเหล่านี้ทำงานร่วมกับการตั้งค่าการเข้าถึงของเบราว์เซอร์และระบบปฏิบัติการ
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-0.5">⌨️</div>
            <p>
              <strong>การนำทาง:</strong> ใช้ Tab เพื่อนำทางระหว่างองค์ประกอบ และ Enter/Space เพื่อเลือก
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-0.5">🎯</div>
            <p>
              <strong>ผลลัพธ์ที่ดีที่สุด:</strong> แนะนำให้ตั้งค่าทั้งในระบบและในแอปพลิเคชัน
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
