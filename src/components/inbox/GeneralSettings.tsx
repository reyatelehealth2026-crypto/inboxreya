'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings, FastForward, Filter, Sun, Moon, Globe, Layout, RefreshCw, Zap } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'

export function GeneralSettings() {
    const {
        autoAdvance,
        defaultFilter,
        theme,
        language,
        compactMode,
        autoRefresh,
        refreshInterval,
        updateSettings,
    } = useSettingsStore()
    const { toast } = useToast()

    const handleToggle = (setting: string, value: boolean) => {
        updateSettings({ [setting]: value })
        toast({
            title: 'บันทึกการตั้งค่าแล้ว',
            description: `อัปเดตการตั้งค่าเรียบร้อยแล้ว`,
        })
    }

    const handleSelect = (setting: string, value: string) => {
        updateSettings({ [setting]: value })
        toast({
            title: 'บันทึกการตั้งค่าแล้ว',
            description: `อัปเดตการตั้งค่าเรียบร้อยแล้ว`,
        })
    }

    const handleThemeChange = (value: 'light' | 'dark' | 'auto') => {
        updateSettings({ theme: value })
        toast({
            title: 'เปลี่ยนธีมสำเร็จ',
            description: `เปลี่ยนเป็นธีม ${value === 'light' ? 'สว่าง' : value === 'dark' ? 'มืด' : 'อัตโนมัติ'} แล้ว`,
        })
    }

    const handleLanguageChange = (value: 'th' | 'en' | 'zh' | 'ja') => {
        updateSettings({ language: value })
        toast({
            title: 'เปลี่ยนภาษาสำเร็จ',
            description: 'ภาษาถูกเปลี่ยนแล้ว (รีเฟรชหน้าเพื่อใช้งาน)',
        })
    }

    const handleCompactModeChange = (checked: boolean) => {
        updateSettings({ compactMode: checked })
        if (checked) {
            document.body.classList.add('compact-mode')
        } else {
            document.body.classList.remove('compact-mode')
        }
        toast({
            title: checked ? 'เปิดโหมดกระทัดรัด' : 'ปิดโหมดกระทัดรัด',
            description: 'การตั้งค่าถูกบันทึกแล้ว',
        })
    }

    // Apply theme on mount and when it changes
    useEffect(() => {
        const root = document.documentElement

        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            if (prefersDark) {
                root.classList.add('dark')
            } else {
                root.classList.remove('dark')
            }
        } else if (theme === 'dark') {
            root.classList.add('dark')
        } else {
            root.classList.remove('dark')
        }
    }, [theme])

    // Apply compact mode on mount
    useEffect(() => {
        if (compactMode) {
            document.body.classList.add('compact-mode')
        } else {
            document.body.classList.remove('compact-mode')
        }
    }, [compactMode])

    return (
        <div className="space-y-6">
            {/* Appearance Settings */}
            <Card className="border-2 border-indigo-100 dark:border-indigo-900 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sun className="h-5 w-5 text-indigo-600" />
                        รูปแบบการแสดงผล
                    </CardTitle>
                    <CardDescription>
                        ปรับแต่งธีมและการแสดงผลของระบบ
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Compact Mode */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 border border-purple-200 dark:border-purple-800">
                        <div className="space-y-0.5 flex items-center gap-3">
                            <Layout className="h-5 w-5 text-purple-600" />
                            <div>
                                <Label htmlFor="compact-mode" className="text-base font-semibold">โหมดกระทัดรัด</Label>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    แสดงข้อมูลแบบกระชับ เหมาะสำหรับหน้าจอเล็ก
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="compact-mode"
                            checked={compactMode}
                            onCheckedChange={handleCompactModeChange}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Behavior Settings */}
            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-blue-600" />
                        พฤติกรรมการทำงาน
                    </CardTitle>
                    <CardDescription>
                        ปรับแต่งพฤติกรรมการทำงานของระบบอินบ็อกซ์
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Auto Advance */}
                    <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="space-y-0.5 flex items-center gap-3">
                            <FastForward className="h-5 w-5 text-green-600" />
                            <div>
                                <Label htmlFor="auto-advance" className="text-base font-semibold">เปลี่ยนแชทถัดไปอัตโนมัติ</Label>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    เมื่อกด &quot;ปิดงาน&quot; (Mark as Resolved) จะเปลี่ยนไปแชทถัดไปทันที
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="auto-advance"
                            checked={autoAdvance}
                            onCheckedChange={(checked) => handleToggle('autoAdvance', checked)}
                        />
                    </div>

                    {/* Auto Refresh */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <div className="space-y-0.5 flex items-center gap-3">
                                <RefreshCw className="h-5 w-5 text-blue-600" />
                                <div>
                                    <Label htmlFor="auto-refresh" className="text-base font-semibold">รีเฟรชอัตโนมัติ</Label>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        อัปเดตข้อมูลแชทอัตโนมัติเป็นระยะ
                                    </p>
                                </div>
                            </div>
                            <Switch
                                id="auto-refresh"
                                checked={autoRefresh}
                                onCheckedChange={(checked) => updateSettings({ autoRefresh: checked })}
                            />
                        </div>

                        {autoRefresh && (
                            <div className="pl-12 animate-in slide-in-from-left">
                                <Label className="text-sm">ช่วงเวลารีเฟรช</Label>
                                <Select value={refreshInterval.toString()} onValueChange={(value) => updateSettings({ refreshInterval: parseInt(value) })}>
                                    <SelectTrigger className="w-full mt-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">ทุก 10 วินาที</SelectItem>
                                        <SelectItem value="30">ทุก 30 วินาที (แนะนำ)</SelectItem>
                                        <SelectItem value="60">ทุก 1 นาที</SelectItem>
                                        <SelectItem value="300">ทุก 5 นาที</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {/* Default Filter */}
                    <div className="space-y-3">
                        <Label htmlFor="default-filter" className="text-base font-semibold flex items-center gap-2">
                            <Filter className="h-4 w-4 text-orange-600" />
                            ตัวกรองเริ่มต้น
                        </Label>
                        <Select
                            value={defaultFilter}
                            onValueChange={(value) => handleSelect('defaultFilter', value)}
                        >
                            <SelectTrigger id="default-filter">
                                <SelectValue placeholder="เลือกตัวกรอง" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">📬 ทั้งหมด</SelectItem>
                                <SelectItem value="unread">📩 ยังไม่อ่าน</SelectItem>
                                <SelectItem value="assigned">👤 งานของฉัน</SelectItem>
                                <SelectItem value="urgent">🚨 ด่วน</SelectItem>
                                <SelectItem value="starred">⭐ ที่ติดดาว</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                            เลือกมุมมองที่ต้องการเห็นเป็นอันดับแรกเมื่อเข้าใช้งาน
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Performance Tips */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800 shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
                        <Zap className="h-5 w-5" />
                        เคล็ดลับเพื่อประสิทธิภาพ
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-green-800 dark:text-green-200">
                    <div className="flex items-start gap-2">
                        <div className="mt-0.5">💡</div>
                        <p>
                            <strong>Auto-Advance:</strong> เปิดใช้งานเพื่อตอบแชทได้รวดเร็วขึ้นเมื่อมีข้อความจำนวนมาก
                        </p>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="mt-0.5">⚡</div>
                        <p>
                            <strong>Compact Mode:</strong> ช่วยประหยัดพื้นที่หน้าจอและลดการใช้หน่วยความจำ
                        </p>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="mt-0.5">🔄</div>
                        <p>
                            <strong>Auto-Refresh:</strong> ตั้งค่าเป็น 30 วินาทีเพื่อสมดุลระหว่างความสดใหม่ของข้อมูลและประสิทธิภาพ
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
