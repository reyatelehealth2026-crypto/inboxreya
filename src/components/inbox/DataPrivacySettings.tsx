'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Shield, Download, Upload, Trash2, Database, Lock, Eye, Archive, HardDrive } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useSettingsStore } from '@/stores/settings'

export function DataPrivacySettings() {
    const {
        dataCollection,
        analyticsEnabled,
        chatHistory,
        autoDeleteOldData,
        exportSettings,
        importSettings,
        clearCache,
        deleteAllData,
        updateSettings,
    } = useSettingsStore()
    const { toast } = useToast()
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)

    const handleExportData = () => {
        try {
            const jsonStr = exportSettings()
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr)
            const exportFileDefaultName = `inbox-settings-${new Date().toISOString().split('T')[0]}.json`

            const linkElement = document.createElement('a')
            linkElement.setAttribute('href', dataUri)
            linkElement.setAttribute('download', exportFileDefaultName)
            linkElement.click()

            toast({
                title: 'ส่งออกข้อมูลสำเร็จ',
                description: 'ไฟล์การตั้งค่าถูกดาวน์โหลดแล้ว',
            })
        } catch (error) {
            toast({
                title: 'ล้มเหลว',
                description: 'ไม่สามารถส่งออกข้อมูลได้',
                variant: 'destructive',
            })
        }
    }

    const handleImportData = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'application/json'

        input.onchange = (e) => {
            const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0]
                if (!file) return

                const reader = new FileReader()
                reader.onload = (e) => {
                    try {
                        const content = e.target?.result as string
                        const success = importSettings(content)
                        if (success) {
                            toast({
                                title: 'นำเข้าข้อมูลสำเร็จ',
                                description: 'การตั้งค่าถูกกู้คืนแล้ว',
                            })
                        } else {
                            throw new Error('Import failed')
                        }
                    } catch (error) {
                        toast({
                            title: 'นำเข้าล้มเหลว',
                            description: 'ไฟล์ไม่ถูกต้องหรือเสียหาย',
                            variant: 'destructive',
                        })
                    }
                }
                reader.readAsText(file)
            }
            handleImportData(e as unknown as React.ChangeEvent<HTMLInputElement>) // Cast to match expected type
        }

        input.click()
    }

    const handleClearCache = () => {
        clearCache()
        toast({
            title: 'ล้างแคชสำเร็จ',
            description: 'ข้อมูลแคชถูกล้างแล้ว',
        })
    }

    const handleDeleteAllData = () => {
        setShowDeleteDialog(false)
        deleteAllData()
    }

    return (
        <div className="space-y-6">
            {/* Privacy Settings */}
            <Card className="border-2 border-purple-100 dark:border-purple-900 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-purple-600" />
                        การตั้งค่าความเป็นส่วนตัว
                    </CardTitle>
                    <CardDescription>
                        จัดการความเป็นส่วนตัวและการเก็บรักษาข้อมูลของคุณ
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Data Collection */}
                    <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="space-y-0.5 flex items-center gap-3">
                            <Database className="h-5 w-5 text-blue-600" />
                            <div>
                                <Label htmlFor="data-collection" className="text-base font-semibold">การเก็บข้อมูลเพื่อปรับปรุง</Label>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    อนุญาตให้เก็บข้อมูลการใช้งานเพื่อปรับปรุงประสบการณ์
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="data-collection"
                            checked={dataCollection}
                            onCheckedChange={(checked) => updateSettings({ dataCollection: checked })}
                        />
                    </div>

                    {/* Analytics */}
                    <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="space-y-0.5 flex items-center gap-3">
                            <Eye className="h-5 w-5 text-green-600" />
                            <div>
                                <Label htmlFor="analytics" className="text-base font-semibold">Analytics และการติดตาม</Label>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    เปิดใช้งานการวิเคราะห์สถิติการใช้งาน
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="analytics"
                            checked={analyticsEnabled}
                            onCheckedChange={(checked) => updateSettings({ analyticsEnabled: checked })}
                        />
                    </div>

                    {/* Chat History */}
                    <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="space-y-0.5 flex items-center gap-3">
                            <Archive className="h-5 w-5 text-purple-600" />
                            <div>
                                <Label htmlFor="chat-history" className="text-base font-semibold">บันทึกประวัติการสนทนา</Label>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    เก็บประวัติการสนทนาในเครื่อง
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="chat-history"
                            checked={chatHistory}
                            onCheckedChange={(checked) => updateSettings({ chatHistory: checked })}
                        />
                    </div>

                    {/* Auto Delete */}
                    <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="space-y-0.5 flex items-center gap-3">
                            <Trash2 className="h-5 w-5 text-red-600" />
                            <div>
                                <Label htmlFor="auto-delete" className="text-base font-semibold">ลบข้อมูลเก่าอัตโนมัติ</Label>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    ลบการสนทนาที่เก่ากว่า 90 วันอัตโนมัติ
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="auto-delete"
                            checked={autoDeleteOldData}
                            onCheckedChange={(checked) => updateSettings({ autoDeleteOldData: checked })}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Data Management */}
            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <HardDrive className="h-5 w-5 text-blue-600" />
                        การจัดการข้อมูล
                    </CardTitle>
                    <CardDescription>
                        ส่งออก นำเข้า หรือลบข้อมูลของคุณ
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Export/Import */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                            variant="outline"
                            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-950 border-2 border-blue-200 dark:border-blue-800"
                            onClick={handleExportData}
                        >
                            <Download className="h-6 w-6 text-blue-600" />
                            <div className="text-center">
                                <div className="font-semibold">ส่งออกข้อมูล</div>
                                <div className="text-xs text-gray-500">ดาวน์โหลดการตั้งค่าทั้งหมด</div>
                            </div>
                        </Button>

                        <Button
                            variant="outline"
                            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-green-50 dark:hover:bg-green-950 border-2 border-green-200 dark:border-green-800"
                            onClick={handleImportData}
                        >
                            <Upload className="h-6 w-6 text-green-600" />
                            <div className="text-center">
                                <div className="font-semibold">นำเข้าข้อมูล</div>
                                <div className="text-xs text-gray-500">กู้คืนการตั้งค่าจากไฟล์</div>
                            </div>
                        </Button>
                    </div>

                    {/* Clear Cache */}
                    <Button
                        variant="outline"
                        className="w-full h-auto py-4 flex items-center justify-center gap-3 hover:bg-orange-50 dark:hover:bg-orange-950 border-2 border-orange-200 dark:border-orange-800"
                        onClick={handleClearCache}
                    >
                        <Database className="h-5 w-5 text-orange-600" />
                        <div className="text-center">
                            <div className="font-semibold">ล้างแคช</div>
                            <div className="text-xs text-gray-500">ลบข้อมูลแคชที่ไม่จำเป็น</div>
                        </div>
                    </Button>

                    {/* Delete All Data - With Confirmation */}
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="outline"
                                className="w-full h-auto py-4 flex items-center justify-center gap-3 hover:bg-red-50 dark:hover:bg-red-950 border-2 border-red-200 dark:border-red-800 text-red-600"
                            >
                                <Trash2 className="h-5 w-5" />
                                <div className="text-center">
                                    <div className="font-semibold">ลบข้อมูลทั้งหมด</div>
                                    <div className="text-xs text-gray-500">ลบข้อมูลและการตั้งค่าทั้งหมดจากเครื่อง</div>
                                </div>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                    <Shield className="h-5 w-5" />
                                    คุณแน่ใจหรือไม่?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="space-y-2">
                                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                                        การดำเนินการนี้จะลบข้อมูลต่อไปนี้:
                                    </p>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                        <li>การตั้งค่าทั้งหมด</li>
                                        <li>ประวัติการสนทนาที่บันทึกไว้</li>
                                        <li>คีย์ลัดและข้อความอัตโนมัติ</li>
                                        <li>ข้อมูลแคชทั้งหมด</li>
                                    </ul>
                                    <p className="text-red-600 font-semibold mt-4">
                                        ⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้!
                                    </p>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDeleteAllData}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    ยืนยันการลบ
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>

            {/* Security Info */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800 shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                        <Shield className="h-5 w-5" />
                        ข้อมูลด้านความปลอดภัย
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                    <div className="flex items-start gap-2">
                        <div className="mt-0.5">🔒</div>
                        <p>
                            <strong>การเข้ารหัส:</strong> ข้อมูลทั้งหมดถูกเข้ารหัสด้วย HTTPS และ TLS 1.3
                        </p>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="mt-0.5">💾</div>
                        <p>
                            <strong>การจัดเก็บ:</strong> การตั้งค่าถูกเก็บในเครื่องของคุณเท่านั้น (Local Storage)
                        </p>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="mt-0.5">🔐</div>
                        <p>
                            <strong>ข้อมูลส่วนบุคคล:</strong> เราไม่มีการแชร์หรือขายข้อมูลของคุณให้บุคคลที่สาม
                        </p>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="mt-0.5">⏰</div>
                        <p>
                            <strong>การเก็บรักษา:</strong> ข้อมูลจะถูกเก็บไว้ตามระยะเวลาที่คุณกำหนด หรือจนกว่าคุณจะลบ
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
