'use client'

import { useSettingsStore } from '@/stores/settings'
import { useNotifications } from '@/hooks/useNotifications'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bell, Volume2, Mail, Smartphone, AlertCircle, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

export function NotificationSettings() {
    const {
        notificationsEnabled,
        soundEnabled,
        notificationVolume,
        emailNotifications,
        pushNotifications,
        notificationPriority,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd,
        updateSettings,
    } = useSettingsStore()
    const { requestPermission, testNotification } = useNotifications()
    const { toast } = useToast()

    const handleVolumeChange = (value: number[]) => {
        updateSettings({ notificationVolume: value[0] })
    }

    const handleTestNotification = () => {
        testNotification()
    }

    const handleRequestPermission = async () => {
        const granted = await requestPermission()
        if (granted) {
            toast({
                title: 'สำเร็จ!',
                description: 'คุณได้อนุญาตให้แสดงการแจ้งเตือนแล้ว',
            })
        } else {
            toast({
                title: 'ไม่สามารถเปิดการแจ้งเตือนได้',
                description: 'กรุณาอนุญาตการแจ้งเตือนในการตั้งค่าเบราว์เซอร์',
                variant: 'destructive',
            })
        }
    }

    return (
        <div className="space-y-6">
            {/* Main Notification Settings */}
            <Card className="border-2 border-blue-100 dark:border-blue-900 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-blue-600" />
                        การตั้งค่าการแจ้งเตือนหลัก
                    </CardTitle>
                    <CardDescription>
                        จัดการวิธีการรับการแจ้งเตือนจากระบบ
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Browser Notifications */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border border-blue-200 dark:border-blue-800">
                        <div className="space-y-0.5 flex items-center gap-3">
                            <Smartphone className="h-5 w-5 text-blue-600" />
                            <div>
                                <Label htmlFor="browser-notifications" className="text-base font-semibold">การแจ้งเตือนเดสก์ท็อป</Label>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    แสดงการแจ้งเตือนบนเดสก์ท็อปเมื่อมีข้อความใหม่
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="browser-notifications"
                            checked={notificationsEnabled}
                            onCheckedChange={(checked) => updateSettings({ notificationsEnabled: checked })}
                        />
                    </div>

                    {/* Sound Notifications */}
                    <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="space-y-0.5 flex items-center gap-3">
                            <Volume2 className="h-5 w-5 text-green-600" />
                            <div>
                                <Label htmlFor="sound-notifications" className="text-base font-semibold">เสียงแจ้งเตือน</Label>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    เล่นเสียงเมื่อมีข้อความใหม่
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="sound-notifications"
                            checked={soundEnabled}
                            onCheckedChange={(checked) => updateSettings({ soundEnabled: checked })}
                        />
                    </div>

                    {/* Volume Control */}
                    {soundEnabled && (
                        <div className="pl-12 space-y-2 animate-in slide-in-from-left">
                            <Label className="text-sm">ระดับเสียง</Label>
                            <div className="flex items-center gap-4">
                                <Slider
                                    value={[notificationVolume]}
                                    onValueChange={handleVolumeChange}
                                    max={100}
                                    step={1}
                                    className="flex-1"
                                />
                                <span className="text-sm font-medium w-12 text-right">{notificationVolume}%</span>
                            </div>
                        </div>
                    )}

                    {/* Email Notifications */}
                    <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="space-y-0.5 flex items-center gap-3">
                            <Mail className="h-5 w-5 text-purple-600" />
                            <div>
                                <Label htmlFor="email-notifications" className="text-base font-semibold">การแจ้งเตือนทางอีเมล</Label>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    ส่งอีเมลสรุปข้อความที่ยังไม่ได้อ่าน
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="email-notifications"
                            checked={emailNotifications}
                            onCheckedChange={(checked) => updateSettings({ emailNotifications: checked })}
                        />
                    </div>

                    {/* Push Notifications */}
                    <div className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="space-y-0.5 flex items-center gap-3">
                            <Smartphone className="h-5 w-5 text-orange-600" />
                            <div>
                                <Label htmlFor="push-notifications" className="text-base font-semibold">Push Notifications</Label>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    แจ้งเตือนผ่านแอปมือถือ (ถ้ามี)
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="push-notifications"
                            checked={pushNotifications}
                            onCheckedChange={(checked) => updateSettings({ pushNotifications: checked })}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Advanced Settings */}
            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-orange-600" />
                        การตั้งค่าขั้นสูง
                    </CardTitle>
                    <CardDescription>
                        กำหนดเงื่อนไขและความสำคัญของการแจ้งเตือน
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Notification Priority */}
                    <div className="space-y-3">
                        <Label htmlFor="priority" className="text-base font-semibold">ระดับความสำคัญของการแจ้งเตือน</Label>
                        <Select value={notificationPriority} onValueChange={(value: any) => updateSettings({ notificationPriority: value })}>
                            <SelectTrigger id="priority" className="w-full">
                                <SelectValue placeholder="เลือกระดับความสำคัญ" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">ทั้งหมด</SelectItem>
                                <SelectItem value="assigned">มอบหมายให้ฉัน</SelectItem>
                                <SelectItem value="mentions">ที่กล่าวถึงฉัน</SelectItem>
                                <SelectItem value="urgent">เร่งด่วนเท่านั้น</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                            กำหนดว่าข้อความแบบไหนควรแจ้งเตือนคุณ
                        </p>
                    </div>

                    {/* Quiet Hours */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-indigo-600" />
                                <Label htmlFor="quiet-hours" className="text-base font-semibold">โหมดเงียบ (Quiet Hours)</Label>
                            </div>
                            <Switch
                                id="quiet-hours"
                                checked={quietHoursEnabled}
                                onCheckedChange={(checked) => updateSettings({ quietHoursEnabled: checked })}
                            />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            ปิดการแจ้งเตือนในช่วงเวลาที่กำหนด
                        </p>

                        {quietHoursEnabled && (
                            <div className="pl-7 space-y-3 animate-in slide-in-from-left">
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <Label className="text-sm">เริ่มเวลา</Label>
                                        <Select value={quietHoursStart} onValueChange={(value) => updateSettings({ quietHoursStart: value })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="20:00">20:00</SelectItem>
                                                <SelectItem value="21:00">21:00</SelectItem>
                                                <SelectItem value="22:00">22:00</SelectItem>
                                                <SelectItem value="23:00">23:00</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex-1">
                                        <Label className="text-sm">สิ้นสุดเวลา</Label>
                                        <Select value={quietHoursEnd} onValueChange={(value) => updateSettings({ quietHoursEnd: value })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="06:00">06:00</SelectItem>
                                                <SelectItem value="07:00">07:00</SelectItem>
                                                <SelectItem value="08:00">08:00</SelectItem>
                                                <SelectItem value="09:00">09:00</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Test Notifications */}
            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-amber-200 dark:border-amber-800 shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                        <Bell className="h-5 w-5" />
                        ทดสอบการแจ้งเตือน
                    </CardTitle>
                    <CardDescription className="text-amber-700 dark:text-amber-300">
                        ทดสอบว่าการแจ้งเตือนทำงานถูกต้องหรือไม่
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button onClick={handleTestNotification} className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                            <Bell className="h-4 w-4 mr-2" />
                            ทดสอบการแจ้งเตือน
                        </Button>
                        <Button
                            onClick={handleRequestPermission}
                            variant="outline"
                            className="flex-1 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900"
                        >
                            <AlertCircle className="h-4 w-4 mr-2" />
                            อนุญาตการแจ้งเตือน
                        </Button>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900 p-3 rounded-lg">
                        <strong>หมายเหตุ:</strong> หากไม่เห็นการแจ้งเตือนบนเดสก์ท็อป กรุณาคลิก "อนุญาตการแจ้งเตือน" และอนุญาตในการตั้งค่าเบราว์เซอร์
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
