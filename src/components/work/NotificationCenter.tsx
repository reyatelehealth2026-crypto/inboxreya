"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check, CheckCheck, Trash2, Package, MessageCircle, HelpCircle, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { NotificationWork } from "@/hooks/useWorkRealtime";
import { CustomerWork } from "@/lib/work/queries";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";

interface NotificationCenterProps {
  notifications: NotificationWork[];
  unreadCount: number;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNotificationClick?: (work: CustomerWork) => void;
  isSimulating?: boolean;
  onToggleSimulation?: () => void;
  onTestNotification?: () => void;
}

const workTypeIcons = {
  chat: MessageCircle,
  order: Package,
  inquiry: HelpCircle,
  complaint: AlertCircle,
};

const workTypeColors = {
  chat: "text-blue-500 bg-blue-50",
  order: "text-emerald-500 bg-emerald-50",
  inquiry: "text-purple-500 bg-purple-50",
  complaint: "text-red-500 bg-red-50",
};

const priorityLabels = {
  urgent: { text: "ด่วน", color: "text-red-600 bg-red-100" },
  high: { text: "สูง", color: "text-orange-600 bg-orange-100" },
  normal: { text: "ปกติ", color: "text-blue-600 bg-blue-100" },
  low: { text: "ต่ำ", color: "text-gray-600 bg-gray-100" },
};

export function NotificationCenter({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onNotificationClick,
  isSimulating,
  onToggleSimulation,
  onTestNotification,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const handleNotificationClick = (notification: NotificationWork) => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    onNotificationClick?.(notification.work);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`แจ้งเตือน ${unreadCount > 0 ? `${unreadCount} รายการใหม่` : "ไม่มีรายการใหม่"}`}
      >
        <Bell className={cn("h-5 w-5", unreadCount > 0 && "text-blue-600")} />
        
        {/* Badge */}
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center text-xs px-1.5 animate-in zoom-in-50"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}

        {/* Simulation Indicator */}
        {isSimulating && (
          <span className="absolute bottom-0 right-0 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[400px] bg-white rounded-xl shadow-lg border border-gray-200 z-50 animate-in fade-in-0 zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div>
              <h3 className="font-semibold text-gray-900">การแจ้งเตือน</h3>
              <p className="text-xs text-gray-500">
                {unreadCount > 0 ? `${unreadCount} รายการใหม่` : "ไม่มีรายการใหม่"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onMarkAllAsRead}
                    disabled={unreadCount === 0}
                    className="h-8 text-xs"
                  >
                    <CheckCheck className="h-3.5 w-3.5 mr-1" />
                    อ่านทั้งหมด
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClearAll}
                    className="h-8 w-8 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Dev Tools (Simulation Controls) */}
          {process.env.NODE_ENV === "development" && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Button
                  variant={isSimulating ? "default" : "outline"}
                  size="sm"
                  onClick={onToggleSimulation}
                  className="h-7 text-xs flex-1"
                >
                  {isSimulating ? (
                    <>
                      <span className="h-1.5 w-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse" />
                      จำลองกำลังทำงาน
                    </>
                  ) : (
                    "เริ่มจำลอง"
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onTestNotification}
                  className="h-7 text-xs"
                >
                  ทดสอบ
                </Button>
              </div>
            </div>
          )}

          {/* Notifications List */}
          <ScrollArea className="h-[400px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Bell className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">ไม่มีการแจ้งเตือน</p>
                <p className="text-xs text-gray-400 mt-1">
                  งานใหม่จะแจ้งเตือนที่นี่
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => {
                  const Icon = workTypeIcons[notification.work.type];
                  const priority = priorityLabels[notification.work.priority];

                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "p-4 cursor-pointer transition-colors hover:bg-gray-50",
                        !notification.read && "bg-blue-50/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={cn(
                          "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                          workTypeColors[notification.work.type]
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {notification.work.customerName}
                            </p>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {formatDistanceToNow(notification.timestamp, {
                                addSuffix: true,
                                locale: th,
                              })}
                            </span>
                          </div>

                          <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                            {notification.work.lastMessage}
                          </p>

                          {/* Meta */}
                          <div className="flex items-center gap-2 mt-2">
                            <span className={cn(
                              "text-xs px-1.5 py-0.5 rounded font-medium",
                              priority.color
                            )}>
                              {priority.text}
                            </span>
                            
                            {notification.work.orderAmount && (
                              <span className="text-xs text-emerald-600 font-medium">
                                ฿{notification.work.orderAmount.toLocaleString()}
                              </span>
                            )}

                            {!notification.read && (
                              <Badge variant="default" className="h-4 text-[10px] px-1.5">
                                ใหม่
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Mark as read button */}
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkAsRead(notification.id);
                            }}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <p className="text-xs text-center text-gray-500">
              แสดง {notifications.length} รายการล่าสุด
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;
