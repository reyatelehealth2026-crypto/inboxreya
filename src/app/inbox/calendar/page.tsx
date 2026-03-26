import { BroadcastCalendar } from '@/components/inbox/BroadcastCalendar';

export default function CalendarPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-white px-6 py-4 shrink-0">
        <h1 className="text-xl font-bold text-gray-900">ปฏิทินการส่ง</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          ดูและจัดการการส่งข้อความที่ตั้งเวลาไว้
        </p>
      </div>
      <div className="flex-1 min-h-0 p-6 overflow-auto">
        <BroadcastCalendar />
      </div>
    </div>
  );
}
