"use client";

import { useState } from "react";
import { 
  MessageCircle, 
  ShoppingCart, 
  HelpCircle, 
  AlertTriangle,
  MoreHorizontal,
  Clock,
  ChevronRight,
  CheckCircle2,
  PlayCircle,
  Archive
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { CustomerWork, WorkStatus, Priority } from "@/lib/work/queries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CustomerWorkCardProps {
  work: CustomerWork;
  onStatusChange?: (workId: string, newStatus: WorkStatus) => void;
  onClick?: (work: CustomerWork) => void;
  isDragging?: boolean;
}

const priorityConfig: Record<Priority, { label: string; color: string; bg: string }> = {
  urgent: { 
    label: "ด่วน", 
    color: "text-red-700", 
    bg: "bg-red-100 border-red-200" 
  },
  high: { 
    label: "สูง", 
    color: "text-orange-700", 
    bg: "bg-orange-100 border-orange-200" 
  },
  normal: { 
    label: "ปกติ", 
    color: "text-blue-700", 
    bg: "bg-blue-100 border-blue-200" 
  },
  low: { 
    label: "ต่ำ", 
    color: "text-gray-700", 
    bg: "bg-gray-100 border-gray-200" 
  },
};

const statusConfig: Record<WorkStatus, { label: string; icon: React.ElementType; color: string }> = {
  pending: { 
    label: "รอดำเนินการ", 
    icon: Clock, 
    color: "text-amber-600" 
  },
  in_progress: { 
    label: "กำลังทำ", 
    icon: PlayCircle, 
    color: "text-blue-600" 
  },
  waiting: { 
    label: "รอตอบกลับ", 
    icon: MoreHorizontal, 
    color: "text-purple-600" 
  },
  completed: { 
    label: "เสร็จสิ้น", 
    icon: CheckCircle2, 
    color: "text-emerald-600" 
  },
};

const typeIcons = {
  chat: MessageCircle,
  order: ShoppingCart,
  inquiry: HelpCircle,
  complaint: AlertTriangle,
};

const typeLabels = {
  chat: "แชท",
  order: "ออเดอร์",
  inquiry: "สอบถาม",
  complaint: "ร้องเรียน",
};

export function CustomerWorkCard({ work, onStatusChange, onClick, isDragging }: CustomerWorkCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const priority = priorityConfig[work.priority];
  const status = statusConfig[work.status];
  const TypeIcon = typeIcons[work.type];
  const StatusIcon = status.icon;

  const handleStatusChange = async (newStatus: WorkStatus) => {
    if (newStatus === work.status) return;
    setIsUpdating(true);
    try {
      await onStatusChange?.(work.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(work.lastMessageTime), {
    addSuffix: true,
    locale: th,
  });

  return (
    <div
      className={`
        group relative bg-white rounded-xl border border-gray-200 p-4
        hover:shadow-lg hover:border-gray-300 transition-all duration-200
        cursor-pointer ${isUpdating ? "opacity-70" : ""}
        ${isDragging ? "shadow-2xl ring-2 ring-blue-400 rotate-2 scale-105 z-50" : ""}
      `}
      onClick={() => onClick?.(work)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar placeholder */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium text-sm">
            {work.customerName.charAt(0)}
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900 truncate">{work.customerName}</h4>
              {work.unreadCount > 0 && (
                <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-500 rounded-full">
                  {work.unreadCount}
                </span>
              )}
            </div>
            {work.lineDisplayName && (
              <p className="text-sm text-gray-500 truncate">@{work.lineDisplayName}</p>
            )}
          </div>
        </div>

        {/* Priority Badge */}
        <span className={`
          flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
          border ${priority.bg} ${priority.color}
        `}>
          {priority.label}
        </span>
      </div>

      {/* Content */}
      <div className="mt-3">
        <div className="flex items-center gap-2 mb-2">
          <TypeIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">{typeLabels[work.type]}</span>
          {work.orderAmount && (
            <span className="text-sm font-medium text-emerald-600">
              ฿{work.orderAmount.toLocaleString()}
            </span>
          )}
        </div>
        
        <p className="text-sm text-gray-700 line-clamp-2">{work.lastMessage}</p>
        
        <div className="mt-2 flex items-center gap-2">
          <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} />
          <span className={`text-xs ${status.color}`}>{status.label}</span>
          <span className="text-gray-300">•</span>
          <span className="text-xs text-gray-500">{timeAgo}</span>
        </div>
      </div>

      {/* Tags */}
      {work.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {work.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-gray-600 hover:text-gray-900"
              disabled={isUpdating}
            >
              <MoreHorizontal className="h-4 w-4 mr-1" />
              เปลี่ยนสถานะ
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleStatusChange("pending")}>
              <Clock className="h-4 w-4 mr-2 text-amber-600" />
              รอดำเนินการ
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("in_progress")}>
              <PlayCircle className="h-4 w-4 mr-2 text-blue-600" />
              กำลังทำ
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("waiting")}>
              <MoreHorizontal className="h-4 w-4 mr-2 text-purple-600" />
              รอตอบกลับ
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("completed")}>
              <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
              เสร็จสิ้น
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 text-gray-600 hover:text-gray-900 group-hover:bg-gray-50"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(work);
          }}
        >
          ดูรายละเอียด
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
