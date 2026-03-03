/**
 * OrderQueue Component
 * Collapsible task queue (4 types: follow_up, send_bill, contact, issue)
 */

'use client';

import { useState } from 'react';
import { OrderTask, OrderTaskType } from '@/lib/orders/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronDown,
  ChevronRight,
  Flame,
  FileText,
  Phone,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface OrderQueueProps {
  tasks: {
    follow_up: OrderTask[];
    send_bill: OrderTask[];
    contact: OrderTask[];
    issue: OrderTask[];
  };
  onTaskClick?: (task: OrderTask) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const QUEUE_CONFIG: Record<
  OrderTaskType,
  {
    icon: React.ReactNode;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  follow_up: {
    icon: <Flame className="h-4 w-4" />,
    label: 'ติดตามออเดอร์',
    color: '#EF4444',
    bgColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  send_bill: {
    icon: <FileText className="h-4 w-4" />,
    label: 'ส่งบิล/ใบเสร็จ',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  contact: {
    icon: <Phone className="h-4 w-4" />,
    label: 'ติดต่อลูกค้า',
    color: '#10B981',
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  issue: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: 'แจ้งปัญหา',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
};

interface QueueSectionProps {
  type: OrderTaskType;
  tasks: OrderTask[];
  isExpanded: boolean;
  onToggle: () => void;
  onTaskClick?: (task: OrderTask) => void;
}

function QueueSection({
  type,
  tasks,
  isExpanded,
  onToggle,
  onTaskClick,
}: QueueSectionProps) {
  const config = QUEUE_CONFIG[type];
  const hasHighPriority = tasks.some((t) => t.priority === 'high');

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: config.borderColor }}
    >
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 transition-colors',
          'hover:opacity-90'
        )}
        style={{ backgroundColor: config.bgColor }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: config.color }}>{config.icon}</span>
          <span className="font-medium text-sm text-gray-900">
            {config.label}
          </span>
          {hasHighPriority && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs font-bold"
            style={{
              borderColor: config.color,
              color: config.color,
              backgroundColor: 'white',
            }}
          >
            {tasks.length}
          </Badge>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </button>

      {isExpanded && tasks.length > 0 && (
        <ScrollArea className="max-h-[200px]">
          <div className="p-2 space-y-1">
            {tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => onTaskClick?.(task)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                  'hover:bg-gray-50',
                  task.priority === 'high' && 'bg-red-50/50 border-l-2 border-red-400'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 truncate">
                    {task.orderNumber}
                  </span>
                  <span className="text-xs text-gray-400">
                    {task.customerName}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {task.description}
                </p>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export function OrderQueue({
  tasks,
  onTaskClick,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: OrderQueueProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<OrderTaskType>>(
    new Set(['follow_up'])
  );

  const isCollapsed = controlledCollapsed ?? internalCollapsed;
  const totalTasks = Object.values(tasks).flat().length;

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  const toggleSection = (type: OrderTaskType) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Get all task types that have tasks
  const activeTypes = (Object.keys(tasks) as OrderTaskType[]).filter(
    (type) => tasks[type].length > 0
  );

  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b cursor-pointer"
        onClick={toggleCollapse}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span className="font-semibold text-gray-900">งานที่ต้องทำ</span>
          <Badge variant="secondary" className="text-xs">
            {totalTasks}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-3 space-y-2">
          {activeTypes.length === 0 ? (
            <div className="text-center py-4 text-gray-400">
              <p className="text-sm">ไม่มีงานที่ต้องทำ 🎉</p>
            </div>
          ) : (
            activeTypes.map((type) => (
              <QueueSection
                key={type}
                type={type}
                tasks={tasks[type]}
                isExpanded={expandedSections.has(type)}
                onToggle={() => toggleSection(type)}
                onTaskClick={onTaskClick}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
