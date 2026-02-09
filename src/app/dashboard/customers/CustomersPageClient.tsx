"use client"

import { useMemo, useState } from "react"
import { useConversations } from "@/hooks/use-conversations"
import { useTags } from "@/hooks/use-tags"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MessageSquare, User } from "lucide-react"
import { useAssignees } from "@/hooks/use-assignees"

export default function CustomersPageClient() {
  const { data, isLoading, error } = useConversations()
  const { data: tags } = useTags()
  const { data: assignees } = useAssignees()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const items = Array.isArray(data?.data) ? data.data : []
    const q = query.toLowerCase()
    return items.filter((conversation) => {
      const name = conversation.user.displayName || ""
      const phone = conversation.user.phone || ""
      const email = conversation.user.email || ""
      const matchesTag =
        !selectedTagId ||
        conversation.tags?.some((tag) => tag.id === selectedTagId)
      const matchesAssignee =
        !selectedAssigneeId ||
        conversation.assignees?.some((assignee) => assignee.id === selectedAssigneeId)
      const matchesQuery =
        !q ||
        name.toLowerCase().includes(q) ||
        phone.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q)
      return matchesTag && matchesAssignee && matchesQuery
    })
  }, [data?.data, query, selectedTagId, selectedAssigneeId])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          ไม่สามารถโหลดรายชื่อลูกค้าได้
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold">รายชื่อลูกค้า</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/inbox/auto-tags">จัดการแท็ก</Link>
            </Button>
            <Button variant="outline" disabled>
              เพิ่มลูกค้า
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            className="w-full sm:max-w-xs"
            placeholder="ค้นหาชื่อลูกค้า เบอร์โทร หรืออีเมล"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex gap-2">
            {/* Assignee Filter */}
            <select
              className="h-8 w-[160px] rounded-md border border-input bg-background px-2 text-xs"
              value={selectedAssigneeId || ""}
              onChange={(e) => setSelectedAssigneeId(e.target.value || null)}
            >
              <option value="">ผู้ดูแลทั้งหมด</option>
              {Array.isArray(assignees) && assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.displayName || assignee.username}
                </option>
              ))}
            </select>

            {/* Tag Filter */}
            <select
              className="h-8 w-[160px] rounded-md border border-input bg-background px-2 text-xs"
              value={selectedTagId || ""}
              onChange={(e) => setSelectedTagId(e.target.value || null)}
            >
              <option value="">แท็กทั้งหมด</option>
              {(Array.isArray(tags) ? tags : []).map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((conversation) => (
          <Card key={conversation.id}>
            <CardContent className="py-3 px-6">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4">
                {/* Avatar + Name */}
                <div className="flex items-center gap-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={conversation.user.pictureUrl || undefined}
                      alt={conversation.user.displayName || "ลูกค้า"}
                    />
                    <AvatarFallback>
                      {(conversation.user.displayName || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">{conversation.user.displayName || "ไม่ระบุชื่อ"}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                      <span><span className="text-blue-600">โทร:</span> {conversation.user.phone || "-"}</span>
                      <span><span className="text-purple-600">อีเมล:</span> {conversation.user.email || "-"}</span>
                      <span><span className="text-green-600">สถานะ:</span> {conversation.status}</span>
                    </div>
                  </div>
                </div>

                {/* Assignee */}
                <div className="flex items-center gap-2 text-xs">
                  {conversation.assignees && conversation.assignees.length > 0 ? (
                    <>
                      <span className="text-orange-600 font-medium">ผู้ดูแล:</span>
                      <div className="flex flex-wrap gap-1">
                        {conversation.assignees.map((assignee) => (
                          <Badge
                            key={assignee.id}
                            variant="secondary"
                            className="text-[10px] px-2 py-0.5"
                          >
                            {assignee.displayName || assignee.username}
                          </Badge>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 max-w-[300px]">
                  {conversation.tags && Array.isArray(conversation.tags) && conversation.tags.length > 0 && (
                    conversation.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        className="text-[10px] px-2 py-0.5"
                        style={{
                          backgroundColor: tag.color || "#E2E8F0",
                          color: "#0F172A",
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))
                  )}
                </div>

                {/* Chat Button */}
                <Button
                  size="sm"
                  className="h-8 gap-2 bg-[#0C665D] hover:bg-[#0a5048]"
                  onClick={() => router.push(`/inbox?selected=${conversation.id}`)}
                >
                  <MessageSquare className="h-4 w-4" />
                  สนทนา
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div >
  )
}
