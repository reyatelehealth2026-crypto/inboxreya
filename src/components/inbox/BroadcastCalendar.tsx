'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Users,
  Trash2,
  Send,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { FlexPreview } from './FlexPreview';

interface ScheduledBroadcast {
  id: number;
  title: string;
  messages: unknown[];
  tags: { id: number; name: string; color: string }[];
  tagIds: number[];
  scheduledAt: string;
  totalRecipients: number;
  status: string;
}

// Thai month names
const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];
const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export function BroadcastCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [broadcasts, setBroadcasts] = useState<ScheduledBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedBroadcast, setSelectedBroadcast] =
    useState<ScheduledBroadcast | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const fetchBroadcasts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inbox/broadcasts/scheduled');
      const data = await res.json();
      if (data.success) setBroadcasts(data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calendar grid computation
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Group broadcasts by day
  const broadcastsByDay = broadcasts.reduce<Record<number, ScheduledBroadcast[]>>(
    (acc, b) => {
      const d = new Date(b.scheduledAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!acc[day]) acc[day] = [];
        acc[day].push(b);
      }
      return acc;
    },
    {}
  );

  const dayBroadcasts = selectedDay ? broadcastsByDay[selectedDay] || [] : [];

  const handleCancel = async (id: number) => {
    setCancelling(id);
    try {
      const res = await fetch(`/api/inbox/broadcasts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        console.error('Failed to cancel broadcast:', data.error);
        return;
      }
      setBroadcasts((prev) => prev.filter((b) => b.id !== id));
      setSelectedBroadcast(null);
      if (
        selectedDay &&
        (broadcastsByDay[selectedDay] || []).filter((b) => b.id !== id).length ===
          0
      ) {
        setSelectedDay(null);
      }
    } finally {
      setCancelling(null);
    }
  };

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day;

  // Build calendar cells: blanks + days
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="flex h-full gap-4">
      {/* Calendar Panel */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {THAI_MONTHS[month]} {year + 543}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={prevMonth}
              className="h-8 w-8"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={nextMonth}
              className="h-8 w-8"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchBroadcasts}
              className="h-8 w-8"
              title="รีเฟรช"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {THAI_DAYS_SHORT.map((d) => (
            <div
              key={d}
              className="text-center text-[11px] font-medium text-gray-400 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, idx) => {
            if (!day) return <div key={`blank-${idx}`} />;
            const events = broadcastsByDay[day] || [];
            const hasEvents = events.length > 0;
            const isSelected = selectedDay === day;
            const todayCell = isToday(day);

            return (
              <button
                key={day}
                onClick={() => {
                  setSelectedDay(isSelected ? null : day);
                  setSelectedBroadcast(null);
                }}
                className={cn(
                  'relative min-h-[72px] p-1.5 rounded-lg text-left transition-all border',
                  isSelected
                    ? 'bg-green-50 border-green-300 shadow-sm'
                    : hasEvents
                    ? 'border-green-100 hover:border-green-200 hover:bg-green-50/50'
                    : 'border-transparent hover:bg-gray-50'
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full mb-1',
                    todayCell ? 'bg-green-600 text-white' : 'text-gray-700'
                  )}
                >
                  {day}
                </span>
                {hasEvents && (
                  <div className="space-y-0.5">
                    {events.slice(0, 2).map((b) => (
                      <div
                        key={b.id}
                        className="truncate text-[9px] bg-green-100 text-green-800 rounded px-1 py-0.5 font-medium leading-tight"
                      >
                        {new Date(b.scheduledAt).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        {b.title}
                      </div>
                    ))}
                    {events.length > 2 && (
                      <div className="text-[9px] text-green-600 px-1">
                        +{events.length - 2} อีก
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Empty state */}
        {!loading && broadcasts.length === 0 && (
          <div className="mt-8 text-center text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">ยังไม่มีการส่งที่ตั้งเวลาไว้</p>
            <p className="text-xs mt-1">
              ไปที่ แคตตาล็อค &amp; โปรโมชัน เพื่อตั้งเวลาส่ง
            </p>
          </div>
        )}
      </div>

      {/* Side Panel */}
      {selectedDay && (
        <div className="w-80 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-gray-900">
                  {selectedDay} {THAI_MONTHS[month]} {year + 543}
                </h3>
                <p className="text-xs text-gray-500">
                  {dayBroadcasts.length} รายการ
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setSelectedDay(null);
                  setSelectedBroadcast(null);
                }}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              {dayBroadcasts.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">
                  ไม่มีรายการ
                </div>
              ) : (
                <div className="p-3 space-y-3">
                  {dayBroadcasts.map((b) => (
                    <div
                      key={b.id}
                      className={cn(
                        'rounded-xl border-2 transition-all cursor-pointer',
                        selectedBroadcast?.id === b.id
                          ? 'border-green-400 bg-green-50'
                          : 'border-gray-100 hover:border-gray-200 bg-white'
                      )}
                      onClick={() =>
                        setSelectedBroadcast(
                          selectedBroadcast?.id === b.id ? null : b
                        )
                      }
                    >
                      {/* Event header */}
                      <div className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {b.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-600">
                                {new Date(b.scheduledAt).toLocaleTimeString(
                                  'th-TH',
                                  { hour: '2-digit', minute: '2-digit' }
                                )}
                              </span>
                              <Users className="w-3 h-3 text-gray-400 flex-shrink-0 ml-1" />
                              <span className="text-xs text-gray-600">
                                {b.totalRecipients} คน
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancel(b.id);
                            }}
                            disabled={cancelling === b.id}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1">
                          {b.tags.map((t) => (
                            <Badge
                              key={t.id}
                              variant="secondary"
                              className="text-[10px] h-4 px-1.5"
                              style={{
                                backgroundColor: t.color + '22',
                                color: t.color,
                                borderColor: t.color + '44',
                              }}
                            >
                              {t.name}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Live Preview */}
                      {selectedBroadcast?.id === b.id &&
                        b.messages.length > 0 && (
                          <div className="border-t border-green-200 p-3 bg-white rounded-b-xl">
                            <p className="text-[10px] font-medium text-green-700 mb-2 flex items-center gap-1">
                              <Send className="w-3 h-3" /> Live Preview
                            </p>
                            <div className="bg-[#95ec69]/20 rounded-xl p-3 max-h-64 overflow-y-auto">
                              {b.messages.slice(0, 1).map((msg: unknown, i: number) => {
                                const m = msg as Record<string, unknown>;
                                return (
                                  <div key={i}>
                                    {m.type === 'flex' ? (
                                      <FlexPreview flex={(m.contents as Record<string, unknown>) ?? null} />
                                    ) : m.type === 'text' ? (
                                      <div className="bg-white rounded-xl px-3 py-2 text-xs shadow-sm max-w-[200px]">
                                        {m.text as string}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                              {b.messages.length > 1 && (
                                <p className="text-[10px] text-gray-400 mt-2 text-center">
                                  +{b.messages.length - 1} ข้อความเพิ่มเติม
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
