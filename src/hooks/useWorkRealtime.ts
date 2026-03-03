"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CustomerWork, WorkSummaryData, WorkStatus } from "@/lib/work/queries";

// Sound notification utilities
const playNotificationSound = () => {
  if (typeof window === "undefined") return;
  
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Pleasant notification sound (two tones)
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1); // C#6
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.warn("Failed to play notification sound:", error);
  }
};

// New work item generator for simulation
const generateNewWorkItem = (id: number): CustomerWork => {
  const customers = [
    { name: "ร้านขายยาบ้านสวน", line: "BaanSuan_Pharmacy" },
    { name: "คลินิกหมอใจดี", line: "Kind_Doctor" },
    { name: "คุณลุงสมหมาย", line: "Sommai_Uncle" },
    { name: "คุณป้าแก้วใจดี", line: "Kaew_Auntie" },
    { name: "โรงพยาบาลส่งเสริมสุขภาพ", line: "Health_Promote" },
    { name: "ร้านยาสามัญประจำตำบล", line: "Local_Pharmacy" },
    { name: "คลินิกรักษ์สุขภาพ", line: "Rak_Sukapap" },
    { name: "คุณนพดล มีทรัพย์", line: "Nopadol_Rich" },
    { name: "ร้านขายยามหาชัย", line: "Mahachai_Drug" },
    { name: "คุณสุดา รักดี", line: "Suda_Love" },
  ];
  
  const messages = [
    "สั่งซื้อยาแก้ปวดหัวด่วนค่ะ",
    "มีออเดอร์ใหม่จาก LINE Official",
    "ลูกค้าสอบถามราคายาเพิ่มเติม",
    "ขอใบเสนอราคายาประจำ",
    "สั่งซื้อยาตามใบสั่งแพทย์",
    "ลูกค้าใหม่ต้องการปรึกษา",
    "รีเดิมออเดอร์เดือนที่แล้ว",
    "สอบถามโปรโมชั่นยากลุ่ม",
  ];
  
  const tags = ["VIP", "ประจำ", "ใหม่", "ติดตาม", "ส่งฟรี", "เก็บเงินปลายทาง", "ด่วน"];
  const types = ["chat", "order", "inquiry", "complaint"] as const;
  const priorities = ["urgent", "high", "normal", "low"] as const;
  
  const customer = customers[Math.floor(Math.random() * customers.length)];
  const message = messages[Math.floor(Math.random() * messages.length)];
  const type = types[Math.floor(Math.random() * types.length)];
  const priority = Math.random() > 0.7 ? "urgent" : priorities[Math.floor(Math.random() * priorities.length)];
  
  return {
    id: `work-new-${id}`,
    customerId: `cust-new-${id}`,
    customerName: customer.name,
    lineDisplayName: customer.line,
    type,
    status: "pending" as WorkStatus,
    priority,
    title: type === "order" ? `ออเดอร์ #NEW-${10000 + id}` : message.slice(0, 30),
    lastMessage: message,
    lastMessageTime: new Date().toISOString(),
    unreadCount: 1,
    orderAmount: type === "order" ? Math.floor(Math.random() * 8000) + 200 : undefined,
    tags: [tags[Math.floor(Math.random() * tags.length)]],
    assignedTo: "current-user",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export interface NotificationWork {
  id: string;
  work: CustomerWork;
  timestamp: Date;
  read: boolean;
}

interface UseWorkRealtimeOptions {
  enabled?: boolean;
  minInterval?: number; // minimum interval in ms
  maxInterval?: number; // maximum interval in ms
  enableSound?: boolean;
  onNewWork?: (work: CustomerWork) => void;
}

export function useWorkRealtime(options: UseWorkRealtimeOptions = {}) {
  const {
    enabled = true,
    minInterval = 60000, // 1 minute
    maxInterval = 120000, // 2 minutes
    enableSound = true,
    onNewWork,
  } = options;

  const [notifications, setNotifications] = useState<NotificationWork[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastNotification, setLastNotification] = useState<CustomerWork | null>(null);
  const workIdCounter = useRef(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate summary from current notifications
  const summary: WorkSummaryData = {
    totalPending: notifications.filter(n => n.work.status === "pending" && !n.read).length,
    inProgress: 0,
    waitingResponse: 0,
    completedToday: 0,
    urgentCount: notifications.filter(n => n.work.priority === "urgent" && !n.read).length,
  };

  // Add new notification
  const addNotification = useCallback((work: CustomerWork) => {
    const notification: NotificationWork = {
      id: `notif-${Date.now()}-${work.id}`,
      work,
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
    setUnreadCount(prev => prev + 1);
    setLastNotification(work);

    if (enableSound) {
      playNotificationSound();
    }

    onNewWork?.(work);
  }, [enableSound, onNewWork]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
    setUnreadCount(0);
  }, []);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setLastNotification(null);
  }, []);

  // Start simulation
  const startSimulation = useCallback(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
    }

    setIsSimulating(true);

    const scheduleNext = () => {
      const delay = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
      
      intervalRef.current = setTimeout(() => {
        if (!enabled) return;

        const newWork = generateNewWorkItem(workIdCounter.current++);
        addNotification(newWork);

        // Schedule next
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }, [enabled, minInterval, maxInterval, addNotification]);

  // Stop simulation
  const stopSimulation = useCallback(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
    setIsSimulating(false);
  }, []);

  // Toggle simulation
  const toggleSimulation = useCallback(() => {
    if (isSimulating) {
      stopSimulation();
    } else {
      startSimulation();
    }
  }, [isSimulating, startSimulation, stopSimulation]);

  // Manual trigger for testing
  const triggerTestNotification = useCallback(() => {
    const newWork = generateNewWorkItem(workIdCounter.current++);
    addNotification(newWork);
  }, [addNotification]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, []);

  // Auto-start simulation if enabled
  useEffect(() => {
    if (enabled && !isSimulating) {
      startSimulation();
    }
    return () => {
      if (!enabled && intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [enabled, isSimulating, startSimulation]);

  return {
    notifications,
    unreadCount,
    isSimulating,
    lastNotification,
    summary,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    startSimulation,
    stopSimulation,
    toggleSimulation,
    triggerTestNotification,
  };
}

export default useWorkRealtime;
