/**
 * Inbox Layout Component
 * Main layout with sidebar and content area
 */

'use client';

import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface InboxLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function InboxLayout({ children, className }: InboxLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      
      {/* Main Content */}
      <main
        className={cn(
          'flex-1 overflow-y-auto transition-all duration-300',
          sidebarCollapsed ? 'ml-16' : 'ml-64',
          className
        )}
      >
        {children}
      </main>
    </div>
  );
}
