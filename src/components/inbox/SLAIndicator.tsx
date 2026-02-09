'use client';

import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SLAIndicatorProps {
  lastMessageTime: Date;
  slaThresholdMinutes?: number;
  hasResponse?: boolean;
  className?: string;
}

export function SLAIndicator({ 
  lastMessageTime, 
  slaThresholdMinutes = 30,
  hasResponse = false,
  className 
}: SLAIndicatorProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isExceeded, setIsExceeded] = useState(false);

  useEffect(() => {
    // Don't show SLA for conversations that already have a response
    if (hasResponse) return;

    const updateTimer = () => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - new Date(lastMessageTime).getTime()) / 1000 / 60);
      setTimeElapsed(elapsed);
      setIsExceeded(elapsed > slaThresholdMinutes);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [lastMessageTime, slaThresholdMinutes, hasResponse]);

  // Don't show indicator if conversation has response
  if (hasResponse) return null;

  const remainingMinutes = slaThresholdMinutes - timeElapsed;
  const percentageElapsed = (timeElapsed / slaThresholdMinutes) * 100;

  // Color coding based on time remaining
  const getColorClass = () => {
    if (isExceeded) return 'text-red-600 bg-red-50 border-red-200';
    if (percentageElapsed > 80) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (percentageElapsed > 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  return (
    <div className={cn(
      'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border',
      getColorClass(),
      className
    )}>
      {isExceeded ? (
        <>
          <AlertTriangle className="h-3 w-3" />
          <span>SLA exceeded by {timeElapsed - slaThresholdMinutes}m</span>
        </>
      ) : (
        <>
          <Clock className="h-3 w-3" />
          <span>{remainingMinutes}m remaining</span>
        </>
      )}
    </div>
  );
}

interface SLACountdownProps {
  lastMessageTime: Date;
  slaThresholdMinutes?: number;
  hasResponse?: boolean;
}

export function SLACountdown({ 
  lastMessageTime, 
  slaThresholdMinutes = 30,
  hasResponse = false 
}: SLACountdownProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (hasResponse) return;

    const updateTimer = () => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - new Date(lastMessageTime).getTime()) / 1000 / 60);
      setTimeElapsed(elapsed);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000); // Update every second for countdown

    return () => clearInterval(interval);
  }, [lastMessageTime, hasResponse]);

  if (hasResponse) return null;

  const remainingMinutes = slaThresholdMinutes - timeElapsed;
  const isExceeded = remainingMinutes < 0;

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'text-sm font-medium',
        isExceeded ? 'text-red-600' : remainingMinutes < 5 ? 'text-orange-600' : 'text-muted-foreground'
      )}>
        {isExceeded ? (
          <span>Exceeded by {Math.abs(remainingMinutes)} minutes</span>
        ) : (
          <span>{remainingMinutes} minutes remaining</span>
        )}
      </div>
    </div>
  );
}
