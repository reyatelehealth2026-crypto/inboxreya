'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, Send, Timer } from 'lucide-react';

interface BroadcastItem {
  id: number;
  content: string;
  mediaUrl?: string | null;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  totalRecipients: number;
  createdAt: string;
  scheduledAt?: string | null;
}

interface BroadcastResponse {
  success: boolean;
  data: {
    broadcasts: BroadcastItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
}

function StatusBadge({ status }: { status: BroadcastItem['status'] }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    scheduled: 'bg-blue-100 text-blue-700',
    sent: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-rose-100 text-rose-700',
  };
  return <Badge className={styles[status] || styles.draft}>{status}</Badge>;
}

export default function BroadcastsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<BroadcastItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [open, setOpen] = useState(false);

  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [targetMode, setTargetMode] = useState<'all' | 'custom'>('all');
  const [targetCustomerIds, setTargetCustomerIds] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

  const canSubmit = useMemo(() => content.trim().length > 0, [content]);

  const fetchBroadcasts = async (currentPage: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inbox/broadcasts?page=${currentPage}&limit=20`);
      if (!res.ok) throw new Error('Failed to load broadcasts');
      const data: BroadcastResponse = await res.json();
      if (data.success) {
        setItems(data.data.broadcasts);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcasts(page);
  }, [page]);

  const resetForm = () => {
    setContent('');
    setMediaUrl('');
    setTargetMode('all');
    setTargetCustomerIds('');
    setScheduleMode('now');
    setScheduledAt('');
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    const payload: any = {
      content,
      mediaUrl: mediaUrl || undefined,
    };

    if (targetMode === 'custom') {
      const ids = targetCustomerIds
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((v) => !Number.isNaN(v));
      if (ids.length > 0) payload.targetCustomerIds = ids;
    }

    if (scheduleMode === 'scheduled' && scheduledAt) {
      payload.scheduledAt = new Date(scheduledAt).toISOString();
    }

    try {
      const res = await fetch('/api/inbox/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create broadcast');
      await fetchBroadcasts(1);
      setPage(1);
      setOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A8A]">Broadcast Center</h1>
          <p className="text-sm text-gray-500">จัดการการส่งข้อความแบบกลุ่ม</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              สร้าง Broadcast
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>สร้าง Broadcast ใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>ข้อความ</Label>
                <Textarea
                  rows={5}
                  placeholder="พิมพ์ข้อความที่ต้องการส่ง"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Media URL (ไม่บังคับ)</Label>
                <Input
                  placeholder="https://..."
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>กลุ่มเป้าหมาย</Label>
                  <Select value={targetMode} onValueChange={(value) => setTargetMode(value as 'all' | 'custom')}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกกลุ่มเป้าหมาย" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="custom">ระบุลูกค้า</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>เวลาในการส่ง</Label>
                  <Select value={scheduleMode} onValueChange={(value) => setScheduleMode(value as 'now' | 'scheduled')}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกเวลา" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="now">ส่งทันที</SelectItem>
                      <SelectItem value="scheduled">ตั้งเวลา</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {targetMode === 'custom' && (
                <div className="space-y-2">
                  <Label>Customer IDs (คั่นด้วย ,)</Label>
                  <Input
                    placeholder="เช่น 12, 45, 91"
                    value={targetCustomerIds}
                    onChange={(e) => setTargetCustomerIds(e.target.value)}
                  />
                </div>
              )}

              {scheduleMode === 'scheduled' && (
                <div className="space-y-2">
                  <Label>กำหนดเวลา</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleCreate} disabled={!canSubmit} className="gap-2">
                  {scheduleMode === 'scheduled' ? <Timer className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  สร้าง Broadcast
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <Card className="border-blue-100">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>รายการ Broadcast</CardTitle>
          <span className="text-xs text-gray-400">หน้า {page} / {totalPages}</span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ข้อความ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ผู้รับ</TableHead>
                    <TableHead>เวลา</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-[280px] truncate">{item.content}</TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell>{item.totalRecipients}</TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {item.scheduledAt ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(item.scheduledAt).toLocaleString('th-TH')}
                          </span>
                        ) : (
                          new Date(item.createdAt).toLocaleString('th-TH')
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ก่อนหน้า
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              ถัดไป
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
