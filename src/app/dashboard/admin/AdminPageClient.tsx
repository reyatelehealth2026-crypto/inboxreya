"use client"

import { useEffect, useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"

type AdminProfile = {
  id: string
  username: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  role: string | null
  phone: string | null
  isActive: boolean | null
}

export default function AdminPageClient() {
  const { toast } = useToast()
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-profile"],
    queryFn: async () => {
      const response = await fetch("/api/inbox/admins/me")
      if (!response.ok) throw new Error("Failed to fetch admin profile")
      const result = await response.json()
      return result.data as AdminProfile
    },
  })

  const [displayName, setDisplayName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    if (data) {
      setDisplayName(data.displayName || "")
      setAvatarUrl(data.avatarUrl || "")
    }
  }, [data])

  const updateProfile = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/inbox/admins/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          avatarUrl,
          password: password || undefined,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to update profile")
      }
      return response.json()
    },
    onSuccess: () => {
      toast({ title: "บันทึกข้อมูลสำเร็จ" })
      setPassword("")
    },
    onError: (err: Error) => {
      toast({ title: "บันทึกข้อมูลไม่สำเร็จ", description: err.message, variant: "destructive" })
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          ไม่สามารถโหลดข้อมูลผู้ใช้งานได้
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ผู้ที่ล็อคอินอยู่</h1>
        <p className="text-sm text-muted-foreground">จัดการข้อมูลผู้ใช้งานของคุณ</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={data.avatarUrl || undefined} alt={data.displayName || data.username} />
            <AvatarFallback>{(data.displayName || data.username).slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg">{data.displayName || data.username}</CardTitle>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>{data.email}</span>
              <Badge variant="secondary">{data.role || "admin"}</Badge>
              <Badge variant={data.isActive ? "default" : "destructive"}>
                {data.isActive ? "active" : "inactive"}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">แก้ไขข้อมูลผู้ใช้</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">ชื่อที่แสดง</label>
            <Input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="ชื่อที่แสดง"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">ลิงก์อวาตาร์</label>
            <Input
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://example.com/avatar.png"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">รหัสผ่านใหม่</label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="อย่างน้อย 6 ตัวอักษร"
            />
          </div>
          <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
            บันทึกข้อมูล
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
