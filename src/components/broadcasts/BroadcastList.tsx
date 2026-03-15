'use client'

import { useState } from 'react'
import { Broadcast } from '@/types/broadcast'
import { useBroadcasts, useCancelBroadcast, useBroadcastStats } from '@/hooks/use-broadcasts'
import { CreateBroadcastDialog } from './CreateBroadcastDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { 
  Plus, 
  Send, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  MoreVertical, 
  Users, 
  BarChart3,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

const statusConfig = {
  draft: { label: 'ฉบับร่าง', color: 'bg-gray-100 text-gray-700', icon: Clock },
  scheduled: { label: 'ตั้งเวลา', color: 'bg-blue-100 text-blue-700', icon: Clock },
  sending: { label: 'กำลังส่ง', color: 'bg-yellow-100 text-yellow-700', icon: Loader2 },
  sent: { label: 'ส่งแล้ว', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  failed: { label: 'ล้มเหลว', color: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { label: 'ยกเลิก', color: 'bg-gray-100 text-gray-500', icon: XCircle },
}

export function BroadcastList() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [page, setPage] = useState(1)
  const limit = 10
  
  const { data: broadcastsData, isLoading } = useBroadcasts({ 
    page, 
    limit,
    status: activeTab === 'all' ? undefined : activeTab 
  })
  const { data: statsData } = useBroadcastStats()
  const cancelBroadcast = useCancelBroadcast()
  
  const broadcasts = broadcastsData?.data?.broadcasts || []
  const pagination = broadcastsData?.data?.pagination
  const stats = statsData?.data
  
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Send className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Broadcast ทั้งหมด</p>
                <p className="text-2xl font-bold">{stats.totalBroadcasts}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ส่งวันนี้</p>
                <p className="text-2xl font-bold">{stats.sentToday}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">รอส่ง</p>
                <p className="text-2xl font-bold">{stats.scheduledCount}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">สำเร็จ</p>
                <p className="text-2xl font-bold">{stats.avgSuccessRate}%</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Main Content */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Broadcast Messages</CardTitle>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            สร้าง Broadcast
          </Button>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
              <TabsTrigger value="scheduled">รอส่ง</TabsTrigger>
              <TabsTrigger value="sent">ส่งแล้ว</TabsTrigger>
              <TabsTrigger value="failed">ล้มเหลว</TabsTrigger>
            </TabsList>
            
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ข้อความ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ผู้รับ</TableHead>
                    <TableHead>อัตราสำเร็จ</TableHead>
                    <TableHead>สร้างเมื่อ</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : broadcasts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>ไม่มี Broadcast</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    broadcasts.map((broadcast: Broadcast) => {
                      const status = statusConfig[broadcast.status]
                      const StatusIcon = status.icon
                      const successRate = broadcast.totalRecipients > 0 
                        ? Math.round((broadcast.successCount / broadcast.totalRecipients) * 100)
                        : 0
                      
                      return (
                        <TableRow key={broadcast.id}>
                          <TableCell className="max-w-[200px]">
                            <p className="truncate font-medium">
                              {broadcast.content || 'Flex Message'}
                            </p>
                            {broadcast.scheduledAt && broadcast.status === 'scheduled' && (
                              <p className="text-xs text-muted-foreground">
                                จะส่ง: {format(new Date(broadcast.scheduledAt), 'PPp', { locale: th })}
                              </p>
                            )}
                          </TableCell>
                          
                          <TableCell>
                            <Badge className={cn("flex items-center gap-1 w-fit", status.color)}>
                              <StatusIcon className={cn("w-3 h-3", broadcast.status === 'sending' && 'animate-spin')} />
                              {status.label}
                            </Badge>
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-muted-foreground" />
                              <span>{broadcast.totalRecipients.toLocaleString()}</span>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            {broadcast.status === 'sent' || broadcast.status === 'sending' ? (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-green-500 transition-all"
                                    style={{ width: `${successRate}%` }}
                                  />
                                </div>
                                <span className="text-sm">{successRate}%</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(broadcast.createdAt), 'PP', { locale: th })}
                            </span>
                          </TableCell>
                          
                          <TableCell>
                            {broadcast.status === 'scheduled' && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    onClick={() => cancelBroadcast.mutate(broadcast.id)}
                                    className="text-destructive"
                                  >
                                    ยกเลิก
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
            
            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                    <PaginationItem key={p}>
                      <PaginationLink 
                        isActive={page === p}
                        onClick={() => setPage(p)}
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                      className={page === pagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </Tabs>
        </CardContent>
      </Card>
      
      <CreateBroadcastDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  )
}
